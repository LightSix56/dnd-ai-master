// Контекст кампании для системного промпта мастера.
// Один источник и для сольного чата, и для сетевой комнаты: раньше комната собирала
// собственный укороченный промпт и всегда смотрела в первый акт сюжета.

import { db } from "@/lib/db";
import { parseStoryArc } from "./story-arc";
import type { CampaignContext, PlayerSummary } from "./system-prompt";

export async function loadCampaignContext(campaignId: string): Promise<CampaignContext | undefined> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return undefined;

  const players = await db.character.findMany({
    where: { campaignId, type: "player" },
    orderBy: { name: "asc" },
  });

  const partySummaries: PlayerSummary[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    race: p.race,
    class: p.class,
    subclass: p.subclass,
    level: p.level,
    background: p.background,
    personality: p.personality,
    bonds: p.bonds,
    flaws: p.flaws,
    appearance: p.appearance,
    notes: p.notes,
  }));

  return {
    name: campaign.name,
    setting: campaign.setting,
    tone: campaign.tone,
    difficulty: campaign.difficulty,
    language: campaign.language,
    dmStyle: campaign.dmStyle,
    ruleStrictness: campaign.ruleStrictness,
    startingLevel: campaign.startingLevel,
    worldDescription: campaign.worldDescription,
    customDmNotes: campaign.customDmNotes,
    pvpEnabled: campaign.pvpEnabled,
    restFrequency: campaign.restFrequency,
    partyTies: campaign.partyTies,
    partyMembers: partySummaries,
    levelFrom: campaign.levelFrom,
    levelTo: campaign.levelTo,
    storyArc: parseStoryArc(campaign.storyArc),
    currentAct: campaign.arcCurrentAct,
    playerCharacter: players[0]
      ? `${players[0].name}, ${players[0].race || "?"} ${players[0].class || "?"} ${players[0].level} ур.`
      : undefined,
  };
}
