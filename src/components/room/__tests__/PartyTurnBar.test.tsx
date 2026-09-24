import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PartyTurnBar, type PartyTurnBarProps } from "../PartyTurnBar";
import type { RoomParticipant, RoomTurn } from "@/lib/room/types";

describe("PartyTurnBar", () => {
  const mockParticipants: RoomParticipant[] = [
    {
      id: "part-1",
      roomId: "room-1",
      userId: "user-1",
      characterId: "char-1",
      characterSnapshot: {
        id: "char-1",
        name: "Торин Дубощит",
        level: 3,
        className: "Воин",
        race: "Дворф",
      },
      isHost: true,
      isReady: true,
      joinedAt: "2026-09-24T10:00:00Z",
    },
    {
      id: "part-2",
      roomId: "room-1",
      userId: "user-2",
      characterId: "char-2",
      characterSnapshot: {
        id: "char-2",
        name: "Гэндальф Серый",
        level: 5,
        className: "Волшебник",
        race: "Человек",
      },
      isHost: false,
      isReady: true,
      joinedAt: "2026-09-24T10:05:00Z",
    },
  ];

  const mockRoomTurn: RoomTurn = {
    id: "turn-1",
    roomId: "room-1",
    roundNumber: 2,
    status: "waiting",
    playerInputs: {
      "user-1": {
        userId: "user-1",
        characterName: "Торин Дубощит",
        className: "Воин",
        level: 3,
        actionText: "Атакую ближайшего орка боевым топором!",
        submittedAt: 1700000000,
      },
    },
    createdAt: "2026-09-24T10:10:00Z",
  };

  it("отрисовывает раунд и готовность игроков (1/2)", () => {
    const html = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={false}
      />
    );

    expect(html).toContain("Раунд 2 • Заявки отряда (1/2)");
  });

  it("показывает бейдж «Готов» и цитату действия для игрока, сдавшего ход", () => {
    const html = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={false}
      />
    );

    expect(html).toContain("Торин Дубощит");
    expect(html).toContain("Готов");
    expect(html).toContain("«Атакую ближайшего орка боевым топором!»");
  });

  it("показывает бейдж «Обдумывает...» для игрока, не сдавшего ход", () => {
    const html = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={false}
      />
    );

    expect(html).toContain("Гэндальф Серый");
    expect(html).toContain("Обдумывает...");
    expect(html).toContain("Ожидает хода игрока...");
  });

  it("показывает кнопку «Отправить ход сейчас» только ведущему (isHost: true), когда есть хотя бы 1 готовый, но не все готовы", () => {
    // Ведущий (isHost = true)
    const hostHtml = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={false}
      />
    );
    expect(hostHtml).toContain("Отправить ход сейчас");

    // Обычный игрок (isHost = false)
    const playerHtml = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-2"
        isHost={false}
        resolving={false}
      />
    );
    expect(playerHtml).not.toContain("Отправить ход сейчас");

    // Когда все готовы (2/2) — кнопка не должна отображаться
    const allReadyTurn: RoomTurn = {
      ...mockRoomTurn,
      playerInputs: {
        ...mockRoomTurn.playerInputs,
        "user-2": {
          userId: "user-2",
          characterName: "Гэндальф Серый",
          className: "Волшебник",
          level: 5,
          actionText: "Кастую огненный шар!",
          submittedAt: 1700000050,
        },
      },
    };
    const allReadyHtml = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={allReadyTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={false}
      />
    );
    expect(allReadyHtml).not.toContain("Отправить ход сейчас");
  });

  it("отрисовывает индикатор «Мастер оценивает действия отряда...», когда resolving === true", () => {
    const html = renderToStaticMarkup(
      <PartyTurnBar
        roomTurn={mockRoomTurn}
        participants={mockParticipants}
        currentUserId="user-1"
        isHost={true}
        resolving={true}
      />
    );

    expect(html).toContain("Мастер оценивает действия отряда и описывает события мира...");
    // Кнопка принудительного хода не должна показываться во время resolving
    expect(html).not.toContain("Отправить ход сейчас");
  });
});
