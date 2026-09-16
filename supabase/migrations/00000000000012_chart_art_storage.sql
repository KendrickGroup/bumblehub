-- Pictorial station-chart art for Ranch House Radio.
-- Public read so /radio can render maps; members upload into their hive folder.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chart-art',
  'chart-art',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "chart-art public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chart-art');

CREATE POLICY "chart-art member upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chart-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "chart-art member update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chart-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'chart-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "chart-art member delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chart-art'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND is_property_member(((storage.foldername(name))[1])::uuid)
);
