# Architecture Design: Multi-Page Routing Architecture

**Date**: 2026-09-25  
**Status**: Approved by User  
**Target Repository**: `battle+ai` (`LightSix56/dnd-ai-master`)  

---

## 1. Problem Statement & Motivation

Currently, the entire application is bundled into a single monolithic component (`DnDApp.tsx`, ~4894 lines) mounted on the root route `/` (`src/app/page.tsx`). While `src/app/room/[code]/page.tsx` exists, it simply mounts `<DnDApp initialRoomCode={roomCode} />` with the exact same monolithic shell.

This single-page approach causes severe technical and UX issues:
1. **Auto-Scroll Collisions**: When a campaign is active, chat auto-scroll (`chatEndRef.current?.scrollIntoView()`) triggers periodically or on background updates, forcibly scrolling the page down while a user is attempting to configure campaign parameters, read lobby details, or select models.
2. **Role & Cognitive Confusion**: A player joining a multiplayer table sees DM tools, campaign creation buttons, world description prompts, and arc debug panels.
3. **Session Loss on Refresh**: Refreshing on `/` resets the browser to whatever default solo campaign was in `localStorage`, losing room context unless the user remembers to navigate to `/room/[code]`.
4. **Deep Linking & Sharing**: Sending a room link to friends should lead straight to the table's lobby or game, while opening the home site should always bring the user to a clean, stable management hub.

---

## 2. Target Routing Architecture

### 2.1 Route Map

```
/
├── / (Home Hub & Dashboard)
│   ├── Join Room by Code ("TAVERN-612") -> redirects to /room/[CODE]
│   ├── Host Create Room Modal -> creates room & redirects to /room/[CODE]
│   ├── Campaigns Manager -> Continue Solo (/campaign/[id]) or Open Room (/room/[code])
│   ├── Character Manager & Importer
│   └── API & AI Model Settings Modal
│
├── /home -> Redirects to /
│
├── /room/[code] (Multiplayer Table Session)
│   ├── Lobby State: Fullscreen RoomLobby, character selection, player readiness, DM campaign binding
│   └── Active State: PartyTurnBar, cooperative turn inputs, round chat, combat grid, party sidebar
│
├── /rooms/[code] -> Redirects to /room/[code]
│
└── /campaign/[id] (Dedicated Solo Campaign Session)
    ├── Solo AI Master chat & narrative
    ├── Solo combat grid & hotbar
    └── "Open Table for Friends" button -> creates room and transitions to /room/[code]
```

---

## 3. Component Architecture & Decomposition

### 3.1 `HomeHubView` (`src/components/home/HomeHubView.tsx`)
A dedicated, lightweight dashboard component with:
- Top bar: Title, guest/user login status, Settings button (`ModelPickerModal`).
- Grid cards:
  1. **Join by Code**: Large input for code + "Присоединиться" button navigating directly to `/room/${code}`.
  2. **Create Room**: Triggering `CreateRoomModal` which calls `/api/room/create` and navigates to `/room/${room.code}`.
  3. **My Campaigns**:
     - Lists saved campaigns with name, tone, setting, level.
     - "Играть соло" -> navigates to `/campaign/${camp.id}`.
     - "Открыть стол для друзей" -> calls `/api/room/create` with `campaignId` and navigates to `/room/${room.code}`.
     - "➕ Новая кампания" -> `CreateCampaignModal`.
  4. **My Characters**:
     - Character cards with HP, AC, Class.
     - Import character modal trigger.
- **Critical Guarantee**: Zero chat messages, zero polling loops, zero auto-scroll effects. Forms remain 100% stable.

### 3.2 `RoomSessionView` (`src/components/room/RoomSessionView.tsx`)
Dedicated multiplayer table component (extracted/refactored from `DnDApp.tsx`'s room mode):
- Handles room polling (`/api/room/[code]`), participant readiness, and cooperative turn resolution.
- If `activeRoom.status !== "active"`: displays `RoomLobby` in full view.
- If `activeRoom.status === "active"`: displays:
  - Room header with room code, share link, round number, and "Выйти на главную" (`router.push('/')`).
  - `PartyTurnBar` showing readiness and player input quotes.
  - Active round chat messages with Master narrative.
  - Active combat overlay (`CombatView` / `CombatGrid`) if combat is triggered.
  - Party sidebar with participant character cards, inventory modal, and potion drinking.
  - Turn action input bar with submission and resolving states.

### 3.3 `SoloCampaignView` (`src/components/campaign/SoloCampaignView.tsx`)
Dedicated solo player session (extracted from `DnDApp.tsx`'s solo campaign mode):
- Manages solo chat with Master, scene state syncing, story arc generator.
- Header button: "👥 Открыть стол для друзей" to create a multiplayer room on the fly.
- "Вернуться в меню" navigating to `/`.

### 3.4 Shared State & Context
- `useDnDStore` (Zustand): Persists active campaign, characters, memories, events, API keys, models.
- Local storage keys: `ai_api_key`, `ai_model`, `ai_auth_mode`, `ai_base_url`.
- Supabase / guest authentication: Shared across all routes.

---

## 4. Zero-Regression Guarantees

1. **Multiplayer Cooperative Turns**: `PartyTurnBar`, turn locking, auto-resolving, `stopWhen: stepCountIs(4)` multi-step tool execution, and Master narrative generation must function identically.
2. **Combat Engine**: `CombatView`, `Hotbar`, potion bonus action drinking, and opportunity attack resolution must remain fully functional.
3. **Character Inventory**: Potion drinking in and out of combat, HP restoration, equipment unpacking, and stats deduction must work without changes.
4. **URL Deep Linking**: Opening `https://.../room/TAVERN-612` directly in a fresh tab must join the room, load participant snapshots, and render the lobby/game correctly.
5. **Backwards Compatibility**: All legacy `/` flows can still fallback or render smoothly.

---

## 5. Verification Plan

1. **TypeScript compilation**: `npx tsc --noEmit` with 0 errors.
2. **Unit & Integration tests**: Run all Vitest suites (`npx vitest run`), including all 13 room tests and combat tests.
3. **Manual Route Verification**:
   - `/` displays HomeHubView without auto-scrolling.
   - `/home` redirects to `/`.
   - `/room/[code]` joins the room and shows lobby or game.
   - `/rooms/[code]` redirects to `/room/[code]`.
   - `/campaign/[id]` loads the solo campaign session.
4. **Knowledge Graph**: Update via `graphify update .`.
5. **Git Push**: Commit and push to GitHub `origin/main` with proxy cleared.
