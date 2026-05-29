import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ROOM_TYPES = [
  { name: "Doppia Standard", code: "DBL-STD", baseOccupancy: 2, maxOccupancy: 2, totalUnits: 5, basePrice: 89 },
  { name: "Matrimoniale Superior", code: "MAT-SUP", baseOccupancy: 2, maxOccupancy: 3, totalUnits: 4, basePrice: 109 },
  { name: "Tripla", code: "TRP", baseOccupancy: 3, maxOccupancy: 3, totalUnits: 3, basePrice: 129 },
  { name: "Singola", code: "SGL", baseOccupancy: 1, maxOccupancy: 1, totalUnits: 1, basePrice: 69 },
] as const;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function main() {
  console.log("Seeding database...");

  const today = toDateOnly(new Date());
  let roomNumber = 101;

  for (const rt of ROOM_TYPES) {
    const roomType = await prisma.roomType.upsert({
      where: { code: rt.code },
      update: { name: rt.name, baseOccupancy: rt.baseOccupancy, maxOccupancy: rt.maxOccupancy, totalUnits: rt.totalUnits },
      create: { name: rt.name, code: rt.code, baseOccupancy: rt.baseOccupancy, maxOccupancy: rt.maxOccupancy, totalUnits: rt.totalUnits },
    });

    console.log(`  RoomType: ${roomType.name} (${roomType.code})`);

    // Create physical rooms
    for (let i = 0; i < rt.totalUnits; i++) {
      const label = `Camera ${roomNumber}`;
      const existingRoom = await prisma.room.findFirst({
        where: { roomTypeId: roomType.id, label },
      });
      if (!existingRoom) {
        await prisma.room.create({
          data: { roomTypeId: roomType.id, label },
        });
      }
      roomNumber++;
    }

    // Create base RatePlan
    const ratePlanCode = `${rt.code}-BASE`;
    const ratePlan = await prisma.ratePlan.upsert({
      where: { code: ratePlanCode },
      update: { name: `${rt.name} - Base`, currency: "EUR" },
      create: {
        roomTypeId: roomType.id,
        name: `${rt.name} - Base`,
        code: ratePlanCode,
        currency: "EUR",
      },
    });

    console.log(`    RatePlan: ${ratePlan.code}`);

    // Create InventoryDay and RateDay for 365 days
    for (let d = 0; d < 365; d++) {
      const date = addDays(today, d);

      await prisma.inventoryDay.upsert({
        where: { roomTypeId_date: { roomTypeId: roomType.id, date } },
        update: { allotment: rt.totalUnits },
        create: { roomTypeId: roomType.id, date, allotment: rt.totalUnits, booked: 0, stopSell: false },
      });

      await prisma.rateDay.upsert({
        where: { ratePlanId_date: { ratePlanId: ratePlan.id, date } },
        update: { price: rt.basePrice },
        create: { ratePlanId: ratePlan.id, date, price: rt.basePrice },
      });
    }

    console.log(`    365 days of inventory & rates created`);
  }

  // Create mock channel
  const channel = await prisma.channel.upsert({
    where: { id: "mock-channel" },
    update: {},
    create: {
      id: "mock-channel",
      name: "direct",
      providerType: "mock",
      enabled: true,
    },
  });

  console.log(`  Channel: ${channel.name} (${channel.providerType})`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
