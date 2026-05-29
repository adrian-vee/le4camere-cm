import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { decrementInventory } from "@/src/lib/ari-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const channel = searchParams.get("channel");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);

    const where: Record<string, unknown> = {};
    if (from) where.checkIn = { gte: new Date(from) };
    if (to) where.checkOut = { ...(where.checkOut as object ?? {}), lte: new Date(to) };
    if (channel) where.channel = { name: channel };
    if (status) where.status = status;
    if (search) {
      where.guest = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        include: { guest: true, roomType: true, channel: true },
        orderBy: { checkIn: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      data: reservations.map((r) => ({
        id: r.id,
        externalReservationId: r.externalReservationId,
        guest: `${r.guest.firstName} ${r.guest.lastName}`,
        guestFirstName: r.guest.firstName,
        guestLastName: r.guest.lastName,
        guestEmail: r.guest.email,
        guestPhone: r.guest.phone,
        guestCountry: r.guest.country,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
        roomType: r.roomType.name,
        roomTypeCode: r.roomType.code,
        channel: r.channel.name,
        channelId: r.channelId,
        totalPrice: Number(r.totalPrice),
        currency: r.currency,
        status: r.status,
        adults: r.adults,
        children: r.children,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomTypeCode, checkIn, checkOut, firstName, lastName, email, phone, country, adults, children, totalPrice, notes } = body;

    if (!roomTypeCode || !checkIn || !checkOut || !firstName || !lastName) {
      return NextResponse.json({ error: "Campi obbligatori mancanti" }, { status: 400 });
    }

    const roomType = await prisma.roomType.findUnique({ where: { code: roomTypeCode } });
    if (!roomType) {
      return NextResponse.json({ error: `Tipologia camera non trovata: ${roomTypeCode}` }, { status: 404 });
    }

    let directChannel = await prisma.channel.findFirst({ where: { name: "direct" } });
    if (!directChannel) {
      directChannel = await prisma.channel.create({
        data: { name: "direct", providerType: "mock", enabled: true },
      });
    }

    const lastDirect = await prisma.reservation.findFirst({
      where: { externalReservationId: { startsWith: "DIR-" } },
      orderBy: { createdAt: "desc" },
    });
    let nextNum = 1;
    if (lastDirect) {
      const parts = lastDirect.externalReservationId.split("-");
      nextNum = parseInt(parts[1], 10) + 1;
    }
    const externalId = `DIR-${String(nextNum).padStart(4, "0")}`;

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const days: Date[] = [];
    const cursor = new Date(checkInDate);
    while (cursor < checkOutDate) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const inventory = await prisma.inventoryDay.findMany({
      where: { roomTypeId: roomType.id, date: { in: days } },
    });

    for (const inv of inventory) {
      if (inv.booked >= inv.allotment) {
        return NextResponse.json({
          error: `Nessuna disponibilita per ${roomTypeCode} il ${inv.date.toISOString().slice(0, 10)}`,
        }, { status: 409 });
      }
    }

    const guest = await prisma.guest.create({
      data: { firstName, lastName, email: email || null, phone: phone || null, country: country || null, notes: notes || null },
    });

    const reservation = await prisma.reservation.create({
      data: {
        channelId: directChannel.id,
        externalReservationId: externalId,
        roomTypeId: roomType.id,
        guestId: guest.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: "confirmed",
        totalPrice: totalPrice || 0,
        currency: "EUR",
        adults: adults || 1,
        children: children || 0,
      },
    });

    await decrementInventory(roomType.id, checkIn, checkOut);

    return NextResponse.json({ id: reservation.id, externalReservationId: externalId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
