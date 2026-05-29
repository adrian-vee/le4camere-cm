import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { updateRates } from "@/src/lib/ari-store";
import { enqueuePushARI } from "@/src/lib/sync/engine";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ratePlanId, dateFrom, dateTo, price, minStay, closedToArrival, closedToDeparture } = body;

    if (!ratePlanId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: "Campi obbligatori mancanti" }, { status: 400 });
    }

    const ratePlan = await prisma.ratePlan.findUnique({
      where: { id: ratePlanId },
      include: { roomType: true },
    });

    if (!ratePlan) {
      return NextResponse.json({ error: "Piano tariffario non trovato" }, { status: 404 });
    }

    // Apply changes to each day in range
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    let count = 0;

    const cursor = new Date(start);
    while (cursor <= end) {
      const changes: Record<string, unknown> = {};
      if (price !== undefined) changes.price = price;
      if (minStay !== undefined) changes.minStay = minStay;
      if (closedToArrival !== undefined) changes.closedToArrival = closedToArrival;
      if (closedToDeparture !== undefined) changes.closedToDeparture = closedToDeparture;

      try {
        await updateRates(ratePlanId, new Date(cursor), changes);
        count++;
      } catch {
        // Skip dates without RateDay records
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Enqueue ARI push
    const channels = await prisma.channel.findMany({ where: { enabled: true } });
    for (const ch of channels) {
      await enqueuePushARI(ch.id, ratePlan.roomType.code, dateFrom, dateTo);
    }

    return NextResponse.json({ ok: true, updatedDays: count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
