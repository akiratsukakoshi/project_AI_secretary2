-- ワークフローの状態管理用テーブル
CREATE TABLE IF NOT EXISTS workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS workflow_states_user_id_idx ON workflow_states (user_id);
CREATE INDEX IF NOT EXISTS workflow_states_updated_at_idx ON workflow_states (updated_at);

-- TTLインデックス（自動クリーンアップのため）
COMMENT ON TABLE workflow_states IS 'ワークフローの状態を保存するテーブル。30分以上更新がないものは期限切れとみなす';
