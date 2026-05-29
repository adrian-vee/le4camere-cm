import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";

function toDateOnly(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function dateRange(from: Date | string, to: Date | string): Date[] {
  const start = toDateOnly(from);
  const end = toDateOnly(to);
  const dates: Date[] = [];
  const current = new Date(start);
  while (current < end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function getAvailability(roomTypeId: string, dateFrom: Date | string, dateTo: Date | string) {
  return prisma.inventoryDay.findMany({
    where: {
      roomTypeId,
      date: { gte: toDateOnly(dateFrom), lte: toDateOnly(dateTo) },
    },
    orderBy: { date: "asc" },
  });
}

export async function updateAvailability(
  roomTypeId: string,
  date: Date | string,
  changes: { allotment?: number; stopSell?: boolean }
) {
  const d = toDateOnly(date);
  return prisma.inventoryDay.update({
    where: { roomTypeId_date: { roomTypeId, date: d } },
    data: changes,
  });
}

export async function getRates(ratePlanId: string, dateFrom: Date | string, dateTo: Date | string) {
  return prisma.rateDay.findMany({
    where: {
      ratePlanId,
      date: { gte: toDateOnly(dateFrom), lte: toDateOnly(dateTo) },
    },
    orderBy: { date: "asc" },
  });
}

export async function updateRates(
  ratePlanId: string,
  date: Date | string,
  changes: {
    price?: number | Prisma.Decimal;
    minStay?: number | null;
    maxStay?: number | null;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
    stopSell?: boolean;
  }
) {
  const d = toDateOnly(date);
  return prisma.rateDay.update({
    where: { ratePlanId_date: { ratePlanId, date: d } },
    data: changes,
  });
}

export async function decrementInventory(roomTypeId: string, checkIn: Date | string, checkOut: Date | string) {
  const dates = dateRange(checkIn, checkOut);

  return prisma.$transaction(async (tx) => {
    for (const date of dates) {
      const inv = await tx.inventoryDay.findUnique({
        where: { roomTypeId_date: { roomTypeId, date } },
      });

      if (!inv) {
        throw new Error(`No inventory record for ${roomTypeId} on ${date.toISOString().slice(0, 10)}`);
      }

      if (inv.booked >= inv.allotment) {
        throw new Error(
          `Overbooking: ${roomTypeId} on ${date.toISOString().slice(0, 10)} — booked ${inv.booked}/${inv.allotment}`
        );
      }

      await tx.inventoryDay.update({
        where: { roomTypeId_date: { roomTypeId, date } },
        data: { booked: { increment: 1 } },
      });
    }

    await checkStopSellInternal(tx, roomTypeId, dates);
  });
}

export async function releaseInventory(roomTypeId: string, checkIn: Date | string, checkOut: Date | string) {
  const dates = dateRange(checkIn, checkOut);

  return prisma.$transaction(async (tx) => {
    for (const date of dates) {
      await tx.inventoryDay.update({
        where: { roomTypeId_date: { roomTypeId, date } },
        data: { booked: { decrement: 1 } },
      });
    }

    // Re-open stopSell if availability restored
    for (const date of dates) {
      const inv = await tx.inventoryDay.findUnique({
        where: { roomTypeId_date: { roomTypeId, date } },
      });
      if (inv && inv.booked < inv.allotment && inv.stopSell) {
        await tx.inventoryDay.update({
          where: { roomTypeId_date: { roomTypeId, date } },
          data: { stopSell: false },
        });
      }
    }
  });
}

async function checkStopSellInternal(
  tx: Prisma.TransactionClient,
  roomTypeId: string,
  dates: Date[]
) {
  for (const date of dates) {
    const inv = await tx.inventoryDay.findUnique({
      where: { roomTypeId_date: { roomTypeId, date } },
    });
    if (inv && inv.booked >= inv.allotment) {
      await tx.inventoryDay.update({
        where: { roomTypeId_date: { roomTypeId, date } },
        data: { stopSell: true },
      });
    }
  }
}

export async function checkStopSell(roomTypeId: string, dates: (Date | string)[]) {
  const normalizedDates = dates.map(toDateOnly);
  return prisma.$transaction(async (tx) => {
    await checkStopSellInternal(tx, roomTypeId, normalizedDates);
  });
}
