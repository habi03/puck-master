GRANT SELECT ON public.public_leagues TO authenticated, anon;

-- Server-side avatar upload restrictions: own folder, image extensions only (no SVG), max 5MB
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','gif','webp')
  AND (metadata IS NULL OR COALESCE((metadata->>'size')::bigint, 0) <= 5242880)
  AND (metadata IS NULL OR COALESCE(metadata->>'mimetype', 'image/jpeg') IN ('image/jpeg','image/png','image/gif','image/webp'))
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','gif','webp')
  AND (metadata IS NULL OR COALESCE((metadata->>'size')::bigint, 0) <= 5242880)
  AND (metadata IS NULL OR COALESCE(metadata->>'mimetype', 'image/jpeg') IN ('image/jpeg','image/png','image/gif','image/webp'))
);