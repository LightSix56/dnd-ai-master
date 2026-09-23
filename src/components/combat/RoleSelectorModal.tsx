"use client";

import { Combatant } from "@/lib/combat/types";
import { Button } from "@/components/ui/button";
import { Crown, Shield, User, X, Check, Heart, ShieldAlert } from "lucide-react";

interface RoleSelectorModalProps {
  combatants: Combatant[];
  currentRole: string; // "dm" or combatantId
  onSelectRole: (role: string) => void;
  onClose?: () => void;
}

export function RoleSelectorModal({
  combatants,
  currentRole,
  onSelectRole,
  onClose,
}: RoleSelectorModalProps) {
  const players = combatants.filter((c) => c.type === "player");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full !max-w-4xl sm:!max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100">Выбор роли / Персонажа</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Кооперативный режим по локальной сети (LAN)
              </p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* DM Option */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Администратор боя
            </label>
            <button
              onClick={() => onSelectRole("dm")}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                currentRole === "dm"
                  ? "bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/40"
                  : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-zinc-950 shadow-md">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-zinc-100 flex items-center gap-2">
                    Dungeon Master (Мастер)
                    {currentRole === "dm" && (
                      <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-medium border border-amber-500/30">
                        Выбрано
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Полный контроль: спавн монстров, ИИ-боты, редактирование карты и мира
                  </div>
                </div>
              </div>
              <div className="pl-3">
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                    currentRole === "dm"
                      ? "border-amber-500 bg-amber-500 text-zinc-950"
                      : "border-zinc-700 group-hover:border-zinc-500"
                  }`}
                >
                  {currentRole === "dm" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </button>
          </div>

          {/* Player Characters */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Персонажи игроков
            </label>
            {players.length === 0 ? (
              <div className="p-5 border border-dashed border-zinc-800 rounded-xl text-center bg-zinc-900/30 text-zinc-400 text-sm">
                В текущем бою пока нет персонажей игроков. Войдите как <b className="text-zinc-200">Dungeon Master</b> и импортируйте героев партии.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {players.map((c) => {
                  const isSelected = currentRole === c.id;

                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectRole(c.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-blue-950/30 border-blue-500/60 shadow-lg shadow-blue-950/20 ring-1 ring-blue-500/40"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Avatar */}
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-md shrink-0 border border-white/20"
                          style={{ backgroundColor: c.color || "#3b82f6" }}
                        >
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-100 flex items-center gap-2 truncate">
                            <span className="truncate">{c.name}</span>
                            {isSelected && (
                              <span className="text-[11px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-medium border border-blue-500/30 shrink-0">
                                Выбрано
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 flex items-center gap-3 mt-0.5">
                            <span>
                              {c.className || "Игрок"} {c.level ? `${c.level} ур.` : ""}
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Heart className="w-3 h-3 fill-current" />
                              {c.hpCurrent}/{c.hpMax} HP
                            </span>
                            <span className="flex items-center gap-1 text-zinc-300">
                              <ShieldAlert className="w-3 h-3" />
                              КД {c.ac}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="pl-3 shrink-0">
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-blue-500 bg-blue-500 text-zinc-950"
                              : "border-zinc-700 group-hover:border-zinc-500"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
          <span>Выбранная роль сохраняется на этом устройстве</span>
          <Button
            size="sm"
            onClick={() => onSelectRole(currentRole || "dm")}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4"
          >
            Войти в бой
          </Button>
        </div>
      </div>
    </div>
  );
}
