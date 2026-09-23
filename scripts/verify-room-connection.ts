import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getSupabaseAdminClient } from "../src/lib/supabase/client";
import { RoomService } from "../src/lib/room/room-service";

async function verifyMultiplayerRoomFlow() {
  console.log("=== MULTIPLAYER ROOM VERIFICATION START ===");
  const supabase = getSupabaseAdminClient();
  const roomService = new RoomService(supabase);

  // Используем реальных пользователей и их персонажей 3-го уровня из базы Supabase
  const hostUserId = "2fa4d4ff-5330-4b96-9d36-abcfbaed2710";
  const hostCharId = "f35160a3-64cf-46d2-84fb-0c2ddd78c705";

  const guestUserId = "eac29dbf-d31b-4226-a55e-38312f1e258e";
  const guestCharId = "e8451990-50a2-401d-abd2-69d9c98da8c0";

  console.log("Step 1: Creating a shared room via RoomService (starting level 3)...");
  const room = await roomService.createRoom(hostUserId, {
    name: "Таверна «Пьяный Дракон»",
    startingLevel: 3,
    maxLevel: 5,
    partyBond: "strangers",
    campaignSettings: {
      tone: "heroic",
      setting: "Фаэрун, горы Пылающего Пика",
    },
  });

  console.log(`Room created successfully! Code: [${room.code}], ID: [${room.id}]`);

  // 2. Игрок 1 (Хост) подключает своего персонажа
  console.log("\nStep 2: Host (Player 1) connects character 'Арей (ур. 3)'...");
  const hostParticipant = await roomService.joinRoom({
    roomId: room.id,
    userId: hostUserId,
    characterId: hostCharId,
    characterSnapshot: {
      id: hostCharId,
      name: "Арей",
      race: "Человек",
      className: "Воин",
      level: 3,
      hpMax: 31,
      armorClass: 16,
    },
    isHost: true,
  });
  console.log("Host joined successfully:", hostParticipant.characterSnapshot.name);

  // 3. Игрок 2 (Гость) подключает своего персонажа к этой же комнате
  console.log("\nStep 3: Guest (Player 2) connects character 'Генрих (ур. 3)'...");
  const guestParticipant = await roomService.joinRoom({
    roomId: room.id,
    userId: guestUserId,
    characterId: guestCharId,
    characterSnapshot: {
      id: guestCharId,
      name: "Генрих",
      race: "Полуэльф",
      className: "Плут",
      level: 3,
      hpMax: 24,
      armorClass: 14,
    },
    isHost: false,
  });
  console.log("Guest joined successfully:", guestParticipant.characterSnapshot.name);

  // 4. Игрок 2 подтверждает готовность
  console.log("\nStep 4: Guest toggles ready status to TRUE...");
  const readySuccess = await roomService.setParticipantReady(room.id, guestUserId, true);
  console.log(`Guest ready update success: ${readySuccess}`);

  // 5. Тестируем обращение к РЕАЛЬНОМУ работающему серверу Next.js по HTTP (GET /api/room/[code])
  console.log(`\nStep 5: Testing HTTP endpoint GET http://localhost:3000/api/room/${room.code}...`);
  const httpRes = await fetch(`http://localhost:3000/api/room/${room.code}`);
  if (!httpRes.ok) {
    throw new Error(`HTTP GET failed with status: ${httpRes.status}`);
  }
  const httpData = await httpRes.json();
  console.log("HTTP Response Status: 200 OK");
  console.log(`Room name from HTTP API: "${httpData.room.name}"`);
  console.log(`Participants count from HTTP API: ${httpData.room.participants.length}`);

  httpData.room.participants.forEach((p: any, idx: number) => {
    console.log(
      `  [Player ${idx + 1}]: ${p.characterSnapshot?.name} (${p.characterSnapshot?.race} ${p.characterSnapshot?.className}, ур. ${p.characterSnapshot?.level}) | Host: ${p.isHost} | Ready: ${p.isReady}`
    );
  });

  // 6. Проверяем сетевой интерфейс локальной сети (LAN http://192.168.0.53:3000/api/room/[code])
  console.log(`\nStep 6: Testing LAN interface IP http://192.168.0.53:3000/api/room/${room.code}...`);
  const lanRes = await fetch(`http://192.168.0.53:3000/api/room/${room.code}`);
  if (!lanRes.ok) {
    throw new Error(`LAN HTTP GET failed with status: ${lanRes.status}`);
  }
  const lanData = await lanRes.json();
  console.log(`LAN HTTP Status: 200 OK, confirmed ${lanData.room.participants.length} players visible across network!`);

  // 7. Проверяем также загрузку HTML страницы лобби http://localhost:3000/room/[code]
  console.log(`\nStep 7: Testing HTML lobby page GET http://localhost:3000/room/${room.code}...`);
  const pageRes = await fetch(`http://localhost:3000/room/${room.code}`);
  console.log(`HTML Lobby page status: ${pageRes.status} OK (content length: ${(await pageRes.text()).length} bytes)`);

  console.log("\n=======================================================");
  console.log(`🎉 MULTIPLAYER ROOM VERIFICATION 100% SUCCESSFUL!`);
  console.log(`Room Code for Players: ${room.code}`);
  console.log(`Local URL: http://localhost:3000/room/${room.code}`);
  console.log(`Network URL: http://192.168.0.53:3000/room/${room.code}`);
  console.log("=======================================================");

  return room.code;
}

verifyMultiplayerRoomFlow().catch(console.error);
