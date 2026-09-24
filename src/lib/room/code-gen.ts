// Генератор читаемых и уникальных кодов комнат для D&D 5e

const DND_ROOM_WORDS = [
  "DRAGON",
  "HYDRA",
  "GOBLIN",
  "BEHOLDER",
  "MIMIC",
  "KOBOLD",
  "PALADIN",
  "WIZARD",
  "WARLOCK",
  "BARD",
  "ROGUE",
  "CLERIC",
  "RANGER",
  "DRUID",
  "MONK",
  "BARBARIAN",
  "DICE",
  "DUNGEON",
  "TAVERN",
  "SWORD",
  "SHIELD",
  "POTION",
  "SCROLL",
  "SPELL",
  "VAULT",
  "CHEST",
  "PHOENIX",
  "GRIFFIN",
  "TITAN",
  "ELVEN",
  "DWARVEN",
  "ORC",
  "LICH",
  "KRAKEN",
  "CHIMERA",
  "WYRM",
  "GOLEM",
  "BASILISK",
  "SPECTER",
  "SHADOW",
];

/**
 * Генерирует случайный читаемый код комнаты вида 'DRAGON-42' или 'TAVERN-815'
 */
export function generateRoomCode(): string {
  const wordIndex = Math.floor(Math.random() * DND_ROOM_WORDS.length);
  const word = DND_ROOM_WORDS[wordIndex];
  // От 10 до 999 для максимальной читаемости и минимального шанса коллизий
  const number = Math.floor(10 + Math.random() * 990);
  return `${word}-${number}`;
}

/**
 * Нормализует введённый пользователем код (удаляет пробелы, двойные тире, приводит к UPPERCASE)
 */
export function normalizeRoomCode(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  // Поддержка вставки ссылки вида https://.../room/DRAGON-42 или /room/DRAGON-42
  const urlMatch = clean.match(/\/room\/([a-zA-Z0-9_\-]+)/i);
  if (urlMatch) {
    clean = urlMatch[1];
  }
  return clean
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Проверяет валидность формата кода комнаты
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  // Минимум одна буква/префикс и суффикс через дефис
  return /^[A-Z0-9]{3,20}(-[A-Z0-9]{1,10})+$/.test(code);
}
