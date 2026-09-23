"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import { RoomLobby } from "@/components/room/RoomLobby";

export default function RoomPage(props: { params: Promise<{ code: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const roomCode = params.code?.toUpperCase();

  const handleCampaignStarted = async (campaignId: string) => {
    try {
      await fetch("/api/campaign/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
    } catch (e) {
      console.error("Не удалось активировать кампанию автоматически:", e);
    }
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-[#2A170C] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#4A2411] via-[#2A170C] to-[#160B05] p-2 sm:p-6 flex flex-col justify-center">
      <RoomLobby
        roomCode={roomCode}
        onLeave={() => router.push("/")}
        onCampaignStarted={handleCampaignStarted}
      />
    </main>
  );
}
