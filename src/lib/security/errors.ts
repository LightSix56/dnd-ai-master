export function safeErrorDetails(error: unknown): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return error instanceof Error ? error.message : String(error);
}
