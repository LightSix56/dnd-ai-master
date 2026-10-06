// Зоны появления для общего плана карты — та же логика, что у пещеры.

import type { SpawnZoneDefinition } from "../maps/types";
import type { ProcgenLayout } from "./layout";
import type { CellKind } from "./markup";
import { buildZonesFromAreas } from "./zones";

export function buildAreaZones(layout: ProcgenLayout, cells: CellKind[][]): SpawnZoneDefinition[] | null {
  return buildZonesFromAreas(layout.areas, layout.flankAreas, cells);
}
