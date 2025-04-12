# AI Secretary 2 - gaku-co (ガクコ)

Discord をインターフェースとした次世代AI秘書「gaku-co（ガクコ）」プロジェクトです。生成AIを頭脳として、RAG（検索拡張生成）とモジュール化されたワークフローを活用し、自然言語でのコミュニケーションを通じて様々な業務をサポートします。

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
ユーザー (Discord) → Discord Bot → ワークフローマネージャー → 応答 → ユーザー (Discord)
                                    ↓
                      ┌─────────────┴───────────────┐
                      ↓                             ↓
                  RAG検索                      外部サービス連携
                (Supabase pgvector)         (LLM + MCPコネクタ)
```

### コアコンポーネント

1. **Discord Bot**
   - ユーザーからの入力を受け取り、応答を返す
   - `discord.js` を使用した実装

2. **ワークフローモジュール**
   - ユーザーのインテントを認識し適切なワークフローを実行
   - LLMによるツール選択とパラメータ抽出
   - MCPコネクタを通じた外部サービスとの統合

3. **RAGシステム**
   - OpenAI埋め込みによるベクトル検索
   - ハイブリッドリトリーバル（ベクトル検索+キーワード検索）
   - Supabase pgvectorによるスケーラブルな検索基盤

4. **メモリ管理**
   - 複数ターンにわたる会話コンテキストの維持
   - インメモリキャッシュとDB永続化のハイブリッド方式

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

# その他連携設定
GOOGLE_CALENDAR_MCP_URL=your_calendar_mcp_url (オプション)
NOTION_MCP_URL=your_notion_mcp_url (オプション)
```

4. **ビルドと実行**
```bash
# TypeScriptのビルド
npm run build

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

- 🔄 **フェーズ2: LLM-MCP連携の実装**（進行中）
  - LLMによるツール選択
  - MCPサーバーとの連携
  - プロンプトテンプレート管理

- 📋 **フェーズ3-6: 今後の予定**
  - Google Calendar/Notion連携
  - RAGシステムの完全実装
  - リマインダー機能の実装
  - UI/UX最適化
  - 拡張機能の追加

## 開発ガイド

プロジェクトの詳細な技術情報と実装計画については以下のドキュメントを参照してください：

- [gaku-co要件定義書](docs/gakuco-requirements.md)
- [RAG構築要件](docs/RAG構築にあたって確認すべき項目.md)
- [ワークフロー設計](docs/ワークフローモジュール開発要件と実装計画v2.0.md)

## コントリビューション

プロジェクトへの貢献は大歓迎です。以下の手順で参加いただけます：

1. このリポジトリをフォーク
2. 機能開発用のブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを開く

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。