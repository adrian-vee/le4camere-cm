import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      return NextResponse.json({ error: "Canale non trovato" }, { status: 404 });
    }

    const updated = await prisma.channel.update({
      where: { id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return NextResponse.json({ id: updated.id, enabled: updated.enabled });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        mappings: { include: { roomType: true, ratePlan: true } },
        syncLogs: { orderBy: { createdAt: "desc" }, take: 20 },
        syncJobs: { where: { status: "failed" }, take: 10 },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Canale non trovato" }, { status: 404 });
    }

    return NextResponse.json({
      id: channel.id,
      name: channel.name,
      providerType: channel.providerType,
      enabled: channel.enabled,
      mappings: channel.mappings.map((m) => ({
        id: m.id,
        roomType: m.roomType.name,
        ratePlan: m.ratePlan.name,
        externalRoomId: m.externalRoomId,
        externalRateId: m.externalRateId,
      })),
      syncLogs: channel.syncLogs.map((l) => ({
        event: l.event,
        status: l.status,
        direction: l.direction,
        createdAt: l.createdAt.toISOString(),
        payload: l.payload,
      })),
      failedJobs: channel.syncJobs.map((j) => ({
        id: j.id,
        type: j.type,
        lastError: j.lastError,
        attempts: j.attempts,
        createdAt: j.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
