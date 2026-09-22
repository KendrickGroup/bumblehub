/**
 * Shopify Admin API access for the Latigo store.
 *
 * The shop runs a Dev Dashboard custom app, which never hands out a token in
 * the admin UI. Instead the app trades its own Client ID and Client Secret for
 * a 24h access token (client credentials grant), then sends that token as
 * X-Shopify-Access-Token. Everything here is server-only: the secret and the
 * token must never reach the browser, so nothing in this file may be imported
 * from a client component.
 */

import "server-only";

/**
 * Admin calls must hit the *.myshopify.com host. The OAuth endpoint on the
 * custom storefront domain answers with an admin login redirect instead of a
 * token, so SHOPIFY_STORE_DOMAIN (latigocowboy.com, used for product links)
 * cannot double as the admin host.
 */
const DEFAULT_ADMIN_DOMAIN = "rvpxkc-71.myshopify.com";
const DEFAULT_API_VERSION = "2026-07";
const DEFAULT_STORE_DOMAIN = "latigocowboy.com";

/** Scopes this integration needs. Reported by name when one is missing. */
export const REQUIRED_SCOPES = ["read_products"] as const;

export type ShopifyConfig = {
  adminDomain: string;
  storeDomain: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  configured: boolean;
};

export class ShopifyError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = "ShopifyError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Env values pasted from a dashboard sometimes arrive wrapped in brackets or
 * quotes, which Shopify rejects as an invalid secret with no useful error.
 */
function unwrap(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^[[("']+/, "")
    .replace(/[\])"']+$/, "")
    .trim();
}

function hostOnly(value: string): string {
  return unwrap(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function shopifyConfig(): ShopifyConfig {
  const storeRaw = hostOnly(process.env.SHOPIFY_STORE_DOMAIN ?? "");
  const adminRaw = hostOnly(process.env.SHOPIFY_ADMIN_DOMAIN ?? "");
  const adminDomain =
    adminRaw ||
    (storeRaw.endsWith(".myshopify.com") ? storeRaw : DEFAULT_ADMIN_DOMAIN);
  const storeDomain = storeRaw.endsWith(".myshopify.com")
    ? DEFAULT_STORE_DOMAIN
    : storeRaw || DEFAULT_STORE_DOMAIN;
  const clientId = unwrap(process.env.SHOPIFY_CLIENT_ID);
  const clientSecret = unwrap(process.env.SHOPIFY_CLIENT_SECRET);
  const apiVersion = unwrap(process.env.SHOPIFY_API_VERSION) || DEFAULT_API_VERSION;
  return {
    adminDomain,
    storeDomain,
    clientId,
    clientSecret,
    apiVersion,
    configured: Boolean(adminDomain && clientId && clientSecret),
  };
}

type CachedToken = { token: string; expiresAt: number };

let tokenCache: CachedToken | null = null;
let tokenInFlight: Promise<string> | null = null;

/** Client credentials tokens last 24h; refresh a minute early. */
const TOKEN_SKEW_MS = 60_000;

async function requestToken(config: ShopifyConfig): Promise<string> {
  const response = await fetch(
    `https://${config.adminDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
      cache: "no-store",
    },
  );

  const text = await response.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = null;
  }

  if (!body) {
    // A login-page redirect here means the admin host is wrong, not the secret.
    throw new ShopifyError(
      "token_not_json",
      `Token endpoint returned ${response.status} without JSON`,
      response.status,
    );
  }

  const token = typeof body.access_token === "string" ? body.access_token : "";
  if (!token) {
    const code = typeof body.error === "string" ? body.error : "token_missing";
    const detail =
      typeof body.error_description === "string" ? body.error_description : "";
    throw new ShopifyError(code, detail || "No access token returned", response.status);
  }

  const expiresIn =
    typeof body.expires_in === "number" && body.expires_in > 0
      ? body.expires_in
      : 86_399;
  tokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_SKEW_MS,
  };
  return token;
}

export async function getAdminToken(): Promise<string> {
  const config = shopifyConfig();
  if (!config.configured) {
    throw new ShopifyError("not_configured", "Shopify credentials are not set");
  }
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = requestToken(config).finally(() => {
    tokenInFlight = null;
  });
  return tokenInFlight;
}

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

export async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const config = shopifyConfig();
  const token = await getAdminToken();
  const response = await fetch(
    `https://${config.adminDomain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (response.status === 401 || response.status === 403) {
    tokenCache = null;
    throw new ShopifyError(
      "unauthorized",
      `Admin API refused the token (${response.status})`,
      response.status,
    );
  }

  const text = await response.text();
  let body: GraphqlResponse<T> | null = null;
  try {
    body = JSON.parse(text) as GraphqlResponse<T>;
  } catch {
    throw new ShopifyError(
      "graphql_not_json",
      `Admin API returned ${response.status} without JSON`,
      response.status,
    );
  }

  if (body.errors?.length) {
    const first = body.errors[0]!;
    throw new ShopifyError(
      first.extensions?.code ?? "graphql_error",
      first.message,
      response.status,
    );
  }
  if (!body.data) {
    throw new ShopifyError("graphql_empty", "Admin API returned no data", response.status);
  }
  return body.data;
}

/** Scopes the installed app actually holds, for naming what is missing. */
export async function fetchGrantedScopes(): Promise<string[]> {
  const data = await adminGraphql<{
    currentAppInstallation: { accessScopes: { handle: string }[] } | null;
  }>(`{ currentAppInstallation { accessScopes { handle } } }`);
  return (data.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle);
}

export function missingScopes(granted: string[]): string[] {
  const held = new Set(granted);
  return REQUIRED_SCOPES.filter((scope) => !held.has(scope));
}
