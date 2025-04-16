#!/bin/bash

# gaku-co RAGアップローダー実行スクリプト

# 環境変数設定
echo "[INFO] 環境確認中..."
# .envファイルを絶対パスで探す
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
echo "[INFO] .envファイルパス: ${ENV_FILE}"

# .envファイルが存在する場合はロード
if [ -f "${ENV_FILE}" ]; then
  export $(grep -v '^#' ${ENV_FILE} | xargs)
  echo "[SUCCESS] 環境確認完了 - ${ENV_FILE} をロードしました"
else
  echo "[WARNING] .envファイルが見つかりません。環境変数が別途設定されていることを確認してください。"
fi

# 引数チェック
if [ "$1" == "" ]; then
  echo "使用法: ./run_uploader.sh <フォルダパス> [オプション]"
  echo "オプション:"
  echo "  --source-type, -t <type>   ドキュメントのソースタイプを指定（デフォルト: system_info）"
  echo "  --skip-chunking           チャンキング処理をスキップ"
  echo "  --verbose, -v             詳細なログを表示"
  echo "  --delete, -d <id>         指定IDのドキュメントを削除"
  exit 1
fi

echo "[INFO] すべてのテストドキュメントをアップロード"

if [ "$1" == "test" ]; then
  # テスト用の処理
  TEST_DIR="/home/tukapontas/ai-secretary2/test-docs"
  
  # テストディレクトリの作成
  if [ ! -d "$TEST_DIR" ]; then
    mkdir -p "$TEST_DIR"
    echo "# サンプルシステム情報" > "$TEST_DIR/sample_system.md"
    echo "システム情報のサンプルです。" >> "$TEST_DIR/sample_system.md"
    echo "これはRAGシステムのテスト用です。" >> "$TEST_DIR/sample_system.md"
    
    # サンプルJSONも作成
    cat > "$TEST_DIR/sample_config.json" << 'INNERJSON'
{
  "title": "システム設定サンプル",
  "content": "これはJSONフォーマットのサンプルコンテンツです。\\nRAGシステムのテスト用に使用します。",
  "source_type": "system_info",
  "metadata": {
    "category": "設定",
    "version": "1.0"
  }
}
INNERJSON
  fi
  
  # テストディレクトリでアップローダーを実行
  echo "[INFO] アップローダーを実行: ソースタイプ 'system_info' ディレクトリ '$TEST_DIR'"
  FOLDER_PATH="$TEST_DIR"
  ARGS="-t system_info --verbose"
else
  # 通常の処理
  FOLDER_PATH="$1"
  shift
  ARGS="$@"
fi

# 環境変数を確実に読み込むためのヘルパースクリプト実行
node /home/tukapontas/ai-secretary2/scripts/rag/ensure_env.js

# アップローダースクリプトの実行
COMMAND="ts-node /home/tukapontas/ai-secretary2/scripts/rag/upload_documents.ts $FOLDER_PATH $ARGS"
echo "[INFO] コマンド: $COMMAND"

exec $COMMAND
