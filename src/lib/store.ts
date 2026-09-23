// Zustand store для управления состоянием D&D приложения
import { create } from "zustand";

export interface Character {
  id: string;
  name: string;
  type: "player" | "npc" | "enemy" | "companion";
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level: number;
  background?: string | null;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  hpCurrent: number;
  hpMax: number;
  hpTemp?: number | null;
  ac: number;
  speed: number;
  profBonus: number;
  inventory: string;
  spells: string;
  appearance?: string | null;
  personality?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  isAlive: boolean;
  location?: string | null;
  inScene?: boolean;
  relation: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string | null;
  setting: string;
  tone: string;
  isActive: boolean;
  // Новые поля
  difficulty?: string;
  language?: string;
  dmStyle?: string;
  ruleStrictness?: string;
  startingLevel?: number;
  worldDescription?: string | null;
  customDmNotes?: string | null;
  pvpEnabled?: boolean;
  restFrequency?: string;
  partyTies?: string;
  // Сюжетная арка
  levelFrom?: number;
  levelTo?: number;
  arcStatus?: string;
  arcCurrentAct?: number;
  createdAt: string;
  updatedAt: string;
  characters?: Character[];
  _count?: {
    characters?: number;
    events: number;
    memories: number;
    chatMessages?: number;
  };
}

export interface Memory {
  id: string;
  category: string;
  subject: string;
  content: string;
  importance: number;
  createdAt: string;
}

export interface GameEvent {
  id: string;
  type: string;
  description: string;
  location?: string | null;
  isImportant: boolean;
  createdAt: string;
}

export interface ChatMessageUI {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: unknown[];
  toolResults?: unknown[];
  createdAt: string;
}

interface DnDState {
  // Кампания
  activeCampaign: Campaign | null;
  campaigns: Campaign[];
  setActiveCampaign: (c: Campaign | null) => void;
  setCampaigns: (cs: Campaign[]) => void;
  setCampaings: (cs: Campaign[]) => void;

  // Персонажи
  characters: Character[];
  setCharacters: (cs: Character[]) => void;

  // Память
  memories: Memory[];
  setMemories: (ms: Memory[]) => void;

  // События
  events: GameEvent[];
  setEvents: (es: GameEvent[]) => void;

  // Чат
  chatMessages: ChatMessageUI[];
  setChatMessages: (ms: ChatMessageUI[]) => void;
  addChatMessage: (m: ChatMessageUI) => void;

  // UI
  sidebarTab: "characters" | "memory" | "events" | "settings";
  setSidebarTab: (t: "characters" | "memory" | "events" | "settings") => void;

  // Настройки
  apiKey: string;
  model: string;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
}

export const useDnDStore = create<DnDState>((set) => ({
  activeCampaign: null,
  campaigns: [],
  setActiveCampaign: (c) => set({ activeCampaign: c }),
  setCampaigns: (cs) => set({ campaigns: cs }),
  setCampaings: (cs) => set({ campaigns: cs }),

  characters: [],
  setCharacters: (cs) => set({ characters: cs }),

  memories: [],
  setMemories: (ms) => set({ memories: ms }),

  events: [],
  setEvents: (es) => set({ events: es }),

  chatMessages: [],
  setChatMessages: (ms) => set({ chatMessages: ms }),
  addChatMessage: (m) =>
    set((s) => ({ chatMessages: [...s.chatMessages, m] })),

  sidebarTab: "characters",
  setSidebarTab: (t) => set({ sidebarTab: t }),

  apiKey: "",
  model: "gpt-4o-mini",
  setApiKey: (k) => set({ apiKey: k }),
  setModel: (m) => set({ model: m }),
}));
