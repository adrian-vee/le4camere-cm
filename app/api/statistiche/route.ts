import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "year"; // month | year | custom
    const customFrom = searchParams.get("from");
    const customTo = searchParams.get("to");

    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    if (period === "month") {
      dateFrom = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      dateTo = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    } else if (period === "custom" && customFrom && customTo) {
      dateFrom = new Date(customFrom);
      dateTo = new Date(customTo);
    } else {
      // year: last 12 months
      dateFrom = new Date(Date.UTC(now.getFullYear() - 1, now.getMonth(), 1));
      dateTo = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    }

    // All reservations in period
    const reservations = await prisma.reservation.findMany({
      where: {
        checkIn: { gte: dateFrom, lt: dateTo },
      },
      include: { channel: true },
    });

    const confirmed = reservations.filter((r) => r.status !== "cancelled");
    const cancelled = reservations.filter((r) => r.status === "cancelled");

    // Revenue
    const totalRevenue = confirmed.reduce((s, r) => s + Number(r.totalPrice), 0);
    const totalBookings = confirmed.length;
    const totalCancellations = cancelled.length;

    // Nights sold
    let totalNightsSold = 0;
    for (const r of confirmed) {
      const nights = Math.ceil(
        (r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalNightsSold += nights;
    }

    const adr = totalNightsSold > 0 ? totalRevenue / totalNightsSold : 0;

    // Monthly breakdowns
    const monthlyMap = new Map<
      string,
      { revenue: number; bookings: number; cancellations: number; nightsSold: number }
    >();

    for (const r of reservations) {
      const key = `${r.checkIn.getFullYear()}-${String(r.checkIn.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) ?? {
        revenue: 0,
        bookings: 0,
        cancellations: 0,
        nightsSold: 0,
      };
      if (r.status !== "cancelled") {
        existing.revenue += Number(r.totalPrice);
        existing.bookings += 1;
        const nights = Math.ceil(
          (r.checkOut.getTime() - r.checkIn.getTime()) / (1000 * 60 * 60 * 24)
        );
        existing.nightsSold += nights;
      } else {
        existing.cancellations += 1;
      }
      monthlyMap.set(key, existing);
    }

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        adr: data.nightsSold > 0 ? data.revenue / data.nightsSold : 0,
      }));

    // Revenue by channel
    const channelMap = new Map<string, { revenue: number; bookings: number }>();
    for (const r of confirmed) {
      const ch = r.channel.name;
      const existing = channelMap.get(ch) ?? { revenue: 0, bookings: 0 };
      existing.revenue += Number(r.totalPrice);
      existing.bookings += 1;
      channelMap.set(ch, existing);
    }
    const byChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      ...data,
    }));

    // Occupancy by month from inventory
    const inventoryData = await prisma.inventoryDay.findMany({
      where: { date: { gte: dateFrom, lt: dateTo } },
    });
    const occMonthlyMap = new Map<string, { allotment: number; booked: number }>();
    for (const inv of inventoryData) {
      const key = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, "0")}`;
      const existing = occMonthlyMap.get(key) ?? { allotment: 0, booked: 0 };
      existing.allotment += inv.allotment;
      existing.booked += inv.booked;
      occMonthlyMap.set(key, existing);
    }
    const occupancyMonthly = Array.from(occMonthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        occupancy: data.allotment > 0 ? Math.round((data.booked / data.allotment) * 100) : 0,
      }));

    // Sparkline data: last 6 months revenue+bookings+cancellations
    const sixMonthsAgo = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
    const sparkReservations = await prisma.reservation.findMany({
      where: { checkIn: { gte: sixMonthsAgo } },
    });
    const sparkMap = new Map<
      string,
      { revenue: number; bookings: number; cancellations: number }
    >();
    for (const r of sparkReservations) {
      const key = `${r.checkIn.getFullYear()}-${String(r.checkIn.getMonth() + 1).padStart(2, "0")}`;
      const existing = sparkMap.get(key) ?? { revenue: 0, bookings: 0, cancellations: 0 };
      if (r.status !== "cancelled") {
        existing.revenue += Number(r.totalPrice);
        existing.bookings += 1;
      } else {
        existing.cancellations += 1;
      }
      sparkMap.set(key, existing);
    }
    const sparkline = Array.from(sparkMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    return NextResponse.json({
      totalRevenue,
      totalBookings,
      totalCancellations,
      totalNightsSold,
      adr,
      monthly,
      byChannel,
      occupancyMonthly,
      sparkline,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
