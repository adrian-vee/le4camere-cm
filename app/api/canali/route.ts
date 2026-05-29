import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET() {
  try {
    const channels = await prisma.channel.findMany({
      include: {
        syncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
        syncJobs: { where: { status: "failed" } },
        reservations: { where: { status: { not: "cancelled" } } },
      },
    });

    return NextResponse.json(
      channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        providerType: ch.providerType,
        enabled: ch.enabled,
        lastSync: ch.syncLogs[0]
          ? {
              event: ch.syncLogs[0].event,
              status: ch.syncLogs[0].status,
              createdAt: ch.syncLogs[0].createdAt.toISOString(),
            }
          : null,
        failedJobs: ch.syncJobs.length,
        reservationCount: ch.reservations.length,
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
