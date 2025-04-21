-- 指定されたUUIDに関連するドキュメント情報の確認
-- ドキュメントとして検索
SELECT 
  'document' as type,
  id,
  title,
  source_type,
  source_id,
  created_at
FROM documents
WHERE id = '96757124-dd0a-4d90-9e73-9add69e58128';

-- チャンクとして検索
SELECT 
  'chunk' as type,
  id,
  document_id,
  metadata->>'source_type' as metadata_source_type,
  metadata->>'title' as metadata_title,
  created_at
FROM chunks
WHERE id = '96757124-dd0a-4d90-9e73-9add69e58128';

-- ドキュメントIDとして関連チャンクを検索
SELECT 
  'chunk_of_document' as type,
  id,
  metadata->>'source_type' as metadata_source_type,
  metadata->>'title' as metadata_title,
  substring(content, 1, 100) as content_preview
FROM chunks
WHERE document_id = '96757124-dd0a-4d90-9e73-9add69e58128'
LIMIT 5;

-- organization_info ソースタイプのデータ確認
SELECT 
  'organization_info_check' as type,
  c.id,
  c.metadata->>'source_type' as metadata_source_type,
  d.source_type as document_source_type,
  substring(c.content, 1, 100) as content_preview
FROM chunks c
LEFT JOIN documents d ON c.document_id = d.id
WHERE 
  c.metadata->>'source_type' = 'organization_info' 
  OR d.source_type = 'organization_info'
LIMIT 5; 