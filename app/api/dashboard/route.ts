import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
    const dayAfterUTC = new Date(tomorrowUTC);
    dayAfterUTC.setUTCDate(dayAfterUTC.getUTCDate() + 1);

    // Month boundaries
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    // KPIs
    const [arrivals, departures, inHouse, totalRooms] = await Promise.all([
      prisma.reservation.count({
        where: { checkIn: todayUTC, status: { not: "cancelled" } },
      }),
      prisma.reservation.count({
        where: { checkOut: todayUTC, status: { not: "cancelled" } },
      }),
      prisma.reservation.count({
        where: {
          checkIn: { lte: todayUTC },
          checkOut: { gt: todayUTC },
          status: { not: "cancelled" },
        },
      }),
      prisma.room.count(),
    ]);

    // Occupancy from InventoryDay
    const todayInventory = await prisma.inventoryDay.findMany({
      where: { date: todayUTC },
    });
    const totalAllotment = todayInventory.reduce((s, i) => s + i.allotment, 0);
    const totalBooked = todayInventory.reduce((s, i) => s + i.booked, 0);
    const occupancy = totalAllotment > 0 ? Math.round((totalBooked / totalAllotment) * 100) : 0;

    // Events: check-ins and check-outs for today and tomorrow
    const events = await prisma.reservation.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [
          { checkIn: { gte: todayUTC, lt: dayAfterUTC } },
          { checkOut: { gte: todayUTC, lt: dayAfterUTC } },
        ],
      },
      include: { guest: true, roomType: true },
      orderBy: { checkIn: "asc" },
    });

    const eventList = events.map((r) => {
      const isCheckIn =
        r.checkIn.getTime() >= todayUTC.getTime() &&
        r.checkIn.getTime() < dayAfterUTC.getTime();
      const isCheckOut =
        r.checkOut.getTime() >= todayUTC.getTime() &&
        r.checkOut.getTime() < dayAfterUTC.getTime();
      const nights = Math.ceil(
        (r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: r.id,
        guest: `${r.guest.firstName} ${r.guest.lastName}`,
        roomType: r.roomType.name,
        type: isCheckIn ? "checkin" : isCheckOut ? "checkout" : "checkin",
        date: isCheckIn
          ? r.checkIn.toISOString().slice(0, 10)
          : r.checkOut.toISOString().slice(0, 10),
        adults: r.adults,
        children: r.children,
        nights,
      };
    });

    // Monthly KPIs
    const monthReservations = await prisma.reservation.findMany({
      where: {
        checkIn: { gte: monthStart, lt: monthEnd },
        status: { not: "cancelled" },
      },
    });
    const revenueMonth = monthReservations.reduce((s, r) => s + Number(r.totalPrice), 0);
    const bookingsMonth = monthReservations.length;

    // Monthly occupancy average
    const monthInventory = await prisma.inventoryDay.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
    });
    const monthAllotment = monthInventory.reduce((s, i) => s + i.allotment, 0);
    const monthBooked = monthInventory.reduce((s, i) => s + i.booked, 0);
    const occupancyMonth = monthAllotment > 0 ? Math.round((monthBooked / monthAllotment) * 100) : 0;

    // Activities feed: last 15 reservations with channel info
    const recentActivities = await prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      include: { guest: true, roomType: true, channel: true },
      take: 15,
    });

    const activities = recentActivities.map((r) => ({
      id: r.id,
      guest: `${r.guest.firstName} ${r.guest.lastName}`,
      roomType: r.roomType.name,
      channel: r.channel.name,
      totalPrice: Number(r.totalPrice),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));

    // Channel status
    const channels = await prisma.channel.findMany({
      include: {
        syncLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const channelStatus = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      enabled: ch.enabled,
      lastSync: ch.syncLogs[0]
        ? {
            status: ch.syncLogs[0].status,
            createdAt: ch.syncLogs[0].createdAt.toISOString(),
          }
        : null,
    }));

    return NextResponse.json({
      arrivals,
      departures,
      inHouse,
      totalRooms,
      occupancy,
      occupancyMonth,
      revenueMonth,
      bookingsMonth,
      events: eventList,
      activities,
      channelStatus,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
