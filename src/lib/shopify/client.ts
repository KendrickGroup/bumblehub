/**
 * Shopify API access for the Latigo store.
 *
 * The shop runs a Dev Dashboard custom app, which never hands out a token in
 * the admin UI. Instead the app trades its own Client ID and Client Secret for
 * a 24h access token (client credentials grant), then sends that token as
 * X-Shopify-Access-Token.
 *
 * That admin token is the key to both doors. This app was granted
 * unauthenticated_read_product_listings, a Storefront scope, so products are
 * read by delegating that one scope down to a private Storefront token — which
 * is also the only place a store-wide BEST_SELLING sort exists. The Admin
 * product path stays as the fallback for whenever read_products is granted.
 *
 * Everything here is server-only: the secret and the tokens must never reach
 * the browser, so nothing in this file may be imported from a client component.
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

/**
 * Either of these reads products: the Storefront scope by delegation, or the
 * Admin scope directly. Only when the app holds neither is there nothing to do
 * but name them.
 */
export const STOREFRONT_PRODUCT_SCOPE = "unauthenticated_read_product_listings";
export const ADMIN_PRODUCT_SCOPE = "read_products";
export const PRODUCT_SCOPES = [STOREFRONT_PRODUCT_SCOPE, ADMIN_PRODUCT_SCOPE] as const;

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

type DelegateToken = { token: string; expiresAt: number };

let delegateCache: DelegateToken | null = null;
let delegateInFlight: Promise<string> | null = null;

/** A delegate can't outlive its parent, so stay well inside the 24h token. */
const DELEGATE_TTL_SECONDS = 12 * 60 * 60;

async function requestDelegateToken(): Promise<string> {
  const data = await adminGraphql<{
    delegateAccessTokenCreate: {
      delegateAccessToken: { accessToken: string | null } | null;
      userErrors: { field: string[] | null; message: string }[];
    } | null;
  }>(
    `mutation Delegate($input: DelegateAccessTokenInput!) {
      delegateAccessTokenCreate(input: $input) {
        delegateAccessToken { accessToken }
        userErrors { field message }
      }
    }`,
    {
      input: {
        delegateAccessScope: [STOREFRONT_PRODUCT_SCOPE],
        expiresIn: DELEGATE_TTL_SECONDS,
      },
    },
  );

  const result = data.delegateAccessTokenCreate;
  const userError = result?.userErrors?.[0];
  if (userError) {
    throw new ShopifyError("delegate_refused", userError.message);
  }
  const token = result?.delegateAccessToken?.accessToken ?? "";
  if (!token) {
    throw new ShopifyError("delegate_empty", "Shopify returned no delegate token");
  }
  delegateCache = {
    token,
    expiresAt: Date.now() + DELEGATE_TTL_SECONDS * 1000 - TOKEN_SKEW_MS,
  };
  return token;
}

export async function getStorefrontToken(): Promise<string> {
  if (delegateCache && delegateCache.expiresAt > Date.now()) return delegateCache.token;
  if (delegateInFlight) return delegateInFlight;
  delegateInFlight = requestDelegateToken().finally(() => {
    delegateInFlight = null;
  });
  return delegateInFlight;
}

/**
 * Storefront reads with the delegated token. No Shopify-Storefront-Buyer-IP
 * header: this runs once an hour for the cache, not once per listener, so
 * there is no buyer whose IP could be forwarded.
 */
export async function storefrontGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
  retryOnAuth = true,
): Promise<T> {
  const config = shopifyConfig();
  const token = await getStorefrontToken();
  const response = await fetch(
    `https://${config.adminDomain}/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (response.status === 401 || response.status === 403) {
    // The delegate died with its parent; mint a fresh pair and try once more.
    delegateCache = null;
    if (retryOnAuth) return storefrontGraphql<T>(query, variables, false);
    throw new ShopifyError(
      "unauthorized",
      `Storefront API refused the token (${response.status})`,
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
      `Storefront API returned ${response.status} without JSON`,
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
    throw new ShopifyError(
      "graphql_empty",
      "Storefront API returned no data",
      response.status,
    );
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

/** Empty when the app can read products by either route. */
export function missingScopes(granted: string[]): string[] {
  const held = new Set(granted);
  if (PRODUCT_SCOPES.some((scope) => held.has(scope))) return [];
  return [...PRODUCT_SCOPES];
}
