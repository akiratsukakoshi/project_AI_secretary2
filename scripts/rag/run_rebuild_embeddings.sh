#!/bin/bash

# 実行ディレクトリを設定
cd "$(dirname "$0")"
cd ../..

# JS版がすでにある場合は先に削除
if [ -f "scripts/rag/rebuild_embeddings.js" ]; then
  rm scripts/rag/rebuild_embeddings.js
fi

# TypeScriptをコンパイルしてからJSファイルを実行
echo "TypeScriptコンパイル中..."
npx tsc scripts/rag/rebuild_embeddings.ts --esModuleInterop --resolveJsonModule --target ES2020 --module commonjs

# 実行権限を付与
chmod +x scripts/rag/rebuild_embeddings.js

# 環境変数を確認
echo "環境変数を確認中..."
node scripts/rag/ensure_env.js

# JSファイルを実行
echo "スクリプトを実行中..."
node scripts/rag/rebuild_embeddings.js "$@"
