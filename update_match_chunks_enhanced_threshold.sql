-- match_chunks_enhanced関数の更新（閾値調整版）
DROP FUNCTION IF EXISTS match_chunks_enhanced;
CREATE OR REPLACE FUNCTION match_chunks_enhanced(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3, -- 閾値を0.5から0.3に下げる（デフォルト値を変更）
  match_count int DEFAULT 10, -- デフォルト取得件数を増やす
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
DECLARE
  actual_threshold float := 0.3; -- 実際に使用する閾値を0.3に固定
BEGIN
  -- デバッグメッセージ出力
  RAISE NOTICE 'match_chunks_enhanced実行: filter_source_type = %, threshold = %', filter_source_type, actual_threshold;

  -- 無効なパラメータのチェック
  IF filter_source_type = '' THEN
    filter_source_type := NULL;
  END IF;

  -- match_thresholdパラメータが指定されていても、より低い閾値を使用
  IF match_threshold > actual_threshold THEN
    match_threshold := actual_threshold;
  END IF;

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
    LEFT JOIN documents ON chunks.document_id = documents.id
    WHERE (1 - (chunks.embedding <=> query_embedding)) > actual_threshold -- 固定の閾値を使用
      AND (
        filter_source_type IS NULL 
        OR chunks.metadata->>'source_type' = filter_source_type
        OR documents.source_type = filter_source_type
        OR chunks.metadata->>'source_type' ILIKE '%' || filter_source_type || '%'
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
    LEFT JOIN documents ON chunks.document_id = documents.id
    WHERE (1 - (chunks.embedding <=> query_embedding)) > actual_threshold -- 固定の閾値を使用
      AND (
        filter_source_type IS NULL 
        OR chunks.metadata->>'source_type' = filter_source_type
        OR documents.source_type = filter_source_type
        OR chunks.metadata->>'source_type' ILIKE '%' || filter_source_type || '%'
      )
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;

  -- 結果数をログに出力
  RAISE NOTICE 'match_chunks_enhanced検索結果数: %', (SELECT COUNT(*) FROM (
    SELECT 1 FROM chunks 
    LEFT JOIN documents ON chunks.document_id = documents.id
    WHERE (1 - (chunks.embedding <=> query_embedding)) > actual_threshold -- 固定の閾値を使用
      AND (
        filter_source_type IS NULL 
        OR chunks.metadata->>'source_type' = filter_source_type
        OR documents.source_type = filter_source_type
        OR chunks.metadata->>'source_type' ILIKE '%' || filter_source_type || '%'
      )
    LIMIT match_count
  ) t);
END;
$$;

-- ベクトル検索のデバッグ用関数
CREATE OR REPLACE FUNCTION debug_vector_similarity(
  query_text text,
  filter_source_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content_preview text,
  metadata_source_type text,
  document_source_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- クエリのベクトル埋め込みを生成（この部分はダミー、実際には埋め込みAPIを使用）
  -- この関数は単なるデバッグ用なので、実際の埋め込みは使用しない
  SELECT embedding INTO query_embedding FROM chunks LIMIT 1;
  
  RETURN QUERY
  SELECT
    c.id,
    substring(c.content, 1, 100) as content_preview,
    c.metadata->>'source_type' as metadata_source_type,
    d.source_type as document_source_type,
    (1 - (c.embedding <=> query_embedding)) AS similarity
  FROM chunks c
  LEFT JOIN documents d ON c.document_id = d.id
  WHERE (
    filter_source_type IS NULL 
    OR c.metadata->>'source_type' = filter_source_type
    OR d.source_type = filter_source_type
    OR c.metadata->>'source_type' ILIKE '%' || filter_source_type || '%'
  )
  ORDER BY similarity DESC
  LIMIT 10;
END;
$$;

-- 更新完了メッセージ
RAISE NOTICE 'match_chunks_enhanced関数が閾値0.3で更新されました'; 