import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  title?: string;
}

// ── 1. d20 Polyhedral Die (Logo / Dice Rolls) ──
export function D20Icon({ size = 20, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <polygon points="24,4 6,15 13,39 35,39 42,15" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="24,4 15,18 33,18" fill="#7A4529" stroke="#E5C158" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="24,34 15,18 33,18" fill="#3D2012" stroke="#E5C158" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="24,34 13,39 35,39" fill="#6B3A2A" stroke="#E5C158" strokeWidth="2" strokeLinejoin="round" />
      <line x1="6" y1="15" x2="15" y2="18" stroke="#E5C158" strokeWidth="2" />
      <line x1="42" y1="15" x2="33" y2="18" stroke="#E5C158" strokeWidth="2" />
      <line x1="6" y1="15" x2="13" y2="39" stroke="#E5C158" strokeWidth="2" />
      <line x1="42" y1="15" x2="35" y2="39" stroke="#E5C158" strokeWidth="2" />
    </svg>
  );
}

// ── 2. Ancient Scroll (Templates) ──
export function ScrollIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M38 34V10a4 4 0 0 0-4-4H8" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 42h24a4 4 0 0 0 4-4v-4H20a4 4 0 0 0-4 4v4z" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M8 6a4 4 0 0 0-4 4v28a4 4 0 0 0 4 4h8V10a4 4 0 0 0-4-4H8z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <line x1="20" y1="14" x2="30" y2="14" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="22" x2="30" y2="22" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── 3. Leather Grimoire (JSON / Save) ──
export function SpellbookIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M8 38V10a4 4 0 0 1 4-4h28v36H12a4 4 0 0 1-4-4z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M12 12h20M12 20h20M12 28h12" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28" cy="28" r="3" fill="#E5C158" />
    </svg>
  );
}

// ── 4. Ironbound Chest (Open File / Cloud Library) ──
export function ChestIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M6 14h36v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M6 14l4-8h28l4 8" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="20" y="20" width="8" height="8" rx="2" fill="#E5C158" stroke="#3D2012" strokeWidth="1.5" />
    </svg>
  );
}

// ── 5. Sand Hourglass (Reset) ──
export function HourglassIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M10 4h28M10 44h28" stroke="#E5C158" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 4v10l8 10-8 10v10h24V34l-8-10 8-10V4H12z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="3" fill="#E5C158" />
    </svg>
  );
}

// ── 6. Golden Wax Seal with Checkmark (Saved Status) ──
export function GoldSealCheckIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="24" cy="24" r="18" fill="#4A2D17" stroke="#E5C158" strokeWidth="3" />
      <path d="M16 24l6 6 12-12" stroke="#FFE58F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 7. Mystic Rotating Spinner (Saving Status) ──
