# RAGアップローダースクリプト

## 概要

このスクリプトは、様々な形式のドキュメントを処理してRAGシステム用のSupabaseデータベースに格納するツールです。Markdown（フロントマター対応）、JSON、テキストなどの形式に対応しています。

## 使用方法

```bash
# 基本的な使い方
ts-node upload_documents.ts <フォルダパス> [オプション]

# 例: システム情報としてドキュメントをアップロード
ts-node upload_documents.ts /path/to/docs --source-type system_info

# 例: 詳細ログを表示
ts-node upload_documents.ts /path/to/docs --verbose

# 例: チャンキングをスキップ
ts-node upload_documents.ts /path/to/docs --skip-chunking

# 例: ドキュメントを削除
ts-node upload_documents.ts --delete document_id
```

## オプション

- `--source-type, -t <type>`: ドキュメントのソースタイプを指定（デフォルト: system_info）
- `--skip-chunking`: チャンキング処理をスキップ
- `--verbose, -v`: 詳細ログを表示
- `--batch, -b [size]`: バッチ処理を有効化（オプションでサイズ指定）
- `--delete, -d <id>`: 指定IDのドキュメントを削除

## サポートしているファイル形式

1. **JSON**
   ```json
   {
     "title": "タイトル",
     "content": "本文内容",
     "source_type": "system_info",
     "metadata": {
       "key": "value"
     }
   }
   ```

2. **Markdown（フロントマター対応）**
   ```markdown
   ---
   source_type: faq
   category: general
   tags: [basic, introduction]
   ---

   # タイトル

   ドキュメント本文
   ```

3. **テキスト**
   - ファイル名がタイトルとして使用されます
   - ソースタイプはコマンドラインオプションか、フォルダ名から推定されます

## 主な機能

- **動的コンテンツタイプ検出**: ファイル内容、フロントマター、パスから最適なソースタイプを検出
- **自動更新**: 既存ドキュメントの検出と更新、変更がない場合は処理スキップ
- **チャンク生成**: 各コンテンツタイプに最適化されたチャンキング
- **メタデータ対応**: チャンクに適切なメタデータを付与

## 実行環境

Node.js + TypeScriptが必要です。以下の依存関係が必要です：

- fs
- path
- crypto
- @supabase/supabase-js

## 注意事項

- 大量のファイルを処理する場合はバッチサイズを調整してください
- 更新処理はファイルパスとメタデータのdocument_idに基づきます
