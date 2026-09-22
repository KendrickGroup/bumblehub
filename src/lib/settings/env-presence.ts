export type EnvPresence = {
  key: string;
  label: string;
  present: boolean;
  required: boolean;
};

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** Server-only. Values are never returned — presence only. */
export function listEnvPresence(): EnvPresence[] {
  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase URL",
      present: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      present: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: true,
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service role",
      present: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
    },
    {
      key: "SPOTIFY_CLIENT_ID",
      label: "Spotify client ID",
      present: present(process.env.SPOTIFY_CLIENT_ID),
      required: true,
    },
    {
      key: "SPOTIFY_CLIENT_SECRET",
      label: "Spotify client secret",
      present: present(process.env.SPOTIFY_CLIENT_SECRET),
      required: true,
    },
    {
      key: "NEXT_PUBLIC_ROUNDUP_PLAYLIST_URL",
      label: "Roundup playlist URL",
      present: present(process.env.NEXT_PUBLIC_ROUNDUP_PLAYLIST_URL),
      required: true,
    },
    {
      key: "SHOPIFY_STORE_DOMAIN",
      label: "Shopify store domain",
      present: present(process.env.SHOPIFY_STORE_DOMAIN),
      required: true,
    },
    {
      key: "SHOPIFY_CLIENT_ID",
      label: "Shopify client ID",
      present: present(process.env.SHOPIFY_CLIENT_ID),
      required: true,
    },
    {
      key: "SHOPIFY_CLIENT_SECRET",
      label: "Shopify client secret",
      present: present(process.env.SHOPIFY_CLIENT_SECRET),
      required: true,
    },
    {
      key: "KLAVIYO_PRIVATE_KEY",
      label: "Klaviyo private key",
      present: present(process.env.KLAVIYO_PRIVATE_KEY),
      required: false,
    },
    {
      key: "KLAVIYO_LIST_ID",
      label: "Klaviyo list ID",
      present: present(process.env.KLAVIYO_LIST_ID),
      required: false,
    },
    {
      key: "NEXT_PUBLIC_RECOGNITION_ENABLED",
      label: "Song recognition flag",
      present: present(process.env.NEXT_PUBLIC_RECOGNITION_ENABLED),
      required: false,
    },
    {
      key: "AUDD_API_TOKEN",
      label: "AudD API token",
      present: present(process.env.AUDD_API_TOKEN),
      required: false,
    },
    {
      key: "AUDD_MONTHLY_LIMIT",
      label: "AudD monthly limit",
      present: present(process.env.AUDD_MONTHLY_LIMIT),
      required: false,
    },
    {
      key: "ANTHROPIC_API_KEY",
      label: "Anthropic API key",
      present: present(process.env.ANTHROPIC_API_KEY),
      required: false,
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Site URL",
      present: present(process.env.NEXT_PUBLIC_SITE_URL),
      required: false,
    },
    {
      key: "NEXT_PUBLIC_RADIO_HOST",
      label: "Public radio host",
      present: present(process.env.NEXT_PUBLIC_RADIO_HOST),
      required: false,
    },
    {
      key: "PUBLIC_RADIO_PROPERTY_ID",
      label: "Public radio property",
      present: present(process.env.PUBLIC_RADIO_PROPERTY_ID),
      required: false,
    },
  ];
}