export function MysticSpinnerIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 animate-spin ${className}`} {...props}>
      <circle cx="24" cy="24" r="18" stroke="rgba(229,193,88,0.2)" strokeWidth="3.5" />
      <path d="M24 6a18 18 0 0 1 18 18" stroke="#E5C158" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 8. Mystical Cloud (Cloud Save / Cloud Sync) ──
export function MysticCloudIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path
        d="M14 36h20a10 10 0 0 0 9.8-8A9 9 0 0 0 35 16a12 12 0 0 0-23.2 4A8 8 0 0 0 14 36z"
        fill="#5C341F"
        stroke="#E5C158"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── 9. Arcane Portal / Keyhole (Account / Sign Out) ──
export function PortalIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M8 42h32" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 42V14a12 12 0 0 1 24 0v28" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="28" cy="26" r="3" fill="#E5C158" />
    </svg>
  );
}

// ── 10. Golden Quill (Export DOCX) ──
export function QuillIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path
        d="M40 8C28 14 22 24 18 34l-8 8 6 2 8-8c10-4 20-10 26-22-2-4-6-6-10-6z"
        fill="#4A2411"
        stroke="#FFF2D1"
        strokeWidth="2.5"
      />
      <line x1="16" y1="36" x2="6" y2="46" stroke="#FFF2D1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 11. Runed Key (Login / Auth) ──
export function RunedKeyIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="16" cy="18" r="10" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="16" cy="18" r="4" fill="#3D2012" stroke="#E5C158" strokeWidth="1.5" />
      <path d="M23 25l19 19M36 38l4-4M30 44l4-4" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 12. Mystic Linked Chain (Share) ──
export function ArcaneLinkIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M20 28l8-8M14 34l-4 4a6 6 0 0 1-8.5-8.5l4-4a6 6 0 0 1 8.5 0M28 20l4-4a6 6 0 0 1 8.5 8.5l-4 4a6 6 0 0 1-8.5 0" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 13. Crossed Swords (Attacks & Combat) ──
export function CrossedSwordsIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <line x1="8" y1="8" x2="40" y2="40" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="8" x2="8" y2="40" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 6l-6 6M42 36l-6 6M36 6l6 6M6 36l6 6" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
      <polygon points="24,18 30,24 24,30 18,24" fill="#5C341F" stroke="#E5C158" strokeWidth="1.5" />
    </svg>
  );
}

// ── 14. Engraved Shield (Armor Class / Combat) ──
export function EngravedShieldIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M24 4L8 10v14c0 12 16 20 16 20s16-8 16-20V10L24 4z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 10l-10 4v9c0 8 10 13 10 13s10-5 10-13v-9l-10-4z" fill="#7A4529" stroke="#E5C158" strokeWidth="1.5" />
    </svg>
  );
}

// ── 15. Hero Profile / User ──
export function UserHeroIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="24" cy="14" r="8" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M8 40c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 16. Golden Sparkles (Attributes / Skills / Cantrips) ──
export function SparklesDndIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <polygon points="24,4 28,18 42,22 28,26 24,40 20,26 6,22 20,18" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="36,4 38,10 44,12 38,14 36,20 34,14 28,12 34,10" fill="#7A4529" stroke="#FFE58F" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── 17. Gold & Silver Coins (Currency) ──
export function CoinsChestIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="18" cy="28" r="12" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="30" cy="20" r="12" fill="#7A4529" stroke="#FFE58F" strokeWidth="2.5" />
      <circle cx="30" cy="20" r="6" stroke="#FFE58F" strokeWidth="1.5" />
    </svg>
  );
}

// ── 18. Drama Masks (Personality) ──
export function MasksDramaIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M6 14c0 10 8 18 18 18s18-8 18-18H6z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="18" r="2.5" fill="#E5C158" />
      <circle cx="32" cy="18" r="2.5" fill="#E5C158" />
      <path d="M18 26c3 3 9 3 12 0" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── 19. Adventurer Backpack (Equipment) ──
export function BackpackPackIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <rect x="10" y="16" width="28" height="26" rx="4" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M16 16V10a4 4 0 0 1 8 0v6M24 16V10a4 4 0 0 1 8 0v6" stroke="#E5C158" strokeWidth="2" />
      <rect x="16" y="24" width="16" height="10" rx="2" fill="#7A4529" stroke="#E5C158" strokeWidth="1.5" />
    </svg>
  );
}

// ── 20. Arcane Crystal Ball (Spell Slots) ──
export function CrystalBallDndIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="24" cy="20" r="14" fill="#4E3B20" stroke="#E5C158" strokeWidth="2.5" />
      <ellipse cx="24" cy="17" rx="8" ry="4" stroke="#FFE58F" strokeWidth="1.5" />
      <path d="M12 42h24M16 34l-4 8M32 34l4 8M18 34h12" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 21. Magic Portrait Frame / Camera ──
export function CameraPortraitIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <rect x="8" y="12" width="32" height="26" rx="3" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="24" cy="25" r="7" fill="#7A4529" stroke="#FFE58F" strokeWidth="2" />
      <path d="M16 12l3-5h10l3 5" fill="#7A4529" stroke="#E5C158" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}


// ── 22. Info Seal / Arcane Eye (Inspect / Detail) ──
export function InfoSealIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="24" cy="24" r="20" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="16" stroke="#E5C158" strokeWidth="1.2" strokeDasharray="3 2" />
      <circle cx="24" cy="15" r="2.5" fill="#FFE58F" stroke="#E5C158" strokeWidth="1" />
      <path d="M22 21h3v14m-3 0h6" stroke="#FFE58F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 23. Iron Brazier / Urn of Destruction (Delete / Remove) ──
export function TrashBinIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M12 14h24l-3 24a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4L12 14z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 14h32" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 14V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5" stroke="#FFE58F" strokeWidth="2.5" />
      <line x1="20" y1="21" x2="20" y2="35" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
      <line x1="28" y1="21" x2="28" y2="35" stroke="#E5C158" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── 24. Antique Brass Lens (Search / Inspect) ──
export function SearchLensIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="21" cy="21" r="13" fill="#5C341F" stroke="#E5C158" strokeWidth="3" />
      <circle cx="21" cy="21" r="9" stroke="#FFE58F" strokeWidth="1.5" strokeDasharray="4 2" />
      <path d="M31 31l11 11" stroke="#E5C158" strokeWidth="4" strokeLinecap="round" />
      <path d="M35 35l6 6" stroke="#7A4529" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 25. Iron Padlock (Lock / Inaccessible) ──
export function LockSealIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <rect x="11" y="20" width="26" height="22" rx="4" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M16 20v-7a8 8 0 0 1 16 0v7" stroke="#FFE58F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="30" r="3" fill="#FFE58F" />
      <path d="M24 33v4" stroke="#FFE58F" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── 26. Heraldic Warning Rune (Warning / Caution) ──
export function WarningSignIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <polygon points="24,6 44,40 4,40" fill="#5C341F" stroke="#E5C158" strokeWidth="2.8" strokeLinejoin="round" />
      <line x1="24" y1="18" x2="24" y2="28" stroke="#FFE58F" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2" fill="#FFE58F" />
    </svg>
  );
}

// ── 27. Blacksmith Anvil (Carrying Capacity / Weight) ──
export function WeightAnvilIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M6 16h36c0 0-4 8-10 8H16c-6 0-10-8-10-8z" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 24v8c0 4-4 8-6 8h28c-2 0-6-4-6-8v-8" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="8" y1="40" x2="40" y2="40" stroke="#FFE58F" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── 28. Winged Boot (Jump Distance / Athletics) ──
export function WingedBootIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M14 12v18c0 4 3 8 8 8h12c4 0 6-3 6-6 0-3-2-5-5-5h-7v-15H14z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 18c-6-2-8-8-8-8s6 1 10 4" fill="#7A4529" stroke="#FFE58F" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 24c-6-2-8-8-8-8s6 1 10 4" fill="#7A4529" stroke="#FFE58F" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── 29. Crescent Moon & Stars (Long Rest) ──
export function MoonRestIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M34 10A18 18 0 1 1 20 44c1-1 1-2 0-3a13 13 0 0 0 13-22c0-1 0-2 1-3z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="36" cy="14" r="2" fill="#FFE58F" />
      <circle cx="42" cy="24" r="1.5" fill="#FFE58F" />
      <circle cx="34" cy="34" r="2" fill="#FFE58F" />
    </svg>
  );
}

// ── 30. Vitality Heart Gem (HP / Health) ──
export function HeartGemIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M24 42s-16-10-16-22a9 9 0 0 1 16-5.5A9 9 0 0 1 40 20c0 12-16 22-16 22z" fill="#7A2218" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 14.5v27.5" stroke="#FFE58F" strokeWidth="1.5" />
      <path d="M14 10l10 10 10-10" stroke="#FFE58F" strokeWidth="1.5" />
    </svg>
  );
}

// ── 31. Arcane Eye of Inspection (Inspect / View) ──
export function EyeMysticIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M6 24c4-10 12-14 18-14s14 4 18 14c-4 10-12 14-18 14S10 34 6 24z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="24" cy="24" r="7" fill="#3D2012" stroke="#FFE58F" strokeWidth="2" />
      <circle cx="24" cy="24" r="3" fill="#FFE58F" />
    </svg>
  );
}

// ── 32. Inscribed Scroll Download (Download / Import) ──
export function ScrollDownloadIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M36 32V8a4 4 0 0 0-4-4H10" stroke="#E5C158" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 40h20a4 4 0 0 0 4-4v-4H20a4 4 0 0 0-4 4v4z" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M10 4a4 4 0 0 0-4 4v26a4 4 0 0 0 4 4h6V8a4 4 0 0 0-4-4h-2z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <path d="M26 14v12m0 0l-4-4m4 4l4-4" stroke="#FFE58F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 33. Sovereign Crown (Subclass / Archetype) ──
export function CrownRulerIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M6 36l4-22 9 9 5-13 5 13 9-9 4 22H6z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="6" y="36" width="36" height="6" rx="1.5" fill="#7A4529" stroke="#E5C158" strokeWidth="2" />
      <circle cx="10" cy="14" r="2" fill="#FFE58F" />
      <circle cx="24" cy="10" r="2.5" fill="#FFE58F" />
      <circle cx="38" cy="14" r="2" fill="#FFE58F" />
    </svg>
  );
}

// ── 34. Parchment Ribbons Menu (Navigation / Menu) ──
export function ParchmentMenuIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M8 12h32" stroke="#E5C158" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2" fill="#FFE58F" />
      <path d="M8 24h32" stroke="#E5C158" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="24" r="2" fill="#FFE58F" />
      <path d="M8 36h32" stroke="#E5C158" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="36" r="2" fill="#FFE58F" />
    </svg>
  );
}

// ── 35. Local Runic Tablet (Local Storage / Device Save) ──
export function DeviceStoneIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <rect x="10" y="8" width="28" height="34" rx="4" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <rect x="16" y="12" width="16" height="10" rx="2" fill="#3D2012" stroke="#FFE58F" strokeWidth="1.5" />
      <circle cx="24" cy="33" r="3.5" fill="#FFE58F" />
    </svg>
  );
}

// ── 36. Carved Death Skull (Death Saves) ──
export function SkullDeathIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M12 22c0-8 6-14 12-14s12 6 12 14c0 6-3 10-6 12v6H18v-6c-3-2-6-6-6-12z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="19" cy="22" r="3" fill="#3D2012" stroke="#FFE58F" strokeWidth="1.2" />
      <circle cx="29" cy="22" r="3" fill="#3D2012" stroke="#FFE58F" strokeWidth="1.2" />
      <line x1="21" y1="36" x2="21" y2="40" stroke="#FFE58F" strokeWidth="1.5" />
      <line x1="27" y1="36" x2="27" y2="40" stroke="#FFE58F" strokeWidth="1.5" />
    </svg>
  );
}

// ── 37. Arcane Lightning Bolt (Bonus Action / Magic) ──
export function LightningStrikeIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <polygon points="26,4 12,24 24,24 20,44 36,22 24,22" fill="#7A4529" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="25,10 17,23 24,23 22,34 31,23 24,23" fill="#FFE58F" />
    </svg>
  );
}

// ── 38. Brass Target Crosshair (Reaction / Target) ──
export function TargetAimIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <circle cx="24" cy="24" r="16" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="8" stroke="#FFE58F" strokeWidth="1.8" />
      <circle cx="24" cy="24" r="2.5" fill="#FFE58F" />
      <line x1="24" y1="4" x2="24" y2="12" stroke="#E5C158" strokeWidth="2" />
      <line x1="24" y1="36" x2="24" y2="44" stroke="#E5C158" strokeWidth="2" />
      <line x1="4" y1="24" x2="12" y2="24" stroke="#E5C158" strokeWidth="2" />
      <line x1="36" y1="24" x2="44" y2="24" stroke="#E5C158" strokeWidth="2" />
    </svg>
  );
}

// ── 39. Compendium Catalog Tome (Catalog / Manual) ──
export function CompendiumBookIcon({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`} {...props}>
      <path d="M24 12c-6-4-12-4-18 0v24c6-4 12-4 18 0 6-4 12-4 18 0V12c-6-4-12-4-18 0z" fill="#5C341F" stroke="#E5C158" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="24" y1="12" x2="24" y2="36" stroke="#FFE58F" strokeWidth="2.5" />
      <line x1="10" y1="19" x2="20" y2="17" stroke="#FFE58F" strokeWidth="1.5" />
      <line x1="10" y1="25" x2="20" y2="23" stroke="#FFE58F" strokeWidth="1.5" />
      <line x1="28" y1="17" x2="38" y2="19" stroke="#FFE58F" strokeWidth="1.5" />
      <line x1="28" y1="23" x2="38" y2="25" stroke="#FFE58F" strokeWidth="1.5" />
    </svg>
  );
}

