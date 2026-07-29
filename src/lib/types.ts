export type Property = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type Scene = {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  accent_color: string | null;
  display_order: number;
  is_favorite: boolean;
};

export type Photo = {
  id: string;
  property_id: string | null;
  url: string;
  caption: string | null;
  taken_at: string | null;
  category: string | null;
  is_curated: boolean;
  created_by: string | null;
  created_at: string;
  share_token?: string | null;
  watermarked_url?: string | null;
};
