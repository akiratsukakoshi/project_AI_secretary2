-- vector_search.sql
-- このSQLファイルをSupabaseのSQL Editorで実行して、ベクトル検索用の関数を作成します

-- 既存の関数を削除し、新しい関数を作成
DROP FUNCTION IF EXISTS match_chunks;

-- ベクトル検索関数の作成
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_source_type text DEFAULT NULL
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
  IF filter_source_type IS NULL THEN
    RETURN QUERY
    SELECT
      chunks.id,
      chunks.content,
      chunks.metadata,
      chunks.document_id,
      1 - (chunks.embedding <=> query_embedding) AS similarity
    FROM chunks
    WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      chunks.id,
      chunks.content,
      chunks.metadata,
      chunks.document_id,
      1 - (chunks.embedding <=> query_embedding) AS similarity
    FROM chunks
    JOIN documents ON chunks.document_id = documents.id
    WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
      AND documents.source_type = filter_source_type
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$;

-- 既存の関数を削除
DROP FUNCTION IF EXISTS search_documents;

-- ドキュメント情報を含む検索結果を返す関数
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_source_type text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  chunk_content text,
  chunk_metadata jsonb,
  document_id uuid,
  document_title text,
  document_source_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF filter_source_type IS NULL THEN
    RETURN QUERY
    SELECT
      c.id AS chunk_id,
      c.content AS chunk_content,
      c.metadata AS chunk_metadata,
      d.id AS document_id,
      d.title AS document_title,
      d.source_type AS document_source_type,
      1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
  ELSE
    RETURN QUERY
    SELECT
      c.id AS chunk_id,
      c.content AS chunk_content,
      c.metadata AS chunk_metadata,
      d.id AS document_id,
      d.title AS document_title,
      d.source_type AS document_source_type,
      1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
      AND d.source_type = filter_source_type
    ORDER BY similarity DESC
    LIMIT match_count;
  END IF;
END;
$$;
