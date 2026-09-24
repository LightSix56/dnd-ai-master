import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateText } from "ai";
import { GET as getTurn, POST as submitTurnAction } from "../[code]/turn/route";
import { POST as resolveTurnPost } from "../[code]/turn/resolve/route";

vi.mock("@/lib/supabase/client", () => {
  return {
    getAuthUserFromRequest: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
    getSupabaseServerClient: vi.fn(),
  };
});

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "Мастер описывает исход раунда." }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chatMessage: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/lib/room/room-service", () => {
  return {
    RoomService: vi.fn().mockImplementation(() => ({
      getRoomByCode: vi.fn(),
      getActiveTurn: vi.fn(),
      submitPlayerAction: vi.fn(),
      resolveRoomTurn: vi.fn(),
      lockTurnForResolving: vi.fn().mockResolvedValue(true),
      unlockTurnFromResolving: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { getAuthUserFromRequest } from "@/lib/supabase/client";
import { RoomService } from "@/lib/room/room-service";

describe("Room Turn API Routes (Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/room/[code]/turn", () => {
    it("returns 404 if room not found", async () => {
      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn");
      const res = await getTurn(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(404);
    });

    it("returns active turn for room", async () => {
      const mockTurn = {
        id: "turn-1",
        roomId: "room-1",
        roundNumber: 1,
        status: "waiting",
        playerInputs: {},
      };
      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({ id: "room-1", code: "DRAGON-1" }),
        getActiveTurn: vi.fn().mockResolvedValue(mockTurn),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn");
      const res = await getTurn(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.turn.id).toBe("turn-1");
      expect(json.turn.roundNumber).toBe(1);
    });
  });

  describe("POST /api/room/[code]/turn", () => {
    it("returns 401 if unauthenticated", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: null,
        error: "Unauthorized",
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn", {
        method: "POST",
        body: JSON.stringify({ actionText: "Атакую мечом" }),
      });
      const res = await submitTurnAction(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(401);
    });

    it("returns 400 if actionText is missing", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-1" } as any,
        error: null,
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn", {
        method: "POST",
        body: JSON.stringify({ actionText: "   " }),
      });
      const res = await submitTurnAction(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.toLowerCase()).toContain("действие");
    });

    it("returns 403 if user is not in room participants", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-unknown" } as any,
        error: null,
      });

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          participants: [{ userId: "user-1" }],
        }),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn", {
        method: "POST",
        body: JSON.stringify({ actionText: "Атакую мечом" }),
      });
      const res = await submitTurnAction(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(403);
    });

    it("submits action and returns updated turn when party is not fully ready", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-1" } as any,
        error: null,
      });

      const mockTurn = {
        id: "turn-1",
        roomId: "room-1",
        roundNumber: 1,
        status: "waiting",
        playerInputs: {
          "user-1": {
            userId: "user-1",
            characterName: "Торин",
            actionText: "Атакую мечом",
            submittedAt: 12345,
          },
        },
      };

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          participants: [
            {
              userId: "user-1",
              characterSnapshot: { name: "Торин", className: "Воин" },
            },
            {
              userId: "user-2",
              characterSnapshot: { name: "Гэндальф", className: "Волшебник" },
            },
          ],
        }),
        submitPlayerAction: vi.fn().mockResolvedValue(mockTurn),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn", {
        method: "POST",
        body: JSON.stringify({ actionText: "Атакую мечом" }),
      });
      const res = await submitTurnAction(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.resolved).toBe(false);
      expect(json.turn.playerInputs["user-1"].characterName).toBe("Торин");
      expect(json.readiness.isAllReady).toBe(false);
      expect(json.readiness.readyCount).toBe(1);
      expect(json.readiness.totalCount).toBe(2);
    });

    it("auto-resolves turn when all participants have submitted actions", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-1" } as any,
        error: null,
      });

      const mockTurn = {
        id: "turn-1",
        roomId: "room-1",
        roundNumber: 1,
        status: "waiting",
        playerInputs: {
          "user-1": {
            userId: "user-1",
            characterName: "Торин",
            actionText: "Атакую мечом",
            submittedAt: 12345,
          },
        },
      };

      const mockCompleted = {
        id: "turn-1",
        roundNumber: 1,
        status: "completed",
        dmResponse: "Мастер описывает исход раунда.",
      };
      const mockNext = {
        id: "turn-2",
        roundNumber: 2,
        status: "waiting",
        playerInputs: {},
      };

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          participants: [
            {
              userId: "user-1",
              characterSnapshot: { name: "Торин", className: "Воин" },
            },
          ],
        }),
        submitPlayerAction: vi.fn().mockResolvedValue(mockTurn),
        resolveRoomTurn: vi.fn().mockImplementation((_roomId, narrative) =>
          Promise.resolve({
            completedTurn: { ...mockCompleted, dmResponse: narrative },
            nextTurn: mockNext,
          })
        ),
        lockTurnForResolving: vi.fn().mockResolvedValue(true),
        unlockTurnFromResolving: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn", {
        method: "POST",
        body: JSON.stringify({ actionText: "Атакую мечом", apiKey: "test-key" }),
      });
      const res = await submitTurnAction(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.resolved).toBe(true);
      expect(json.completedTurn.status).toBe("completed");
      expect(json.nextTurn.roundNumber).toBe(2);
      expect(json.dmResponse).toBe("Мастер описывает исход раунда.");
    });
  });

  describe("POST /api/room/[code]/turn/resolve", () => {
    it("returns 403 if caller is not the host", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-2" } as any,
        error: null,
      });

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          hostUserId: "user-1",
        }),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn/resolve", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await resolveTurnPost(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(403);
    });

    it("resolves turn with DM narrative and advances to next round", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "user-1" } as any,
        error: null,
      });

      const mockCompleted = {
        id: "turn-1",
        roundNumber: 1,
        status: "completed",
        dmResponse: "Удар сотрясает своды пещеры.",
      };
      const mockNext = {
        id: "turn-2",
        roundNumber: 2,
        status: "waiting",
        playerInputs: {},
      };

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          hostUserId: "user-1",
        }),
        getActiveTurn: vi.fn().mockResolvedValue({
          id: "turn-1",
          roundNumber: 1,
          playerInputs: {
            "user-1": { userId: "user-1", characterName: "Торин", actionText: "Бью" },
          },
        }),
        resolveRoomTurn: vi.fn().mockResolvedValue({
          completedTurn: mockCompleted,
          nextTurn: mockNext,
        }),
        lockTurnForResolving: vi.fn().mockResolvedValue(true),
        unlockTurnFromResolving: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn/resolve", {
        method: "POST",
        body: JSON.stringify({
          dmResponse: "Удар сотрясает своды пещеры.",
        }),
      });
      const res = await resolveTurnPost(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.completedTurn.status).toBe("completed");
      expect(json.nextTurn.roundNumber).toBe(2);
    });

    it("automatically identifies AFK participants who have not submitted their action", async () => {
      vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
        user: { id: "host-1" } as any,
        error: null,
      });

      const mockCompleted = {
        id: "turn-1",
        roundNumber: 1,
        status: "completed",
        dmResponse: "Мастер описывает исход раунда.",
      };
      const mockNext = {
        id: "turn-2",
        roundNumber: 2,
        status: "waiting",
        playerInputs: {},
      };

      const mockService = {
        getRoomByCode: vi.fn().mockResolvedValue({
          id: "room-1",
          code: "DRAGON-1",
          hostUserId: "host-1",
          participants: [
            {
              userId: "host-1",
              characterSnapshot: { name: "Торин", className: "Воин" },
            },
            {
              userId: "player-2",
              characterSnapshot: { name: "Эльронд", className: "Маг" },
            },
          ],
        }),
        getActiveTurn: vi.fn().mockResolvedValue({
          id: "turn-1",
          roundNumber: 1,
          playerInputs: {
            "host-1": { userId: "host-1", characterName: "Торин", actionText: "Атакую топором", submittedAt: 100 },
          },
        }),
        resolveRoomTurn: vi.fn().mockResolvedValue({
          completedTurn: mockCompleted,
          nextTurn: mockNext,
        }),
        lockTurnForResolving: vi.fn().mockResolvedValue(true),
        unlockTurnFromResolving: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RoomService).mockImplementation(function () {
        return mockService as any;
      });

      const req = new Request("http://localhost/api/room/DRAGON-1/turn/resolve", {
        method: "POST",
        body: JSON.stringify({ apiKey: "test-key" }),
      });
      const res = await resolveTurnPost(req, { params: Promise.resolve({ code: "DRAGON-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.completedTurn.status).toBe("completed");

      // Verify that generateText was called with a prompt mentioning AFK defensive stance for Эльронд
      const calls = vi.mocked(generateText).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].prompt).toContain("Эльронд (Маг) [В ожидании/защитная стойка]");
    });
  });
});
