"use client";

import React, { useMemo } from "react";
import type { CombatEffect, DamagePopup } from "@/lib/combat/animations";

interface CombatEffectsLayerProps {
  effects: CombatEffect[];
  popups?: Record<string, DamagePopup> | DamagePopup[];
}

export function CombatEffectsLayer({ effects, popups }: CombatEffectsLayerProps) {
  const popupList = useMemo(() => {
    if (!popups) return [];
    if (Array.isArray(popups)) return popups;
    return Object.values(popups);
  }, [popups]);

  if ((!effects || effects.length === 0) && popupList.length === 0) return null;

  return (
    <g className="combat-effects-layer" pointerEvents="none">
      <defs>
        {/* Градиенты клинков */}
        <linearGradient id="effectBladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e2e8f0" />
          <stop offset="75%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="effectOffBladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Градиенты световых шлейфов */}
        <linearGradient id="effectSlashMainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="effectSlashOffGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="effectMagicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        {/* Свечение */}
        <filter id="effectGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="effectGlowStrong" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <style>{`
        /* 1. Меч: Основная рука (рубка сверху-вниз) */
        @keyframes fxSwordMain {
          0% { opacity: 0; transform: translate(15px, -20px) rotate(-65deg) scale(0.85); }
          20% { opacity: 1; transform: translate(25px, -30px) rotate(-45deg) scale(1.05); }
          45% { opacity: 1; transform: translate(var(--tx, 45px), 5px) rotate(60deg) scale(1.15); }
          70% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) + 5px), 18px) rotate(85deg) scale(1); }
          100% { opacity: 0; transform: translate(calc(var(--tx, 45px) + 8px), 25px) rotate(100deg) scale(0.8); }
        }

        /* 2. Меч: Дополнительная рука (подрез снизу-вверх) */
        @keyframes fxSwordOff {
          0% { opacity: 0; transform: translate(15px, 20px) rotate(115deg) scale(0.85); }
          20% { opacity: 1; transform: translate(25px, 30px) rotate(135deg) scale(1.05); }
          45% { opacity: 1; transform: translate(var(--tx, 45px), -5px) rotate(20deg) scale(1.15); }
          70% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) + 5px), -18px) rotate(-10deg) scale(1); }
          100% { opacity: 0; transform: translate(calc(var(--tx, 45px) + 8px), -25px) rotate(-30deg) scale(0.8); }
        }

        /* 3. Кинжал: Колющий выпад сверху */
        @keyframes fxDaggerMain {
          0% { opacity: 0; transform: translate(10px, -12px) rotate(-10deg) scale(0.8); }
          20% { opacity: 1; transform: translate(20px, -12px) rotate(-10deg) scale(1); }
          45% { opacity: 1; transform: translate(calc(var(--tx, 45px) - 5px), -4px) rotate(-10deg) scale(1.2); }
          65% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) - 12px), -5px) rotate(-10deg) scale(1); }
          100% { opacity: 0; transform: translate(25px, -10px) rotate(-10deg) scale(0.75); }
        }

        /* 4. Кинжал: Колющий выпад снизу */
        @keyframes fxDaggerOff {
          0% { opacity: 0; transform: translate(10px, 12px) rotate(10deg) scale(0.8); }
          20% { opacity: 1; transform: translate(20px, 12px) rotate(10deg) scale(1); }
          45% { opacity: 1; transform: translate(calc(var(--tx, 45px) - 5px), 4px) rotate(10deg) scale(1.2); }
          65% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) - 12px), 5px) rotate(10deg) scale(1); }
          100% { opacity: 0; transform: translate(25px, 10px) rotate(10deg) scale(0.75); }
        }

        /* 5. Топор + Щит */
        @keyframes fxShieldRaise {
          0% { opacity: 0; transform: translate(10px, 0px) scale(0.7); }
          25% { opacity: 1; transform: translate(22px, 0px) scale(1.1); }
          70% { opacity: 1; transform: translate(22px, 0px) scale(1.1); }
          100% { opacity: 0; transform: translate(10px, 0px) scale(0.8); }
        }
        @keyframes fxAxeChop {
          0% { opacity: 0; transform: translate(15px, -25px) rotate(-85deg) scale(0.8); }
          20% { opacity: 1; transform: translate(25px, -35px) rotate(-65deg) scale(1.1); }
          45% { opacity: 1; transform: translate(var(--tx, 45px), 5px) rotate(45deg) scale(1.25); }
          70% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) + 5px), 18px) rotate(70deg) scale(1); }
          100% { opacity: 0; transform: translate(calc(var(--tx, 45px) + 8px), 25px) rotate(85deg) scale(0.8); }
        }

        /* 6. Посох */
        @keyframes fxStaffStrike {
          0% { opacity: 0; transform: translate(15px, -25px) rotate(-75deg) scale(0.8); }
          20% { opacity: 1; transform: translate(22px, -32px) rotate(-50deg) scale(1.1); }
          45% { opacity: 1; transform: translate(var(--tx, 45px), 5px) rotate(50deg) scale(1.2); }
          70% { opacity: 0.8; transform: translate(calc(var(--tx, 45px) + 5px), 16px) rotate(75deg) scale(1); }
          100% { opacity: 0; transform: translate(calc(var(--tx, 45px) + 8px), 22px) rotate(90deg) scale(0.8); }
        }

        /* 7. Лук и Стрела */
        @keyframes fxBowNock {
          0% { opacity: 0; transform: translate(5px, 0px) scale(0.8); }
          15% { opacity: 1; transform: translate(15px, 0px) scale(1); }
          30% { opacity: 1; transform: translate(15px, 0px) scale(1); }
          75% { opacity: 0.8; transform: translate(12px, 0px) scale(0.95); }
          100% { opacity: 0; transform: translate(8px, 0px) scale(0.85); }
        }
        @keyframes fxArrowFlight {
          0% { opacity: 0; transform: translate(15px, 0px); }
          18% { opacity: 0; transform: translate(20px, 0px); }
          22% { opacity: 1; transform: translate(30px, 0px); }
          75% { opacity: 1; transform: translate(var(--tx, 150px), 0px); }
          88% { opacity: 0.95; transform: translate(calc(var(--tx, 150px) + 2px), 0px) rotate(1.5deg); }
          100% { opacity: 0; transform: translate(calc(var(--tx, 150px) + 2px), 0px) rotate(1.5deg); }
        }

        /* 8. Магический снаряд */
        @keyframes fxMagicMissile {
          0% { opacity: 0; transform: translate(15px, 0px) scale(0.3); }
          15% { opacity: 1; transform: translate(25px, 0px) scale(1); }
          45% { opacity: 1; transform: translate(calc(var(--tx, 150px) * 0.5), -5px) scale(1.25); }
          75% { opacity: 1; transform: translate(var(--tx, 150px), 0px) scale(1.4); }
          100% { opacity: 0; transform: translate(var(--tx, 150px), 0px) scale(2.2); }
        }

        /* Шлейфы */
        @keyframes fxTrailMain {
          0% { stroke-dasharray: 180; stroke-dashoffset: 180; opacity: 0; }
          20% { opacity: 1; }
          50% { stroke-dashoffset: 40; opacity: 0.95; }
          100% { stroke-dashoffset: -120; opacity: 0; }
        }
        @keyframes fxTrailOff {
          0% { stroke-dasharray: 180; stroke-dashoffset: -180; opacity: 0; }
          20% { opacity: 1; }
          50% { stroke-dashoffset: -40; opacity: 0.95; }
          100% { stroke-dashoffset: 120; opacity: 0; }
        }
        @keyframes fxThrustTrail {
          0% { stroke-dasharray: 120; stroke-dashoffset: 120; opacity: 0; }
          20% { opacity: 1; }
          45% { stroke-dashoffset: 0; opacity: 1; }
          80% { stroke-dashoffset: -90; opacity: 0.5; }
          100% { opacity: 0; }
        }

        /* Вспышка попадания */
        @keyframes fxHitSpark {
          0% { opacity: 0; transform: scale(0.3); }
          40% { opacity: 1; transform: scale(1.5); }
          100% { opacity: 0; transform: scale(2.2); }
        }

        /* 2-секундное чистое отображение урона над фишкой */
        @keyframes fxDamageFloat2s {
          0% { opacity: 0; transform: translateY(6px) scale(0.65); }
          8% { opacity: 1; transform: translateY(-4px) scale(1.12); }
          16% { opacity: 1; transform: translateY(-8px) scale(1.0); }
          80% { opacity: 1; transform: translateY(-10px) scale(1.0); }
          100% { opacity: 0; transform: translateY(-22px) scale(0.85); }
        }

        /* 2-секундное чистое отображение урона для фишек у верхнего края поля (плывет вниз) */
        @keyframes fxDamageFloat2sDown {
          0% { opacity: 0; transform: translateY(-4px) scale(0.65); }
          8% { opacity: 1; transform: translateY(2px) scale(1.12); }
          16% { opacity: 1; transform: translateY(4px) scale(1.0); }
          80% { opacity: 1; transform: translateY(6px) scale(1.0); }
          100% { opacity: 0; transform: translateY(16px) scale(0.85); }
        }
      `}</style>

      {/* Отрисовка активных моделей оружия и шлейфов */}
      {effects.map((effect) => {
        const { id, type, fromPx, angleDeg, distancePx, outcome, durationMs } = effect;
        const durSec = `${(durationMs / 1000).toFixed(2)}s`;
        const durFastSec = `${((durationMs * 0.85) / 1000).toFixed(2)}s`;
        const targetX = distancePx;
        const isMiss = outcome === "dodge" || outcome === "block";

        return (
          <g key={id}>
            {/* Группа оружия с динамическим поворотом в сторону цели */}
            <g
              transform={`translate(${fromPx.x}, ${fromPx.y}) rotate(${angleDeg})`}
              style={{ ["--tx" as any]: `${targetX}px` }}
            >
              {/* 1. МЕЧИ */}
              {(type === "sword_main" || type === "sword_dual") && (
                <>
                  <path
                    d={`M 15 -25 C 25 -30, ${targetX - 5} -15, ${targetX + 5} 25`}
                    fill="none"
                    stroke="url(#effectSlashMainGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxTrailMain ${durSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxSwordMain ${durSec} cubic-bezier(0.15, 0.85, 0.35, 1) forwards` }}>
                    <polygon points="0,-36 4.5,-30 4.5,20 0,23 -4.5,20 -4.5,-30" fill="url(#effectBladeGrad)" stroke="#f8fafc" strokeWidth="0.8" />
                    <line x1="0" y1="-34" x2="0" y2="18" stroke="#64748b" strokeWidth="0.9" />
                    <rect x="-13" y="20" width="26" height="4.5" rx="1.5" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                    <rect x="-2.5" y="24.5" width="5" height="13" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
                    <circle cx="0" cy="39.5" r="3.5" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                  </g>
                </>
              )}

              {(type === "sword_off" || type === "sword_dual") && (
                <>
                  <path
                    d={`M 15 25 C 25 30, ${targetX - 5} 15, ${targetX + 5} -25`}
                    fill="none"
                    stroke="url(#effectSlashOffGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxTrailOff ${durSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxSwordOff ${durSec} cubic-bezier(0.15, 0.85, 0.35, 1) forwards` }}>
                    <polygon points="0,-34 4,-28 4,18 0,21 -4,18 -4,-28" fill="url(#effectOffBladeGrad)" stroke="#fde047" strokeWidth="0.8" />
                    <line x1="0" y1="-32" x2="0" y2="16" stroke="#ca8a04" strokeWidth="0.9" />
                    <rect x="-12" y="18" width="24" height="4" rx="1.5" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
                    <rect x="-2.5" y="22" width="5" height="12" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
                    <circle cx="0" cy="36" r="3" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
                  </g>
                </>
              )}

              {/* 2. КИНЖАЛЫ */}
              {(type === "dagger_main" || type === "dagger_dual") && (
                <>
                  <line
                    x1="15"
                    y1="-12"
                    x2={targetX}
                    y2="-4"
                    stroke="url(#effectSlashMainGrad)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxThrustTrail ${durFastSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxDaggerMain ${durFastSec} cubic-bezier(0.15, 0.9, 0.25, 1) forwards` }}>
                    <polygon points="34,0 24,-4.5 0,-2.5 -4,0 0,2.5 24,4.5" fill="url(#effectBladeGrad)" stroke="#ffffff" strokeWidth="0.8" />
                    <line x1="0" y1="0" x2="30" y2="0" stroke="#64748b" strokeWidth="0.8" />
                    <rect x="-3" y="-8" width="3.5" height="16" rx="1" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                    <rect x="-14" y="-2.5" width="11" height="5" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
                    <circle cx="-15" cy="0" r="3" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
                  </g>
                </>
              )}

              {(type === "dagger_off" || type === "dagger_dual") && (
                <>
                  <line
                    x1="15"
                    y1="12"
                    x2={targetX}
                    y2="4"
                    stroke="url(#effectSlashOffGrad)"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxThrustTrail ${durFastSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxDaggerOff ${durFastSec} cubic-bezier(0.15, 0.9, 0.25, 1) forwards` }}>
                    <polygon points="32,0 22,-4 0,-2.5 -4,0 0,2.5 22,4" fill="url(#effectOffBladeGrad)" stroke="#fef08a" strokeWidth="0.8" />
                    <line x1="0" y1="0" x2="28" y2="0" stroke="#ca8a04" strokeWidth="0.8" />
                    <rect x="-3" y="-7.5" width="3.5" height="15" rx="1" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
                    <rect x="-13" y="-2.5" width="10" height="5" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
                    <circle cx="-14" cy="0" r="2.8" fill="#ef4444" stroke="#991b1b" strokeWidth="0.8" />
                  </g>
                </>
              )}

              {/* 3. ТОПОР + ЩИТ */}
              {type === "axe_shield" && (
                <>
                  <g style={{ animation: `fxShieldRaise ${durSec} ease-out forwards` }}>
                    <circle cx="0" cy="0" r="17" fill="#334155" stroke="#94a3b8" strokeWidth="2.5" />
                    <circle cx="0" cy="0" r="12" fill="#1e293b" stroke="#64748b" strokeWidth="1.2" strokeDasharray="4,2" />
                    <circle cx="0" cy="0" r="6" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
                    <path d="M 0 -17 L 0 17 M -17 0 L 17 0" stroke="#475569" strokeWidth="1" />
                  </g>
                  <path
                    d={`M 15 -25 C 25 -30, ${targetX - 5} -15, ${targetX + 5} 25`}
                    fill="none"
                    stroke="url(#effectSlashMainGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxTrailMain ${durSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxAxeChop ${durSec} cubic-bezier(0.2, 0.8, 0.3, 1) forwards` }}>
                    <rect x="-2" y="-25" width="4" height="60" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
                    <path d="M 2 -18 C 18 -26, 26 -15, 24 -4 C 18 2, 8 -2, 2 -5 Z" fill="url(#effectBladeGrad)" stroke="#f8fafc" strokeWidth="1" />
                    <rect x="-3" y="-20" width="6" height="18" fill="#475569" rx="1" />
                    <circle cx="0" cy="36" r="3" fill="#f59e0b" />
                  </g>
                </>
              )}

              {/* 4. ПОСОХ */}
              {type === "staff" && (
                <>
                  <path
                    d={`M 15 -25 C 25 -30, ${targetX - 5} -15, ${targetX + 5} 22`}
                    fill="none"
                    stroke="url(#effectSlashMainGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    filter="url(#effectGlow)"
                    style={{ animation: `fxTrailMain ${durSec} ease-out forwards` }}
                  />
                  <g style={{ animation: `fxStaffStrike ${durSec} cubic-bezier(0.15, 0.85, 0.35, 1) forwards` }}>
                    <rect x="-2" y="-35" width="4.5" height="75" rx="1.5" fill="#451a03" stroke="#290e03" strokeWidth="0.8" />
                    <circle cx="0" cy="-36" r="8" fill="#a855f7" stroke="#e9d5ff" strokeWidth="1.5" filter="url(#effectGlow)" />
                    <circle cx="0" cy="-36" r="4" fill="#ffffff" />
                    <path d="M -7 -32 Q 0 -45 7 -32" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                  </g>
                </>
              )}

              {/* 5. ЛУК И СТРЕЛА */}
              {type === "bow" && (
                <>
                  <g style={{ animation: `fxBowNock ${durSec} ease-out forwards` }}>
                    <path d="M 0 -28 Q 14 0 0 28" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
                    <line x1="0" y1="-28" x2="0" y2="28" stroke="#cbd5e1" strokeWidth="1" />
                  </g>
                  <g style={{ animation: `fxArrowFlight ${durSec} cubic-bezier(0.2, 0.8, 0.2, 1) forwards` }}>
                    <line x1="-28" y1="0" x2="12" y2="0" stroke="#78350f" strokeWidth="2.2" />
                    <polygon points="12,-4 20,0 12,4" fill="#94a3b8" stroke="#475569" strokeWidth="0.7" />
                    <polygon points="-28,-3 -22,0 -28,3" fill="#ef4444" />
                  </g>
                </>
              )}

              {/* 6. ЗАКЛИНАНИЕ */}
              {type === "spell_projectile" && (
                <g style={{ animation: `fxMagicMissile ${durSec} cubic-bezier(0.2, 0.8, 0.2, 1) forwards` }}>
                  <circle cx="0" cy="0" r="13" fill="url(#effectMagicGrad)" filter="url(#effectGlow)" />
                  <circle cx="0" cy="0" r="6" fill="#ffffff" />
                  <path d="M -10 -10 Q 0 -18 10 -10 Q 18 0 10 10 Q 0 18 -10 10 Q -18 0 -10 -10" fill="none" stroke="#67e8f9" strokeWidth="1.5" />
                </g>
              )}

              {/* Вспышка попадания у цели */}
              {!isMiss && (
                <g transform={`translate(${targetX}, 0)`}>
                  <g
                    style={{
                      animation: `fxHitSpark 0.4s ease-out ${(durationMs * (type === "bow" || type === "spell_projectile" ? 0.75 : 0.44) / 1000).toFixed(2)}s both`,
                    }}
                  >
                    <circle cx="0" cy="0" r="18" fill="#fbbf24" fillOpacity="0.38" filter="url(#effectGlow)" />
                    <path d="M -14 0 L 14 0 M 0 -14 L 0 14 M -10 -10 L 10 10 M -10 10 L 10 -10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                  </g>
                </g>
              )}

              {/* Вспышка блока щитом */}
              {outcome === "block" && (
                <g transform={`translate(${targetX - 8}, 0)`}>
                  <g
                    style={{
                      animation: `fxHitSpark 0.3s ease-out ${(durationMs * 0.44 / 1000).toFixed(2)}s both`,
                    }}
                  >
                    <circle cx="0" cy="0" r="14" fill="#818cf8" fillOpacity="0.45" filter="url(#effectGlow)" />
                    <path d="M -8 -8 L 8 8 M -8 8 L 8 -8" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  </g>
                </g>
              )}
            </g>
          </g>
        );
      })}

      {/* 2-СЕКУНДНЫЕ ВСПЛЫВАЮЩИЕ ЦИФРЫ УРОНА И СТАТУСОВ (БЕЗ ГРОМОЗДКИХ БАННЕРОВ) */}
      {popupList.map((pop) => {
        const isDodge = pop.outcome === "dodge";
        const isBlock = pop.outcome === "block";
        const isCrit = pop.isCrit;
        
        const textColor = isDodge
          ? "#38bdf8"
          : isBlock
          ? "#818cf8"
          : isCrit
          ? "#fbbf24"
          : "#ef4444";

        const isNearTop = pop.y < 38;
        const popY = isNearTop ? pop.y + 22 : pop.y - 24;
        const animName = isNearTop ? "fxDamageFloat2sDown" : "fxDamageFloat2s";

        return (
          <g key={pop.id} transform={`translate(${pop.x}, ${popY})`}>
            <g style={{ animation: `${animName} 2.0s cubic-bezier(0.16, 1, 0.3, 1) forwards` }}>
              {/* Чистый, стильный текст/цифра урона с четкой темной обводкой */}
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isCrit ? "20" : isDodge || isBlock ? "13" : "17"}
                fontWeight="900"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fill={textColor}
                stroke="#050811"
                strokeWidth={isCrit ? "4" : "3.2"}
                strokeLinejoin="round"
                paintOrder="stroke fill"
                filter="url(#effectGlow)"
              >
                {pop.text}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
