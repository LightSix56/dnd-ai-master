import { describe, expect, it } from "vitest";
import { getAllCombatSpells, getAllSRDSpells } from "../srd/adapter";
import oldSrd from "../srd/data/spells.json";
import oldExpanded from "../data/expanded-combat-spells.json";

// Заклинания приходят из общей библиотеки dnd-shared и должны совпадать с прежними файлами мастера.
describe("заклинания из общей библиотеки dnd-shared", () => {
  it("SRD-заклинания совпадают с прежним файлом, запись в запись и в том же порядке", () => {
    expect(getAllSRDSpells()).toEqual(oldSrd);
  });

  it("все боевые заклинания (SRD и расширенные) совпадают с прежними файлами", () => {
    expect(getAllCombatSpells()).toEqual([...oldSrd, ...oldExpanded]);
  });
});
