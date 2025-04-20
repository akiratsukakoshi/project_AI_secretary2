# RAGアップローダー サンプルファイル

このディレクトリには、RAGアップローダーでの処理を検証するためのサンプルファイルが含まれています。これらのファイルは実際のアップロードに使用できるほか、新しいコンテンツ作成時のテンプレートとしても活用できます。

## ディレクトリ構成

```
samples/
├── json/       # JSON形式のサンプル
├── markdown/   # Markdown形式のサンプル（Front Matter付き）
└── text/       # テキスト形式のサンプル
```

## 試験用アップロード方法

以下のコマンドで、サンプルファイルをアップロードできます（実際の環境にインデックス化したくない場合は、別途テスト環境を用意してください）：

```bash
# JSON形式のサンプルをアップロード
ts-node scripts/rag/upload_documents.ts docs/rag-docs/samples/json -t organization_info --verbose

# Markdown形式のサンプルをアップロード
ts-node scripts/rag/upload_documents.ts docs/rag-docs/samples/markdown -t organization_info --verbose

# テキスト形式のサンプルをアップロード
ts-node scripts/rag/upload_documents.ts docs/rag-docs/samples/text -t organization_info --verbose
```

## サンプルファイルの内容

各形式のサンプルは、「原っぱ大学」という架空の環境系大学に関する情報を含んでいます。異なるフォーマットながら同じ内容を持つため、フォーマット間での処理の違いを確認するのに適しています。

### JSON形式の特徴

- メタデータを構造化して格納
- 内容はMarkdown形式のテキストとして格納
- タグや要約を明示的に指定可能

### Markdown形式の特徴

- Front Matterでメタデータを定義
- 人間にも読みやすい形式
- 見出しやリスト、強調などの書式が使用可能

### テキスト形式の特徴

- 最もシンプルな形式
- メタデータは自動抽出
- 見出しや段落は自然言語処理で検出

## カスタムサンプルの作成

新しいサンプルファイルを作成する場合は、以下の点に注意してください：

1. **JSON形式**：title, content, source_type, metadata（summary, tags, document_title）を含める
2. **Markdown形式**：Front Matterに最低限 title, source_type, summary, tags を含める
3. **テキスト形式**：明確な見出しを使い、論理的な段落で構成すると良い結果が得られます 