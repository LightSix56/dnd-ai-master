"use client";

import React, { use } from "react";
import { DnDApp } from "@/components/dnd/DnDApp";

export default function RoomPage(props: { params: Promise<{ code: string }> }) {
  const params = use(props.params);
  const roomCode = params.code?.toUpperCase();

  return <DnDApp initialRoomCode={roomCode} />;
}
