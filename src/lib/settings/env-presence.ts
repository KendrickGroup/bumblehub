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
