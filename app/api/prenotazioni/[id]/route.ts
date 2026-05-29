import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { releaseInventory, decrementInventory } from "@/src/lib/ari-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        guest: true,
        roomType: true,
        channel: true,
        documents: { orderBy: { issuedAt: "desc" } },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    // Get related sync logs
    const syncLogs = await prisma.syncLog.findMany({
      where: {
        channelId: reservation.channelId,
        payload: { path: ["externalReservationId"], equals: reservation.externalReservationId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      id: reservation.id,
      externalReservationId: reservation.externalReservationId,
      guest: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        country: reservation.guest.country,
      },
      checkIn: reservation.checkIn.toISOString().slice(0, 10),
      checkOut: reservation.checkOut.toISOString().slice(0, 10),
      roomType: reservation.roomType.name,
      roomTypeCode: reservation.roomType.code,
      roomTypeId: reservation.roomType.id,
      channel: reservation.channel.name,
      channelId: reservation.channelId,
      totalPrice: Number(reservation.totalPrice),
      currency: reservation.currency,
      adults: reservation.adults,
      children: reservation.children,
      status: reservation.status,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
      documents: reservation.documents.map((d) => ({
        id: d.id,
        number: d.number,
        type: d.type,
        amount: Number(d.amount),
        issuedAt: d.issuedAt.toISOString(),
      })),
      timeline: syncLogs.map((l) => ({
        event: l.event,
        status: l.status,
        direction: l.direction,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { guest: true, roomType: true },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    // Update guest data if provided
    if (body.firstName || body.lastName || body.email !== undefined || body.phone !== undefined || body.country !== undefined) {
      await prisma.guest.update({
        where: { id: reservation.guestId },
        data: {
          ...(body.firstName && { firstName: body.firstName }),
          ...(body.lastName && { lastName: body.lastName }),
          ...(body.email !== undefined && { email: body.email || null }),
          ...(body.phone !== undefined && { phone: body.phone || null }),
          ...(body.country !== undefined && { country: body.country || null }),
        },
      });
    }

    // Handle date changes (release old inventory, decrement new)
    const newCheckIn = body.checkIn ? new Date(body.checkIn) : reservation.checkIn;
    const newCheckOut = body.checkOut ? new Date(body.checkOut) : reservation.checkOut;
    const datesChanged =
      (body.checkIn && body.checkIn !== reservation.checkIn.toISOString().slice(0, 10)) ||
      (body.checkOut && body.checkOut !== reservation.checkOut.toISOString().slice(0, 10));

    if (datesChanged && reservation.status !== "cancelled") {
      await releaseInventory(
        reservation.roomTypeId,
        reservation.checkIn.toISOString().slice(0, 10),
        reservation.checkOut.toISOString().slice(0, 10)
      );
      await decrementInventory(
        reservation.roomTypeId,
        newCheckIn.toISOString().slice(0, 10),
        newCheckOut.toISOString().slice(0, 10)
      );
    }

    // Update reservation
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        ...(body.checkIn && { checkIn: newCheckIn }),
        ...(body.checkOut && { checkOut: newCheckOut }),
        ...(body.totalPrice !== undefined && { totalPrice: body.totalPrice }),
        ...(body.adults !== undefined && { adults: body.adults }),
        ...(body.children !== undefined && { children: body.children }),
        status: "modified",
      },
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Prenotazione non trovata" }, { status: 404 });
    }

    if (reservation.status === "cancelled") {
      return NextResponse.json({ error: "Prenotazione gia cancellata" }, { status: 400 });
    }

    // Release inventory
    await releaseInventory(
      reservation.roomTypeId,
      reservation.checkIn.toISOString().slice(0, 10),
      reservation.checkOut.toISOString().slice(0, 10)
    );

    // Update status to cancelled
    await prisma.reservation.update({
      where: { id },
      data: { status: "cancelled" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
