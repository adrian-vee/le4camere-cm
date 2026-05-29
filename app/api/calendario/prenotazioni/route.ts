import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomTypeId = searchParams.get("roomTypeId");
    const date = searchParams.get("date");

    if (!roomTypeId || !date) {
      return NextResponse.json({ error: "roomTypeId e date richiesti" }, { status: 400 });
    }

    const dateObj = new Date(date);

    const reservations = await prisma.reservation.findMany({
      where: {
        roomTypeId,
        checkIn: { lte: dateObj },
        checkOut: { gt: dateObj },
        status: { not: "cancelled" },
      },
      include: { guest: true },
      orderBy: { checkIn: "asc" },
    });

    return NextResponse.json(
      reservations.map((r) => ({
        id: r.id,
        guest: `${r.guest.firstName} ${r.guest.lastName}`,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        adults: r.adults,
        children: r.children,
        status: r.status,
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
