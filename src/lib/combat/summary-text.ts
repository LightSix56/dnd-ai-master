// Сообщение мастеру об итоге тактического боя.
//
// В нём — только участники боя (хиты, состояния, павшие). Герои, которых в бою не было,
// идут отдельной строкой, чтобы мастер не считал их ни раненными, ни переместившимися.

export interface CombatReportInput {
  name: string;
  rounds: number;
  outcome: "victory" | "defeat" | "ended";
  survivingCombatants: Array<{
    name: string;
    type: string;
    hpCurrent: number;
    hpMax: number;
    conditions?: string[];
  }>;
  awardedXP?: number;
  xpPerPlayer?: number;
  nonParticipants?: string[];
}

const CONDITIONS_RU: Record<string, string> = {
  blinded: "ослеплён",
  charmed: "очарован",
  deafened: "оглох",
  frightened: "напуган",
  grappled: "схвачен",
  incapacitated: "недееспособен",
  invisible: "невидим",
  paralyzed: "парализован",
  petrified: "окаменел",
  poisoned: "отравлен",
  prone: "лежит",
  restrained: "опутан",
  stunned: "оглушён",
  unconscious: "без сознания",
};

export function outcomeText(outcome: CombatReportInput["outcome"]): string {
  return outcome === "victory" ? "Победа (все враги повержены)" : outcome === "defeat" ? "Поражение отряда" : "Бой завершён";
}

function fighterText(c: CombatReportInput["survivingCombatants"][number]): string {
  const states = (c.conditions ?? []).map((t) => CONDITIONS_RU[t]).filter(Boolean);
  const down = c.hpCurrent <= 0 ? "без сознания или при смерти" : "";
  const extra = [down, ...states.filter((s) => !(down && s === "без сознания"))].filter(Boolean);
  return `${c.name} (HP: ${c.hpCurrent}/${c.hpMax}${extra.length ? `, ${extra.join(", ")}` : ""})`;
}

export function buildCombatReport(summary: CombatReportInput): string {
  const fighters = summary.survivingCombatants.filter((c) => c.type === "player" || c.type === "companion");
  const survText = fighters.map(fighterText).join(", ");
  const xpNote =
    summary.xpPerPlayer && summary.xpPerPlayer > 0
      ? ` Награда участникам боя: +${summary.xpPerPlayer} XP каждому (всего ${summary.awardedXP} XP).`
      : "";
  const absent = (summary.nonParticipants ?? []).filter(Boolean);
  const absentNote = absent.length
    ? ` Не участвовали в бою: ${absent.join(", ")} — они остались там, где были по сюжету, их состояние и положение не изменились, опыта за этот бой они не получили.`
    : "";
  return `[Тактический бой '${summary.name}' завершён за ${summary.rounds} раунд(ов). Результат: ${outcomeText(summary.outcome)}.${xpNote} Состояние участников боя: ${survText || "все живы"}.${absentNote} Опиши завершение битвы и продолжение приключения.]`;
}
