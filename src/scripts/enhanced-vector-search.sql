-- src/scripts/enhanced-vector-search.sql
-- RAG検索強化用のSQL関数

-- テキスト検索機能拡張の有効化（日本語検索用）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 必要なインデックスの作成
DROP INDEX IF EXISTS idx_chunks_metadata_title;
DROP INDEX IF EXISTS idx_chunks_metadata_summary;
DROP INDEX IF EXISTS idx_chunks_metadata_tags;
DROP INDEX IF EXISTS idx_chunks_source_type;

-- メタデータタイトル検索用のGINインデックス
CREATE INDEX idx_chunks_metadata_title ON chunks USING GIN ((metadata->>'title') gin_trgm_ops);

-- メタデータサマリー検索用のGINインデックス
CREATE INDEX idx_chunks_metadata_summary ON chunks USING GIN ((metadata->>'summary') gin_trgm_ops);

-- メタデータタグ検索用のGINインデックス
CREATE INDEX idx_chunks_metadata_tags ON chunks USING GIN (metadata jsonb_path_ops);

-- ソースタイプ検索用のインデックス
CREATE INDEX idx_chunks_source_type ON chunks ((metadata->>'source_type'));

-- 1. メタデータ重み付け検索
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

-- 2. タグベースのフィルタリング機能
DROP FUNCTION IF EXISTS match_chunks_by_tags;
CREATE OR REPLACE FUNCTION match_chunks_by_tags(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  tags text[] DEFAULT NULL
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
  IF tags IS NULL OR array_length(tags, 1) IS NULL THEN
    RETURN QUERY
    SELECT * FROM match_chunks(query_embedding, match_threshold, match_count);
  ELSE
    RETURN QUERY
    SELECT
      chunks.id,
      chunks.content,
      chunks.metadata,
      chunks.document_id,
      1 - (chunks.embedding <=> query_embedding) AS similarity
    FROM chunks
    WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
      AND chunks.metadata::text ILIKE ANY (SELECT '%' || tag || '%' FROM unnest(tags) AS tag)
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$;

-- 3. ハイブリッド検索（キーワード + ベクトル検索）
DROP FUNCTION IF EXISTS hybrid_search;
CREATE OR REPLACE FUNCTION hybrid_search(
  search_query text,
  match_count int,
  source_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  document_id uuid,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 外部API呼び出しが必要なembedding生成はサポートせず
  -- 単純なキーワードマッチとメタデータ一致スコアで代用
  RETURN QUERY
  SELECT 
    c.id,
    c.content,
    c.metadata,
    c.document_id,
    CASE 
      WHEN c.content ILIKE '%' || search_query || '%' THEN 1.0
      WHEN c.metadata->>'title' ILIKE '%' || search_query || '%' THEN 0.9
      WHEN c.metadata->>'summary' ILIKE '%' || search_query || '%' THEN 0.8
      ELSE 0.7
    END AS score
  FROM chunks c
  WHERE (source_type IS NULL OR COALESCE(c.metadata->>'source_type', '') = source_type)
    AND (
      c.content ILIKE '%' || search_query || '%' OR
      c.metadata->>'title' ILIKE '%' || search_query || '%' OR
      c.metadata->>'summary' ILIKE '%' || search_query || '%' OR
      c.metadata::text ILIKE '%' || search_query || '%'
    )
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- 4. コンテキスト強化検索
DROP FUNCTION IF EXISTS contextual_search;
CREATE OR REPLACE FUNCTION contextual_search(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  context_count int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  document_id uuid,
  similarity float,
  context_level int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH direct_matches AS (
    SELECT
      id,
      content,
      metadata,
      document_id,
      1 - (embedding <=> query_embedding) AS similarity,
      0 AS context_level
    FROM chunks
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count
  ),
  context_chunks AS (
    SELECT
      c.id,
      c.content,
      c.metadata,
      c.document_id,
      0.5 AS similarity,
      CASE
        WHEN (c.metadata->>'chunk_index')::int < (dm.metadata->>'chunk_index')::int THEN -1
        ELSE 1
      END AS context_level
    FROM direct_matches dm
    JOIN chunks c ON c.document_id = dm.document_id
    WHERE 
      c.id != dm.id AND
      (
        (c.metadata->>'chunk_index')::int = (dm.metadata->>'chunk_index')::int - 1 OR
        (c.metadata->>'chunk_index')::int = (dm.metadata->>'chunk_index')::int + 1
      )
    LIMIT match_count * context_count
  )
  SELECT * FROM direct_matches
  UNION ALL
  SELECT * FROM context_chunks
  ORDER BY context_level, similarity DESC;
END;
$$; 