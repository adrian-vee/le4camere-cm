import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, roomType: true, channel: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    // Generate progressive document number
    const lastDoc = await prisma.internalDocument.findFirst({
      orderBy: { number: "desc" },
    });

    const year = new Date().getFullYear();
    let nextNum = 1;
    if (lastDoc) {
      const parts = lastDoc.number.split("/");
      if (parts.length === 2 && parts[1] === String(year)) {
        nextNum = parseInt(parts[0], 10) + 1;
      }
    }

    const docNumber = `${String(nextNum).padStart(4, "0")}/${year}`;

    // Create document record
    const doc = await prisma.internalDocument.create({
      data: {
        reservationId: reservation.id,
        number: docNumber,
        amount: reservation.totalPrice,
        type: "receipt",
      },
    });

    return NextResponse.json({
      documentId: doc.id,
      number: doc.number,
      reservation: {
        id: reservation.id,
        guest: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
        guestEmail: reservation.guest.email,
        guestCountry: reservation.guest.country,
        checkIn: reservation.checkIn.toISOString().slice(0, 10),
        checkOut: reservation.checkOut.toISOString().slice(0, 10),
        roomType: reservation.roomType.name,
        totalPrice: Number(reservation.totalPrice),
        currency: reservation.currency,
        adults: reservation.adults,
        children: reservation.children,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
