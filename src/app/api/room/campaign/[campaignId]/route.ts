import { NextResponse } from "next/server";
import { RoomService } from "@/lib/room/room-service";

export async function GET(
  _req: Request,
  props: { params: Promise<{ campaignId: string }> }
) {
  try {
    const params = await props.params;
    const campaignId = params.campaignId?.trim();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
    }

    const roomService = new RoomService();
    const room = await roomService.getActiveRoomByCampaignId(campaignId);
    return NextResponse.json({ room }, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/room/campaign/[campaignId] GET] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ campaignId: string }> }
) {
  try {
    const params = await props.params;
    const campaignId = params.campaignId?.trim();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
    }

    const roomService = new RoomService();
    const success = await roomService.closeRoomByCampaignId(campaignId);
    return NextResponse.json({ success }, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/room/campaign/[campaignId] DELETE] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
