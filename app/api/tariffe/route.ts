import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { updateRates } from "@/src/lib/ari-store";
import { enqueuePushARI } from "@/src/lib/sync/engine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const days = parseInt(searchParams.get("days") ?? "14", 10);

    const start = startStr
      ? new Date(startStr)
      : new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days);

    const ratePlans = await prisma.ratePlan.findMany({
      include: {
        roomType: true,
        rateDays: {
          where: { date: { gte: start, lt: end } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { code: "asc" },
    });

    return NextResponse.json(
      ratePlans.map((rp) => ({
        id: rp.id,
        name: rp.name,
        code: rp.code,
        roomType: rp.roomType.name,
        roomTypeCode: rp.roomType.code,
        currency: rp.currency,
        days: rp.rateDays.map((rd) => ({
          date: rd.date.toISOString().slice(0, 10),
          price: Number(rd.price),
          minStay: rd.minStay,
          closedToArrival: rd.closedToArrival,
          closedToDeparture: rd.closedToDeparture,
        })),
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ratePlanId, date, price, minStay, closedToArrival, closedToDeparture } = body;

    const changes: Record<string, unknown> = {};
    if (price !== undefined) changes.price = price;
    if (minStay !== undefined) changes.minStay = minStay;
    if (closedToArrival !== undefined) changes.closedToArrival = closedToArrival;
    if (closedToDeparture !== undefined) changes.closedToDeparture = closedToDeparture;

    await updateRates(ratePlanId, date, changes);

    // Enqueue ARI push for all enabled channels
    const ratePlan = await prisma.ratePlan.findUnique({
      where: { id: ratePlanId },
      include: { roomType: true },
    });

    if (ratePlan) {
      const channels = await prisma.channel.findMany({ where: { enabled: true } });
      for (const ch of channels) {
        await enqueuePushARI(ch.id, ratePlan.roomType.code, date, date);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
