import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start");
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const view = searchParams.get("view") ?? "rooms";
    const filterType = searchParams.get("roomType");

    const now = new Date();
    const start = startStr
      ? new Date(startStr)
      : new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + days);

    // Generate date array
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const roomTypeWhere = filterType ? { code: filterType } : {};

    const roomTypes = await prisma.roomType.findMany({
      where: roomTypeWhere,
      orderBy: { code: "asc" },
      include: {
        rooms: { orderBy: { label: "asc" } },
        inventoryDays: {
          where: { date: { gte: start, lt: end } },
          orderBy: { date: "asc" },
        },
      },
    });

    // Get reservations overlapping the date range
    const reservations = await prisma.reservation.findMany({
      where: {
        checkIn: { lt: end },
        checkOut: { gt: start },
        status: { not: "cancelled" },
        ...(filterType ? { roomType: { code: filterType } } : {}),
      },
      include: { guest: true, roomType: true, channel: true },
      orderBy: { checkIn: "asc" },
    });

    if (view === "types") {
      // Original room-type view
      const data = roomTypes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        code: rt.code,
        totalUnits: rt.totalUnits,
        days: rt.inventoryDays.map((inv) => ({
          date: inv.date.toISOString().slice(0, 10),
          allotment: inv.allotment,
          booked: inv.booked,
          available: inv.allotment - inv.booked,
          stopSell: inv.stopSell,
        })),
        reservations: reservations
          .filter((r) => r.roomTypeId === rt.id)
          .map((r) => ({
            id: r.id,
            guest: `${r.guest.firstName} ${r.guest.lastName}`,
            guestShort: `${r.guest.firstName.charAt(0)}. ${r.guest.lastName}`,
            checkIn: r.checkIn.toISOString().slice(0, 10),
            checkOut: r.checkOut.toISOString().slice(0, 10),
            totalPrice: Number(r.totalPrice),
            status: r.status,
            channel: r.channel.name,
          })),
      }));
      return NextResponse.json(data);
    }

    // Room-level view: assign reservations to physical rooms
    const roomRows: Array<{
      id: string;
      label: string;
      roomType: string;
      roomTypeCode: string;
      roomTypeId: string;
      reservations: Array<{
        id: string;
        guest: string;
        guestShort: string;
        checkIn: string;
        checkOut: string;
        totalPrice: number;
        status: string;
        channel: string;
      }>;
      stopSellDates: string[];
    }> = [];

    for (const rt of roomTypes) {
      const rtReservations = reservations.filter((r) => r.roomTypeId === rt.id);
      const rooms = rt.rooms;

      // Build stop-sell date set
      const stopSellDates = rt.inventoryDays
        .filter((inv) => inv.stopSell)
        .map((inv) => inv.date.toISOString().slice(0, 10));

      // Assignment map: room.id -> assigned reservations
      const assignments = new Map<string, typeof rtReservations>();
      rooms.forEach((r) => assignments.set(r.id, []));

      // Sort reservations by check-in, assign to first available room
      const sorted = [...rtReservations].sort(
        (a, b) => a.checkIn.getTime() - b.checkIn.getTime()
      );

      for (const res of sorted) {
        let assigned = false;
        for (const room of rooms) {
          const roomRes = assignments.get(room.id)!;
          const overlaps = roomRes.some(
            (r) => r.checkIn < res.checkOut && r.checkOut > res.checkIn
          );
          if (!overlaps) {
            roomRes.push(res);
            assigned = true;
            break;
          }
        }
        // If no room available (overbooking edge case), assign to first room
        if (!assigned && rooms.length > 0) {
          assignments.get(rooms[0].id)!.push(res);
        }
      }

      for (const room of rooms) {
        const assigned = assignments.get(room.id) ?? [];
        roomRows.push({
          id: room.id,
          label: room.label,
          roomType: rt.name,
          roomTypeCode: rt.code,
          roomTypeId: rt.id,
          reservations: assigned.map((r) => ({
            id: r.id,
            guest: `${r.guest.firstName} ${r.guest.lastName}`,
            guestShort: `${r.guest.firstName.charAt(0)}. ${r.guest.lastName}`,
            checkIn: r.checkIn.toISOString().slice(0, 10),
            checkOut: r.checkOut.toISOString().slice(0, 10),
            totalPrice: Number(r.totalPrice),
            status: r.status,
            channel: r.channel.name,
          })),
          stopSellDates,
        });
      }
    }

    return NextResponse.json({ rooms: roomRows, dates });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
