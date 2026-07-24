-- Home Info sections (house manual) for BumbleHub

CREATE TABLE IF NOT EXISTS public.info_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  icon text,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS info_sections_property_order_idx
  ON public.info_sections (property_id, display_order);

ALTER TABLE public.info_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "info_sections member select"
ON public.info_sections
FOR SELECT
TO authenticated
USING (is_property_member(property_id));

CREATE POLICY "info_sections member insert"
ON public.info_sections
FOR INSERT
TO authenticated
WITH CHECK (is_property_member(property_id));

CREATE POLICY "info_sections member update"
ON public.info_sections
FOR UPDATE
TO authenticated
USING (is_property_member(property_id))
WITH CHECK (is_property_member(property_id));

CREATE POLICY "info_sections member delete"
ON public.info_sections
FOR DELETE
TO authenticated
USING (is_property_member(property_id));

CREATE OR REPLACE FUNCTION public.touch_info_sections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS info_sections_updated_at ON public.info_sections;
CREATE TRIGGER info_sections_updated_at
  BEFORE UPDATE ON public.info_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_info_sections_updated_at();
