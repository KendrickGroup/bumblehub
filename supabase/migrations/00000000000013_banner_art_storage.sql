-- Banner product shots for the Latigo strap on Ranch House Radio.
-- Public read so /radio can rotate images; members upload into their hive folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banner-art',
  'banner-art',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "banner-art public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banner-art');

CREATE POLICY "banner-art member upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banner-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "banner-art member update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banner-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'banner-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "banner-art member delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'banner-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);
