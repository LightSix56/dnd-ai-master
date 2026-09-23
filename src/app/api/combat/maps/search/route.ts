import { NextResponse } from "next/server";
import {
  searchOpenMaps,
  getPopularTags,
} from "@/lib/combat/maps/open-map-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || undefined;
    const category = searchParams.get("category") || undefined;
    const tagsParam = searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    const maps = searchOpenMaps({ query, category, tags });
    const popularTags = getPopularTags();

    return NextResponse.json({
      maps,
      total: maps.length,
      popularTags,
    });
  } catch (error: any) {
    console.error("Error in GET /api/combat/maps/search:", error);
    return NextResponse.json(
      { error: "Failed to search open battlemaps", details: error.message },
      { status: 500 }
    );
  }
}
