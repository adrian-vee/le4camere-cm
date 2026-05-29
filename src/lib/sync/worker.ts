import { prisma } from "../db";
import { getAvailability, getRates } from "../ari-store";
import { MockAdapter } from "../connectivity/adapters/mock";
import { NotImplementedError } from "../connectivity/provider";
import type { ConnectivityProvider, AvailabilityUpdate, RateUpdate } from "../connectivity/provider";

const MAX_ATTEMPTS = 3;

function getProvider(providerType: string): ConnectivityProvider {
  switch (providerType) {
    case "mock":
      return new MockAdapter();
    default:
      throw new NotImplementedError(providerType, "getProvider");
  }
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  // Grab pending jobs with row-level locking
  const jobs = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "SyncJob" WHERE status = 'pending' ORDER BY "scheduledAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED`
  );

  for (const { id } of jobs) {
    const job = await prisma.syncJob.update({
      where: { id },
      data: { status: "running", attempts: { increment: 1 } },
      include: { channel: true },
    });

    try {
      const provider = getProvider(job.channel.providerType);
      const payload = job.payload as { roomTypeCode: string; dateFrom: string; dateTo: string };

      // Find roomType by code
      const roomType = await prisma.roomType.findUnique({
        where: { code: payload.roomTypeCode },
        include: { ratePlans: true },
      });

      if (!roomType) {
        throw new Error(`RoomType not found: ${payload.roomTypeCode}`);
      }

      // Push availability
      const inventoryDays = await getAvailability(roomType.id, payload.dateFrom, payload.dateTo);
      const availUpdates: AvailabilityUpdate[] = inventoryDays.map((inv) => ({
        roomTypeCode: payload.roomTypeCode,
        date: inv.date.toISOString().slice(0, 10),
        available: inv.allotment - inv.booked,
        stopSell: inv.stopSell,
      }));

      const availResult = await provider.pushAvailability(availUpdates);
      if (!availResult.ok) {
        throw new Error(`pushAvailability failed: ${availResult.error}`);
      }

      // Push rates for each rate plan
      for (const rp of roomType.ratePlans) {
        const rateDays = await getRates(rp.id, payload.dateFrom, payload.dateTo);
        const rateUpdates: RateUpdate[] = rateDays.map((rd) => ({
          ratePlanCode: rp.code,
          date: rd.date.toISOString().slice(0, 10),
          price: Number(rd.price),
          currency: rp.currency,
        }));

        const rateResult = await provider.pushRates(rateUpdates);
        if (!rateResult.ok) {
          throw new Error(`pushRates failed for ${rp.code}: ${rateResult.error}`);
        }
      }

      // Mark done
      await prisma.syncJob.update({
        where: { id },
        data: { status: "done" },
      });

      await prisma.syncLog.create({
        data: {
          channelId: job.channelId,
          direction: "outbound",
          event: "push_ari",
          status: "success",
          payload: payload as object,
        },
      });

      processed++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (job.attempts >= MAX_ATTEMPTS) {
        await prisma.syncJob.update({
          where: { id },
          data: { status: "failed", lastError: errorMsg },
        });
        failed++;
      } else {
        // Schedule retry with backoff
        const retryAt = new Date(Date.now() + backoffMs(job.attempts));
        await prisma.syncJob.update({
          where: { id },
          data: { status: "pending", lastError: errorMsg, scheduledAt: retryAt },
        });
      }

      await prisma.syncLog.create({
        data: {
          channelId: job.channelId,
          direction: "outbound",
          event: "push_ari",
          status: "error",
          payload: { error: errorMsg },
        },
      });
    }
  }

  return { processed, failed };
}
