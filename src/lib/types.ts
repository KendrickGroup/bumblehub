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
