// API: получить активный бой
import { db } from "@/lib/db";
import { hydrateCombat } from "@/lib/combat/serialize";
import { RoomService } from "@/lib/room/room-service";
import os from "os";

function getLanIps(): { local: string | null; radmin: string | null; all: string[] } {
  const interfaces = os.networkInterfaces();
  const all: string[] = [];
  let preferredLocal: string | null = null;
  let preferredRadmin: string | null = null;

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        all.push(iface.address);
        if (iface.address.startsWith("26.") || name.toLowerCase().includes("radmin")) {
          if (!preferredRadmin) preferredRadmin = iface.address;
        } else if (
          iface.address.startsWith("192.168.") ||
          iface.address.startsWith("10.") ||
          iface.address.startsWith("172.")
        ) {
          if (!preferredLocal) preferredLocal = iface.address;
        }
      }
    }
  }

  return {
    local: preferredLocal || all.find((ip) => !ip.startsWith("26.")) || null,
    radmin: preferredRadmin || all.find((ip) => ip.startsWith("26.")) || null,
    all,
  };
}

function getHostPort(req: Request): number {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const parts = host.split(":");
  if (parts.length > 1) {
    const p = parseInt(parts[1], 10);
    if (!isNaN(p) && p > 0) return p;
  }
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return 3000;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let campaignId = url.searchParams.get("campaignId");
    const roomCode = url.searchParams.get("roomCode") || url.searchParams.get("code");

    if (!campaignId && roomCode) {
      try {
        const roomService = new RoomService();
        const room = await roomService.getRoomByCode(roomCode);
        if (room?.campaignId) {
          campaignId = room.campaignId;
        }
      } catch {
        // ignore
      }
    }

    const where: { status: string; campaignId?: string } = { status: "active" };
    if (campaignId) {
      where.campaignId = campaignId;
    }

    const row = await db.combat.findFirst({
      where,
      orderBy: { updatedAt: "desc" },
      include: { combatants: true, mapElements: true },
    });

    const ips = getLanIps();
    const port = getHostPort(req);
    return Response.json({
      combat: row ? hydrateCombat(row) : null,
      lanIp: ips.local,
      radminIp: ips.radmin,
      allIps: ips.all,
      port,
    });
  } catch (error) {
    console.error("[combat/active] error:", error);
    return Response.json({ error: "Не удалось загрузить бой" }, { status: 500 });
  }
}
