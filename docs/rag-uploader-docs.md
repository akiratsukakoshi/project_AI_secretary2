# RAGアップローダー利用ガイド

## 概要

RAGアップローダーは、gaku-co（ガクコ）AI秘書プロジェクトの検索拡張生成（RAG）システム向けに、ドキュメントを効率的にインデックス化するためのツールです。様々な形式のドキュメントを処理し、適切なチャンキングを行い、Supabaseデータベースに格納します。

## 機能

- **多様なファイル形式のサポート**: JSON、Markdown、テキストファイルを処理
- **メタデータ自動検出**: YAML Front Matter、JSONプロパティからの抽出
- **インテリジェントなチャンキング**: コンテンツタイプに応じた最適分割
- **コンテンツ更新管理**: 既存ドキュメント検出と差分更新
- **コマンドライン操作**: 柔軟なオプション設定と一括処理

## インストール

RAGアップローダーはプロジェクトの一部として既にインストールされています。`/scripts/rag/` ディレクトリに配置されています。

## 使用方法

### 基本的な使い方

```bash
ts-node scripts/rag/upload_documents.ts <フォルダパス> [オプション]
```

このコマンドは指定したフォルダ内のすべてのドキュメントを処理し、RAGシステムにインデックス化します。

### オプション

| オプション | 説明 |
|-----------|------|
| `--source-type, -t <type>` | ドキュメントのソースタイプを指定（デフォルト: `system_info`） |
| `--skip-chunking` | チャンキング処理をスキップ |
| `--verbose, -v` | 詳細なログを表示 |
| `--batch, -b [size]` | バッチ処理を有効化（オプションでサイズ指定） |
| `--delete, -d <id>` | 指定IDのドキュメントを削除 |

### 使用例

#### システム情報ドキュメントのアップロード
```bash
ts-node scripts/rag/upload_documents.ts /path/to/system_docs -t system_info
```

#### FAQ情報のアップロード（詳細ログ付き）
```bash
ts-node scripts/rag/upload_documents.ts /path/to/faq_docs -t faq --verbose
```

#### イベント情報のアップロード（チャンキングなし）
```bash
ts-node scripts/rag/upload_documents.ts /path/to/event_info -t event --skip-chunking
```

#### 特定ドキュメントの削除
```bash
ts-node scripts/rag/upload_documents.ts --delete "document_id_to_delete"
```

## サポートされるファイル形式

### JSON形式

JSONファイルは以下の構造に従うことが期待されます：

```json
{
  "title": "ドキュメントタイトル",
  "content": "ドキュメント本文...",
  "source_type": "system_info",
  "metadata": {
    "category": "使い方",
    "tags": ["ガイド", "入門"]
  }
}
```

### Markdown形式

Markdownファイルは YAML Front Matter をサポートしています：

```markdown
---
title: ドキュメントタイトル
source_type: faq
category: 一般質問
tags: よくある質問, 使い方
---

# ドキュメントタイトル

ドキュメント本文...
```

Front Matter がない場合、ファイル名がタイトルとして使用され、最初の `#` 見出しがある場合はそれが優先されます。

### テキスト形式

テキストファイルはそのままの内容が使用され、ファイル名（拡張子なし）がタイトルとして設定されます。

## ドキュメントタイプ

RAGシステムでは以下のドキュメントタイプがサポートされています：

- `system_info`: システム情報、使い方ガイドなど
- `faq`: よくある質問
- `event`: イベント情報
- `customer`: 顧客情報
- `meeting_note`: 会議録

フォルダ名や指定されたソースタイプに基づいて自動的に推定されますが、明示的に指定することも可能です。

## 更新と削除

- 既存のドキュメントがある場合、変更がある場合のみ更新されます
- ドキュメントIDはファイルパスまたはメタデータの `document_id` に基づいて生成されます
- 削除機能を使用すると、ドキュメントとそれに関連するすべてのチャンクが削除されます

## トラブルシューティング

### よくある問題

1. **ファイルが処理されない**
   - ファイル形式が対応しているか確認（JSON, Markdown, テキスト）
   - ファイルに読み取り権限があるか確認

2. **チャンキングエラー**
   - 大きすぎるファイルの場合は分割を検討
   - `--skip-chunking` オプションを使用して問題を切り分け

3. **更新が反映されない**
   - 同一ドキュメントIDで内容に変更がない場合は更新されません
   - `--verbose` オプションを使用して詳細ログを確認

### ログの確認

詳細ログを有効にすることで問題の切り分けが容易になります：

```bash
ts-node scripts/rag/upload_documents.ts /path/to/docs --verbose
```

## 開発者向け情報

このツールは以下のモジュールと連携しています：

- `src/modules/rag/indexer.ts`: ドキュメント・チャンクのインデックス機能
- `src/modules/rag/chunker.ts`: チャンキングロジック
- `src/interfaces/rag.ts`: 型定義
- `src/config/supabase.ts`: Supabase接続

追加機能を実装する場合は、これらのモジュールとの整合性を確保してください。
