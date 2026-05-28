-- Guestbook photo storage for BumbleHub
-- Run via Supabase CLI or SQL editor after linking the project.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guestbook',
  'guestbook',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read (slideshow + direct URLs)
CREATE POLICY "guestbook public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'guestbook');

-- Property members upload into their hive folder: {property_id}/{uuid}.jpg
CREATE POLICY "guestbook member upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guestbook'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

-- Members can delete their property's guestbook files (optional cleanup)
CREATE POLICY "guestbook member delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guestbook'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);
