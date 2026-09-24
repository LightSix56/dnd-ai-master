/**
 * Хелперы для управления синхронизацией настроек кампании
 * и предотвращения паразитных авто-прокруток экрана при периодическом опросе (polling).
 */

/**
 * Определяет, нужно ли перезаписать локальные поля формы настроек кампании.
 * Разрешает синхронизацию только при смене ID кампании или при первоначальной загрузке.
 * Запрещает повторную перезапись при циклическом опросе той же кампании,
 * сохраняя выбранные пользователем селекторы и введенные заметки.
 */
export function shouldSyncCampaignSettings(
  currentLoadedId: string | null,
  newCampaignId: string | null
): boolean {
  if (!newCampaignId) return false;
  return currentLoadedId !== newCampaignId;
}

export interface AutoScrollChatOptions {
  messagesCount: number;
  prevMessagesCount: number;
  isInitial: boolean;
  isNearBottom: boolean;
}

/**
 * Определяет, нужно ли запускать авто-скролл вниз.
 * - Никогда не скроллит, если сообщений 0 (экран настройки сюжета и отряда).
 * - Скроллит мгновенно при первой загрузке существующей истории диалога.
 * - При поступлении НОВЫХ сообщений скроллит только если пользователь находится у нижней границы (следит за чатом).
 * - Если пользователь отскроллил наверх читать историю — не прерывает чтение.
 * - При фоновом опросе без добавления новых сообщений — не скроллит.
 */
export function shouldAutoScrollChat(options: AutoScrollChatOptions): boolean {
  const { messagesCount, prevMessagesCount, isInitial, isNearBottom } = options;

  if (messagesCount === 0) {
    return false;
  }

  if (isInitial) {
    return true;
  }

  if (messagesCount > prevMessagesCount) {
    return isNearBottom;
  }

  return false;
}
