"use client";

import React from "react";
import { useParams } from "next/navigation";
import { DnDApp } from "@/components/dnd/DnDApp";

export default function CampaignPage() {
  const params = useParams();
  const rawId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const campaignId = rawId ? decodeURIComponent(rawId).trim() : undefined;

  return <DnDApp initialCampaignId={campaignId} />;
}
