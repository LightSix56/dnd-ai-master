// Архитектура кэширования контекста LLM (Prompt Caching / DeepSeek KV-cache)
// Экспорт публичных модулей трёх зон контекста:
// Зона 1: Frozen Prefix (замороженный системный промпт и инструменты)
// Зона 2: Append-Only Stream / Milestone Compactor (дискретное сжатие вехами)
// Зона 3: Ephemeral Tail (срез динамического состояния сцены и инжекция в последнее сообщение)

export * from "./frozen-prefix";
export * from "./milestone-compactor";
export * from "./ephemeral-tail";

