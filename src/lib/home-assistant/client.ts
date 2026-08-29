/**
 * Browser → Home Assistant REST. Vercel never calls these URLs.
 * The wall tablet / phone on the LAN fetches <ha_url>/api/* with the
 * bearer token retrieved from /api/home-assistant/client-config.
 */

export class HomeAssistantUnreachableError extends Error {
  constructor(message = "Can't reach the house right now") {
    super(message);
    this.name = "HomeAssistantUnreachableError";
  }
}

export class HomeAssistantHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HomeAssistantHttpError";
    this.status = status;
  }
}

export type HomeAssistantClientConfig = {
  url: string;
  token: string;
  connected: boolean;
};

export type HaState = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
};

export type HaDeviceRegistryInfo = {
  entity_id: string;
  device_id: string | null;
  connections: unknown;
  identifiers: unknown;
  manufacturer: string | null;
  model: string | null;
};

export type HaHello = {
  message: string;
  version: string | null;
};

type CachedConfig = {
  value: HomeAssistantClientConfig;
  at: number;
};

let cachedConfig: CachedConfig | null = null;
const CONFIG_TTL_MS = 60_000;

export function invalidateHomeAssistantClientConfig(): void {
  cachedConfig = null;
}

export async function fetchHomeAssistantClientConfig(
  opts?: { force?: boolean },
): Promise<HomeAssistantClientConfig> {
  const now = Date.now();
  if (
    !opts?.force &&
    cachedConfig &&
    now - cachedConfig.at < CONFIG_TTL_MS
  ) {
    return cachedConfig.value;
  }

  const response = await fetch("/api/home-assistant/client-config", {
    cache: "no-store",
  });
  const body = (await response.json()) as HomeAssistantClientConfig & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error ?? "Could not load Home Assistant credentials");
  }

  cachedConfig = { value: body, at: now };
  return body;
}

function joinHaUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function haFetch(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (
      init?.body &&
      !headers.has("Content-Type") &&
      !(init.body instanceof FormData)
    ) {
      headers.set("Content-Type", "application/json");
    }

    return await fetch(joinHaUrl(baseUrl, path), {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
  } catch {
    throw new HomeAssistantUnreachableError();
  } finally {
    window.clearTimeout(timer);
  }
}

async function readHaJson<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    throw new HomeAssistantHttpError(
      response.status,
      "Home Assistant rejected the access token",
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HomeAssistantHttpError(
      response.status,
      text || `Home Assistant returned ${response.status}`,
    );
  }
  return (await response.json()) as T;
}

/** GET /api/ hello check, then /api/config for the version string. */
export async function haHello(
  baseUrl: string,
  token: string,
): Promise<HaHello> {
  const helloRes = await haFetch(baseUrl, token, "/api/", { method: "GET" });
  if (helloRes.status === 401 || helloRes.status === 403) {
    throw new HomeAssistantHttpError(
      helloRes.status,
      "Home Assistant rejected the access token",
    );
  }
  if (!helloRes.ok) {
    throw new HomeAssistantHttpError(
      helloRes.status,
      `Home Assistant hello failed (${helloRes.status})`,
    );
  }

  let message = "API running.";
  try {
    const hello = (await helloRes.json()) as { message?: string };
    if (typeof hello.message === "string") message = hello.message;
  } catch {
    // Some HA builds return a non-JSON hello; 200 is enough.
  }

  let version: string | null = null;
  try {
    const configRes = await haFetch(baseUrl, token, "/api/config", {
      method: "GET",
    });
    const config = await readHaJson<{ version?: string }>(configRes);
    version = typeof config.version === "string" ? config.version : null;
  } catch (err) {
    if (err instanceof HomeAssistantUnreachableError) throw err;
    // Hello succeeded; version is optional.
  }

  return {
    message,
    version,
  };
}

export async function haStates(
  baseUrl: string,
  token: string,
): Promise<HaState[]> {
  const response = await haFetch(baseUrl, token, "/api/states", {
    method: "GET",
  }, 15000);
  const data = await readHaJson<HaState[]>(response);
  return Array.isArray(data) ? data : [];
}

/**
 * Device registry is a WebSocket API. REST template can still pull
 * MAC / identifiers for switch.* and light.* when the template engine
 * exposes device_attr. Failures are swallowed — sync still works.
 */
export async function haDeviceRegistryForEntities(
  baseUrl: string,
  token: string,
): Promise<Map<string, HaDeviceRegistryInfo>> {
  const template = `[
{%- set comma = joiner(",") -%}
{%- for s in states.switch %}
{{ comma() }}{"entity_id":{{ s.entity_id | tojson }},"device_id":{{ device_id(s.entity_id) | tojson }},"connections":{{ device_attr(s.entity_id, "connections") | tojson }},"identifiers":{{ device_attr(s.entity_id, "identifiers") | tojson }},"manufacturer":{{ device_attr(s.entity_id, "manufacturer") | tojson }},"model":{{ device_attr(s.entity_id, "model") | tojson }}}
{%- endfor %}
{%- for s in states.light %}
{{ comma() }}{"entity_id":{{ s.entity_id | tojson }},"device_id":{{ device_id(s.entity_id) | tojson }},"connections":{{ device_attr(s.entity_id, "connections") | tojson }},"identifiers":{{ device_attr(s.entity_id, "identifiers") | tojson }},"manufacturer":{{ device_attr(s.entity_id, "manufacturer") | tojson }},"model":{{ device_attr(s.entity_id, "model") | tojson }}}
{%- endfor %}
]`;

  try {
    const response = await haFetch(baseUrl, token, "/api/template", {
      method: "POST",
      body: JSON.stringify({ template }),
    }, 15000);
    if (!response.ok) return new Map();
    const text = await response.text();
    const parsed = JSON.parse(text) as HaDeviceRegistryInfo[];
    const map = new Map<string, HaDeviceRegistryInfo>();
    if (!Array.isArray(parsed)) return map;
    for (const row of parsed) {
      if (row?.entity_id) map.set(row.entity_id, row);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function haCallService(
  baseUrl: string,
  token: string,
  domain: string,
  service: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await haFetch(
    baseUrl,
    token,
    `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
  await readHaJson<unknown>(response);
}

export function entityDomain(entityId: string): string {
  const dot = entityId.indexOf(".");
  return dot > 0 ? entityId.slice(0, dot) : entityId;
}

export function macFromConnections(connections: unknown): string | null {
  if (!Array.isArray(connections)) return null;
  for (const entry of connections) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const kind = String(entry[0]).toLowerCase();
    const value = String(entry[1] ?? "").trim();
    if ((kind === "mac" || kind === "bluetooth") && value) {
      return value.toLowerCase();
    }
  }
  return null;
}

export function isSwitchOrLightEntity(entityId: string): boolean {
  return entityId.startsWith("switch.") || entityId.startsWith("light.");
}
