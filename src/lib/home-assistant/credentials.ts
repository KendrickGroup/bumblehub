export type HomeAssistantCredentials = {
  access_token: string;
};

export function parseHomeAssistantCredentials(
  raw: unknown,
): HomeAssistantCredentials | null {
  if (!raw || typeof raw !== "object") return null;
  const creds = raw as Record<string, unknown>;
  if (typeof creds.access_token !== "string") return null;
  const access_token = creds.access_token.trim();
  if (!access_token) return null;
  return { access_token };
}
