-- ベクトル拡張の有効化
create extension if not exists vector;

-- ドキュメントテーブル
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source_type text not null, -- 'faq', 'event', 'customer', 'meeting_note', 'system_info' など
  source_id text, -- 元データのID（必要に応じて）
  metadata jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- チャンクテーブル
create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  metadata jsonb, -- 検索フィルタリング用のメタデータ
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 会話履歴テーブル（永続化用）
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  channel_id text not null,
  messages jsonb not null, -- 会話メッセージの配列
  summary text, -- 長い会話のサマリー
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- インデックスの作成
-- ベクトル検索用のインデックス
create index if not exists chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- ドキュメント検索用インデックス
create index if not exists documents_source_type_idx on documents(source_type);
create index if not exists documents_source_id_idx on documents(source_id);

-- チャンク検索用インデックス
create index if not exists chunks_document_id_idx on chunks(document_id);

-- 会話履歴検索用インデックス
create index if not exists conversations_user_channel_idx on conversations(user_id, channel_id);

-- ベクトル検索のための関数
-- この関数を使用して類似検索を行います
create or replace function match_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  document_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chunks.id,
    chunks.content,
    chunks.metadata,
    chunks.document_id,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;

-- トリガー：ドキュメントの更新日時を自動更新
create or replace function update_timestamp_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_documents_timestamp
before update on documents
for each row
execute function update_timestamp_column();

create trigger update_chunks_timestamp
before update on chunks
for each row
execute function update_timestamp_column();

create trigger update_conversations_timestamp
before update on conversations
for each row
execute function update_timestamp_column();
