import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { fakePrisma } from "@/lib/testing/fake-prisma";
import { generatePartyAwareAct1 } from "@/lib/ai/party-arc-generator";

const state = vi.hoisted(() => ({ prisma: null as any }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, prop) => state.prisma[prop as string] }),
}));
vi.mock("@/lib/ai/party-arc-generator", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/party-arc-generator")>()),
  generatePartyAwareAct1: vi.fn().mockRejectedValue(new Error("no llm in tests")),
}));

import { RoomService } from "../room-service";

const HOST = "user-host";
const GUEST = "user-guest";
const TOXIN = "11111111-1111-4111-8111-111111111111";
const FANG = "22222222-2222-4222-8222-222222222222";
const ROOM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const toxinSheet = { name: "Токсин", className: "Плут", race: "Полурослик", level: 1, hpMax: 9, hpCurrent: 9 };
const fangSheet = { name: "Клык", className: "Воин", race: "Полуорк", level: 1, hpMax: 12, hpCurrent: 12 };

function setup() {
  const supabase = fakeSupabase({
    unique: { characters: [["source_character_id", "campaign_id"]] },
    tables: {
      rooms: [
        {
          id: ROOM,
          code: "DRAGON-42",
          name: "Стол",
          host_user_id: HOST,
          status: "lobby",
          starting_level: 1,
          max_level: 20,
          campaign_settings: {},
        },
      ],
      room_participants: [],
      characters: [
        { id: TOXIN, user_id: HOST, name: "Токсин", data: toxinSheet, portrait_url: null, revision: 0, campaign_id: null, campaign_name: null, source_character_id: null },
        { id: FANG, user_id: GUEST, name: "Клык", data: fangSheet, portrait_url: null, revision: 0, campaign_id: null, campaign_name: null, source_character_id: null },
      ],
    },
  });
  state.prisma = fakePrisma({ campaign: [] });
  return { service: new RoomService(supabase as any) };
}

describe("startRoomCampaign: параметры окна сохраняются в кампании и уходят в генератор", () => {
  beforeEach(() => {
    state.prisma = fakePrisma();
    vi.mocked(generatePartyAwareAct1).mockClear();
  });

  it("writes the normalized setup into the campaign and passes it to the Act 1 generator", async () => {
    const { service } = setup();
    await service.joinRoom({ roomId: ROOM, userId: HOST, characterId: TOXIN, isHost: true });
    await service.joinRoom({ roomId: ROOM, userId: GUEST, characterId: FANG });

    const result = await service.startRoomCampaign("DRAGON-42", HOST, {
      title: "Встреча",
      setting: "Forgotten Realms",
      tone: "Мрачный и напряженный",
      difficulty: "deadly",
      dmStyle: "tactical",
      partyTies: "friends",
      startingSituation: "patron_contract",
      levelTo: 10,
      customDmNotes: "Склеп с нежитью",
    } as any);

    const campaign = state.prisma.campaign.rows.find((c: any) => c.id === result.campaignId);
    expect(campaign).toMatchObject({
      tone: "dark",
      difficulty: "brutal",
      dmStyle: "tactical",
      partyTies: "friends",
      startingSituation: "patron_contract",
      levelTo: 10,
      worldDescription: null,
      name: "Встреча",
      setting: "Forgotten Realms",
      customDmNotes: "Склеп с нежитью",
    });

    const arcParams = vi.mocked(generatePartyAwareAct1).mock.calls[0][0];
    expect(arcParams).toMatchObject({
      partyTies: "friends",
      dmStyle: "tactical",
      startingSituation: "patron_contract",
      tone: "dark",
      difficulty: "brutal",
    });
  });
});
