// API: Поиск по компендиуму 2,875 монстров D&D 5e
import { loadDefaultManifest, loadMonsterDefinition } from "@/lib/combat/encounters/encounter-generator";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();

    if (slug) {
      const manifest = loadDefaultManifest();
      const entry = manifest.find((m) => m.slug.toLowerCase() === slug || m.id.toLowerCase() === slug);
      if (entry) {
        const monster = loadMonsterDefinition(entry.slug, entry);
        return Response.json({ monster, entry });
      }
      return Response.json({ error: "Монстр не найден" }, { status: 404 });
    }

    const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").trim().toLowerCase();
    const type = (url.searchParams.get("type") || "").trim().toLowerCase();
    const crMinStr = url.searchParams.get("crMin");
    const crMaxStr = url.searchParams.get("crMax");
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

    const manifest = loadDefaultManifest();

    let filtered = manifest;

    if (q) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.nameEn.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q)
      );
    }

    if (type && type !== "all") {
      filtered = filtered.filter((m) => m.type.toLowerCase() === type);
    }

    if (crMinStr !== null && crMinStr !== "") {
      const crMin = parseFloat(crMinStr);
      if (!isNaN(crMin)) {
        filtered = filtered.filter((m) => m.challengeRating >= crMin);
      }
    }

    if (crMaxStr !== null && crMaxStr !== "") {
      const crMax = parseFloat(crMaxStr);
      if (!isNaN(crMax)) {
        filtered = filtered.filter((m) => m.challengeRating <= crMax);
      }
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return Response.json({
      total,
      limit,
      offset,
      monsters: paged,
    });
  } catch (error) {
    console.error("[combat/monsters GET] error:", error);
    return Response.json(
      { error: "Не удалось выполнить поиск монстров", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
