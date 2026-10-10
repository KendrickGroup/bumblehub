-- Chart art uploads go straight to storage, so the cap is the bucket
-- limit rather than the platform request-body limit.
UPDATE storage.buckets
SET file_size_limit = 16777216
WHERE id = 'chart-art';
