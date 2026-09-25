"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DnDApp } from "@/components/dnd/DnDApp";

export default function RoomBattlePage() {
  const params = useParams();
  const rawCode = typeof params?.code === "string" ? params.code : Array.isArray(params?.code) ? params.code[0] : "";
  const roomCode = rawCode ? decodeURIComponent(rawCode).trim().toUpperCase() : undefined;

  return <DnDApp initialRoomCode={roomCode} initialCombatOpen={true} />;
}
