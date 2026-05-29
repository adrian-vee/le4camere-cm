import { prisma } from "../db";
import { decrementInventory, releaseInventory } from "../ari-store";
import type { NormalizedReservation } from "../connectivity/provider";

export async function processReservation(channelId: string, reservation: NormalizedReservation) {
  const roomType = await prisma.roomType.findUnique({
    where: { code: reservation.roomTypeCode },
  });

  if (!roomType) {
    throw new Error(`RoomType not found: ${reservation.roomTypeCode}`);
  }

  // Find or create guest
  let guest = await prisma.guest.findFirst({
    where: {
      firstName: reservation.guest.firstName,
      lastName: reservation.guest.lastName,
      email: reservation.guest.email ?? undefined,
    },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        country: reservation.guest.country,
      },
    });
  }

  // Check if reservation already exists (idempotent upsert)
  const existing = await prisma.reservation.findUnique({
    where: {
      channelId_externalReservationId: {
        channelId,
        externalReservationId: reservation.externalReservationId,
      },
    },
  });

  const previousStatus = existing?.status;

  // Upsert reservation
  const saved = await prisma.reservation.upsert({
    where: {
      channelId_externalReservationId: {
        channelId,
        externalReservationId: reservation.externalReservationId,
      },
    },
    update: {
      status: reservation.status,
      checkIn: new Date(reservation.checkIn),
      checkOut: new Date(reservation.checkOut),
      totalPrice: reservation.totalPrice,
      currency: reservation.currency,
      adults: reservation.adults,
      children: reservation.children,
      rawPayload: reservation.raw as object ?? undefined,
    },
    create: {
      channelId,
      externalReservationId: reservation.externalReservationId,
      roomTypeId: roomType.id,
      guestId: guest.id,
      checkIn: new Date(reservation.checkIn),
      checkOut: new Date(reservation.checkOut),
      status: reservation.status,
      totalPrice: reservation.totalPrice,
      currency: reservation.currency,
      adults: reservation.adults,
      children: reservation.children,
      rawPayload: reservation.raw as object ?? undefined,
    },
  });

  // Inventory adjustments based on status transitions
  if (reservation.status === "confirmed" && !previousStatus) {
    // New reservation: decrement inventory
    await decrementInventory(roomType.id, reservation.checkIn, reservation.checkOut);
  } else if (reservation.status === "cancelled" && previousStatus && previousStatus !== "cancelled") {
    // Cancellation: release inventory
    await releaseInventory(roomType.id, reservation.checkIn, reservation.checkOut);
  }

  // Write SyncLog
  await prisma.syncLog.create({
    data: {
      channelId,
      direction: "inbound",
      event: `reservation_${reservation.status}`,
      status: "success",
      payload: { externalReservationId: reservation.externalReservationId },
    },
  });

  return saved;
}

export async function enqueuePushARI(
  channelId: string,
  roomTypeCode: string,
  dateFrom: string,
  dateTo: string
) {
  return prisma.syncJob.create({
    data: {
      type: "push_ari",
      channelId,
      payload: { roomTypeCode, dateFrom, dateTo },
      status: "pending",
      scheduledAt: new Date(),
    },
  });
}
