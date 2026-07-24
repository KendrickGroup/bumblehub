-- Recipe hero image storage for BumbleHub
-- Mirrors guestbook bucket: public read, member upload/delete by property folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipes',
  'recipes',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "recipes public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'recipes');

CREATE POLICY "recipes member upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipes'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "recipes member delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recipes'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "recipes member update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recipes'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'recipes'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);
