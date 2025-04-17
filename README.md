# AI Secretary 2 - gaku-co (ガクコ)

Discordをインターフェースとした次世代AI秘書「gaku-co（ガクコ）」プロジェクトです。生成AIを頭脳として、RAG（検索拡張生成）とモジュール化されたワークフローを活用し、自然言語でのコミュニケーションを通じて様々な業務をサポートします。

## 主要機能

- **ユーザーフレンドリーなインターフェース**
  - Discordを通じた自然言語コミュニケーション
  - 直感的な対話型インターフェースでの操作
  - 明示的トリガーとインテント認識のハイブリッドアプローチ

- **RAGシステム (検索拡張生成)**
  - イベント情報、顧客情報の高精度検索
  - サービス概要やFAQの効率的な参照
  - 会議履歴や業務文書の検索と活用
  - メタデータフィルタリングによる精度向上

- **モジュール化されたワークフロー**
  - スケジュール管理（Google Calendar連携）
  - タスク管理（Notion連携）
  - 外部APIとの柔軟な統合（STORES予約管理など）
  - LLMによるツール選択とパラメータ抽出

- **高度なコンテキスト管理**
  - 会話履歴の適切な保持とメモリ管理
  - スライディングウィンドウ + サマリー方式の採用
  - マルチターン対話のサポート

## システムアーキテクチャ

```
ユーザー (Discord) → Discord Bot → ワークフローマネージャー → LLMツール選択 → 応答 → ユーザー (Discord)
                                    ↓
                      ┌─────────────┴───────────────┐
                      ↓                             ↓
                  RAG検索                      外部サービス連携
                (Supabase pgvector)         (常駐型MCPサーバー)
```

### コアコンポーネント

1. **Discord Bot**
   - ユーザーからの入力を受け取り、応答を返す
   - `discord.js` を使用した実装

2. **ワークフローモジュール**
   - ユーザーのインテントを認識し適切なワークフローを実行
   - LLMによるツール選択とパラメータ抽出
   - サービスコネクタを通じた外部サービスとの統合

3. **RAGシステム**
   - OpenAI埋め込みによるベクトル検索
   - ハイブリッドリトリーバル（ベクトル検索+キーワード検索）
   - Supabase pgvectorによるスケーラブルな検索基盤

4. **常駐型MCPサーバー**
   - ExpressベースのHTTP APIサーバー
   - PM2によるプロセス管理・監視
   - API/MCPのハイブリッドコネクタ設計

## 最新の実装: 常駐型MCPサーバーアーキテクチャ

従来の一時的なプロセス起動からAPIサーバー方式への移行により、パフォーマンスと安定性が大幅に向上しました。

### 主な利点

- **起動オーバーヘッドの排除**: サーバーの常駐化により応答性が向上
- **タイムアウト問題の解消**: 長時間実行されるOperationsでも安定動作
- **並列処理能力の向上**: 複数リクエストの同時処理が可能に
- **監視・管理の容易化**: PM2による包括的なプロセス管理

### 実装詳細

- **`notion-mcp` サーバー**: Notion APIとの連携用APIサーバー（ポート3001）
- **ハイブリッドコネクタ**: API優先＋MCPフォールバックの柔軟な設計
- **PM2による管理**: 自動再起動、ログ管理、モニタリング機能
- **テンプレート構文対策**: LLM連携における安全性強化

詳細は [MCP常駐型APIサーバーアーキテクチャ](docs/mcp-architecture.md) を参照してください。

## セットアップ方法

1. **リポジトリをクローン**
```bash
git clone https://github.com/akiratsukakoshi/project_AI_secretary2.git
cd project_AI_secretary2
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
`.env.example` ファイルをコピーして `.env` ファイルを作成し、以下の設定を行います：
```
# Discord Bot設定
DISCORD_TOKEN=your_discord_token

# OpenAI/LLM設定
OPENAI_API_KEY=your_openai_key

# Supabase設定
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Notion MCP設定
NOTION_TOKEN=your_notion_token
NOTION_VERSION=2022-06-28
NOTION_TASK_DB_ID=your_task_database_id
NOTION_STAFF_DB_ID=your_staff_database_id
NOTION_CATEGORY_DB_ID=your_category_database_id

# その他連携設定
GOOGLE_CALENDAR_ID=your_calendar_id
```

4. **ビルドと実行**
```bash
# TypeScriptのビルド
npm run build

# MCPサーバーの起動
./scripts/start-mcp-servers.sh

# アプリケーションの実行
npm start

# または開発モードでの実行（コード変更監視あり）
npm run dev
```

## 実装状況

- ✅ **フェーズ1: 基盤レイヤーの構築**
  - Discord Bot基本機能
  - TypeScript環境整備
  - ワークフローモジュール基本設計
  - LLM連携の基本実装

- ✅ **フェーズ2: MCPサーバー連携** (完了)
  - LLMによるツール選択
  - 常駐型MCPサーバーアーキテクチャに移行
  - Notion MCPサーバーの実装
  - テンプレート構文対策の実装

- ✅ **フェーズ3: タスク管理ワークフロー** (完了)
  - Notionタスク管理の実装
  - LLMを活用したパラメータ抽出
  - セキュアなワークフロー実行

- 🔄 **フェーズ4: Google Calendarワークフロー** (進行中)
  - 基本的なカレンダーワークフローの設計
  - Google Calendar MCPサーバーの準備中

- 📋 **フェーズ5-6: 今後の予定**
  - RAGシステムの完全実装
  - リマインダー機能の実装
  - UI/UX最適化
  - 拡張機能の追加

## 開発ガイド

プロジェクトの詳細な技術情報と実装計画については以下のドキュメントを参照してください：

- [gaku-co要件定義書](docs/gakuco-requirements.md) - プロジェクトの要件と概要
- [RAG実装ガイド](docs/RAG実装のための技術メモ.md) - RAGシステムの技術詳細
- [ワークフロー実装ガイド](docs/workflow-module-implementation.md) - ワークフローモジュールの設計と実装
- [MCP常駐型APIサーバーアーキテクチャ](docs/mcp-architecture.md) - 常駐型MCPサーバーの詳細設計
- [PM2セットアップガイド](docs/pm2-setup-guide.md) - PM2によるプロセス管理の設定
- [RAGアップローダー利用ガイド](docs/pm2-setup-guide.md) - supabaseRAGへのドキュメントアップツール

## コントリビューション

プロジェクトへの貢献は大歓迎です。以下の手順で参加いただけます：

1. このリポジトリをフォーク
2. 機能開発用のブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを開く

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。
