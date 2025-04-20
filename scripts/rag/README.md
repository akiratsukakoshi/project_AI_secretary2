# RAGアップローダースクリプト

## 概要

このスクリプトは、様々な形式のドキュメントを処理してRAGシステム用のSupabaseデータベースに格納するツールです。Markdown（フロントマター対応）、JSON、テキストなどの形式に対応しています。検索精度を高めるため、拡張メタデータとインテリジェントなチャンキングを実装しています。

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
       "summary": "ドキュメントの要約",
       "tags": ["教育", "大学", "情報"],
       "document_title": "ドキュメント全体のタイトル"
     }
   }
   ```

2. **Markdown（フロントマター対応）**
   ```markdown
   ---
   source_type: faq
   summary: ドキュメントの簡潔な要約
   tags: 
     - 基本
     - 入門
     - ガイド
   ---

   # タイトル

   ドキュメント本文
   ```

3. **テキスト**
   - 自動的にタイトル、要約、タグが生成されます
   - 見出しやコンテンツから意味的な情報が抽出されます

## 主な機能

- **拡張メタデータ**: 各チャンクには以下の強化されたメタデータが付与されます
  - `title`: 内容に基づいた具体的なタイトル
  - `summary`: 内容の要約（自動生成）
  - `tags`: コンテンツから抽出した検索キーワード
  - `source_type`: ソースタイプ（文書分類）
  - `document_title`: 元ドキュメントのタイトル
  - `chunk_index` / `total_chunks`: ドキュメント内での位置関係
  
- **インテリジェントなタグ抽出**: ファイル内容やファイル名から自動的に関連タグを抽出
- **要約生成**: 各チャンクの内容から自動的に要約を生成
- **動的タイトル抽出**: 見出しやコンテンツからタイトルを抽出・生成
- **セキュリティ向上**: 絶対パスなどの機密情報を除去
- **チャンキング最適化**: ドキュメントタイプに応じた最適なチャンク分割
- **自動更新**: 既存ドキュメントの検出と更新、変更がない場合は処理スキップ

## 実行環境

Node.js + TypeScriptが必要です。以下の依存関係が必要です：

- fs
- path
- crypto
- @supabase/supabase-js

## 注意事項

- 大量のファイルを処理する場合はバッチサイズを調整してください
- 更新処理はファイルパスとメタデータのdocument_idに基づきます
- 旧バージョンのメタデータを持つドキュメントも正しく処理されます
