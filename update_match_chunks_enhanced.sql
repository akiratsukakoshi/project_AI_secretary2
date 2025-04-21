-- match_chunks_enhanced関数の更新
DROP FUNCTION IF EXISTS match_chunks_enhanced;
CREATE OR REPLACE FUNCTION match_chunks_enhanced(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_source_type text DEFAULT NULL,
  keyword text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  document_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- デバッグメッセージ出力
  RAISE NOTICE 'match_chunks_enhanced実行: filter_source_type = %', filter_source_type;

  IF keyword IS NOT NULL THEN
    RETURN QUERY
    SELECT
      chunks.id,
      chunks.content,
      chunks.metadata,
      chunks.document_id,
      (1 - (chunks.embedding <=> query_embedding)) * 
      CASE 
        WHEN chunks.content ILIKE '%' || keyword || '%' THEN 1.2
        WHEN chunks.metadata->>'title' ILIKE '%' || keyword || '%' THEN 1.3
        WHEN chunks.metadata->>'summary' ILIKE '%' || keyword || '%' THEN 1.1
        WHEN chunks.metadata::text ILIKE '%"tags"%' || keyword || '%' THEN 1.15
        ELSE 1.0
      END AS similarity
    FROM chunks
    JOIN documents ON chunks.document_id = documents.id
    WHERE (1 - (chunks.embedding <=> query_embedding)) > match_threshold
      AND (
        filter_source_type IS NULL 
        OR COALESCE(chunks.metadata->>'source_type', '') = filter_source_type
        OR COALESCE(documents.source_type, '') = filter_source_type
      )
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      chunks.id,
      chunks.content,
      chunks.metadata,
      chunks.document_id,
      (1 - (chunks.embedding <=> query_embedding)) AS similarity
    FROM chunks
    JOIN documents ON chunks.document_id = documents.id
    WHERE (1 - (chunks.embedding <=> query_embedding)) > match_threshold
      AND (
        filter_source_type IS NULL 
        OR COALESCE(chunks.metadata->>'source_type', '') = filter_source_type
        OR COALESCE(documents.source_type, '') = filter_source_type
      )
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$;

-- 更新完了メッセージ
RAISE NOTICE 'match_chunks_enhanced関数が更新されました'; 