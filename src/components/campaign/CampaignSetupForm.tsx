"use client";

import React, { useState, type ReactNode } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import {
  DIFFICULTY_OPTIONS,
  DM_STYLE_OPTIONS,
  PARTY_TIES_OPTIONS,
  SETTING_PRESETS,
  STARTING_SITUATION_OPTIONS,
  TONE_OPTIONS,
  levelToChoices,
  prepareCampaignSubmit,
  type CampaignSetupValues,
  type Difficulty,
  type DmStyle,
  type PartyTies,
  type Tone,
} from "@/lib/campaign/setup-params";
import type { StartingSituation } from "@/lib/ai/party-arc-generator";

export interface CampaignSetupFormProps {
  mode: "solo" | "network";
  initialTitle: string;
  initialValues: CampaignSetupValues;
  startingLevel: number;
  isGenerating: boolean;
  error: string | null;
  onSubmit: (values: CampaignSetupValues) => void | Promise<void>;
  onCancel: () => void;
  partySlot?: ReactNode;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const selectClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export function CampaignSetupForm({
  mode,
  initialTitle,
  initialValues,
  startingLevel,
  isGenerating,
  error,
  onSubmit,
  onCancel,
  partySlot,
}: CampaignSetupFormProps) {
  const [draft, setDraft] = useState<CampaignSetupValues>({ ...initialValues, title: initialTitle });
  const [localError, setLocalError] = useState<string | null>(null);

  const update = <K extends keyof CampaignSetupValues>(key: K, value: CampaignSetupValues[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = prepareCampaignSubmit(draft, startingLevel);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }
    setLocalError(null);
    void onSubmit(result.values);
  };

  const shownError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} data-mode={mode} className="mt-4 space-y-4 text-sm">
      {shownError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
          ⚠️ {shownError}
        </div>
      )}

      {partySlot}

      <div>
        <label htmlFor="campaign-title" className={labelClass}>Название кампании / Модуля</label>
        <input
          id="campaign-title"
          type="text"
          value={draft.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="например: Тени над Забытым Храмом"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="campaign-setting" className={labelClass}>Сеттинг и жанр мира</label>
        <input
          id="campaign-setting"
          type="text"
          value={draft.setting}
          onChange={(e) => update("setting", e.target.value)}
          placeholder="Сеттинг или жанр"
          className={`${inputClass} mb-2`}
        />
        <div className="flex flex-wrap gap-1.5">
          {SETTING_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => update("setting", preset)}
              className={`rounded-md border px-2.5 py-1 text-xs transition cursor-pointer ${
                draft.setting === preset
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="campaign-tone" className={labelClass}>Тон повествования</label>
          <select id="campaign-tone" value={draft.tone} onChange={(e) => update("tone", e.target.value as Tone)} className={selectClass}>
            {TONE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="campaign-dm-style" className={labelClass}>Стиль мастера (DM)</label>
          <select id="campaign-dm-style" value={draft.dmStyle} onChange={(e) => update("dmStyle", e.target.value as DmStyle)} className={selectClass}>
            {DM_STYLE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelClass}>Сложность тактических боев (DMG p. 82)</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex cursor-pointer flex-col rounded-lg border p-2.5 transition ${
                draft.difficulty === opt.key
                  ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900 shadow-xs"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50 hover:bg-zinc-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="difficulty"
                    value={opt.key}
                    checked={draft.difficulty === opt.key}
                    onChange={() => update("difficulty", opt.key as Difficulty)}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">{opt.label}</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-medium">{opt.dist}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500 pl-5 leading-tight">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={labelClass}>Отношения в отряде (Динамика группы)</span>
        <select
          aria-label="Отношения в отряде"
          value={draft.partyTies}
          onChange={(e) => update("partyTies", e.target.value as PartyTies)}
          className={selectClass}
        >
          {PARTY_TIES_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <span className={labelClass}>Завязка: начальная связь героев</span>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {STARTING_SITUATION_OPTIONS.map((sit) => (
            <label
              key={sit.key}
              className={`flex cursor-pointer flex-col rounded-lg border p-2 transition text-xs ${
                draft.startingSituation === sit.key
                  ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-900 dark:text-zinc-100"
                  : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 hover:bg-zinc-50/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="situation"
                  value={sit.key}
                  checked={draft.startingSituation === sit.key}
                  onChange={() => update("startingSituation", sit.key as StartingSituation)}
                  className="accent-zinc-900 dark:accent-zinc-100"
                />
                <span>{sit.label}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-500 font-normal pl-5">{sit.desc}</p>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="campaign-level-to" className={labelClass}>Финальный уровень кампании</label>
        <select
          id="campaign-level-to"
          value={draft.levelTo}
          onChange={(e) => update("levelTo", Number(e.target.value))}
          className={selectClass}
        >
          {levelToChoices(startingLevel).map((lvl) => (
            <option key={lvl} value={lvl}>До {lvl} ур.</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="campaign-dm-notes" className={labelClass}>Пожелания мастера к сюжету и миру (необязательно)</label>
        <textarea
          id="campaign-dm-notes"
          value={draft.customDmNotes ?? ""}
          onChange={(e) => update("customDmNotes", e.target.value)}
          placeholder="Например: хочу встретить старого знакомого жреца в таверне, а в конце акта сделать бой с некромантом в склепе..."
          rows={2}
          className={`${inputClass} text-xs`}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={isGenerating}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isGenerating}
          className="rounded-md bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
        >
          {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
          <span>Сотворить Акт 1 приключения</span>
        </button>
      </div>
    </form>
  );
}
