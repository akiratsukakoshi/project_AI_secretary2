# MCP 常駐型APIサーバー アーキテクチャ

## 概要

gaku-co（ガクコ）プロジェクトでは、Notion、Google Calendarなどの外部サービスとの連携に、LLMによるツール選択と常駐型APIサーバーを組み合わせた効率的なアーキテクチャを採用しています。このドキュメントでは、従来の一時的なMCPプロセス起動からAPIサーバー方式への移行の詳細と、その利点について説明します。

## アーキテクチャ変更の背景

従来の実装では、外部サービスとの連携のたびに、`npx`または`node`コマンドを使用してMCPサーバーを起動していました。この方式では以下の問題が発生していました：

1. **タイムアウト問題**: `execFile`による実行がタイムアウトする
2. **起動オーバーヘッド**: 毎回のサーバー初期化による遅延
3. **並列処理の制限**: 同時処理が困難

これらの問題を解決するために、常駐型のExpressサーバーとして実装し、HTTPベースのAPIインターフェースを提供する方式に移行しました。

## 新アーキテクチャの構成

```
ユーザー (Discord) → Discord Bot → ワークフローマネージャー → LLMツール選択
                                                       ↓
                    ┌─────────────────────────────────┴────────────────────────────────────┐
                    ↓                                                                      ↓
           [常駐型 Notion MCPサーバー]                                        [常駐型 Google Calendar MCPサーバー]
                    ↓                                                                      ↓
                Notion API                                                       Google Calendar API
```

### 主要コンポーネント

1. **常駐型MCP APIサーバー**
   - ExpressベースのHTTPサーバーとして実装
   - 各外部サービス用に個別のサーバープロセス
   - PM2によるプロセス管理と自動再起動

2. **MCPコネクタ**
   - APIモードとMCPモードの両方をサポートするハイブリッド設計
   - APIモードを優先し、必要に応じてMCPモードにフォールバック
   - 標準化されたインターフェースによるサービス抽象化

3. **LLMツール選択機能**
   - 利用可能なツール一覧のLLMへの提供
   - 自然言語からの適切なツールとパラメータの抽出
   - テンプレート構文対策などの安全策実装

## 実装詳細

### ディレクトリ構造

```
mcp-servers/
  ├── notion-mcp/                  # Notion MCPサーバー
  │   ├── src/
  │   │   ├── index.ts             # APIサーバーメイン
  │   │   ├── handlers/            # APIエンドポイントハンドラー
  │   │   ├── services/            # Notion API連携
  │   │   └── schemas/             # 型定義とバリデーション
  │   ├── package.json
  │   └── tsconfig.json
  └── google-calendar-mcp/         # Google Calendar MCPサーバー (予定)
      ├── src/
      │   ├── index.ts
      │   ├── handlers/
      │   ├── services/
      │   └── schemas/
      ├── package.json
      └── tsconfig.json
```

### APIエンドポイント

各MCPサーバーは以下の共通のエンドポイントを提供します：

1. **GET /api/tools**
   - 利用可能なツール一覧を返す
   - 各ツールの名前、説明、必要なパラメータを含む

2. **POST /api/tools/:tool**
   - 指定されたツールを実行する
   - パラメータはリクエストボディで提供
   - 結果をJSON形式で返す

3. **GET /health**
   - サーバーの健全性と設定状態を確認
   - 稼働時間や環境変数の設定状況を含む

### PM2による常駐プロセス管理

サーバーの常駐化とプロセス管理にはPM2を使用しています。

#### ecosystem.config.js
```javascript
module.exports = {
  apps : [{
    name: "notion-mcp",
    script: "/home/tukapontas/ai-secretary2/mcp-servers/notion-mcp/build/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "200M",
    env: {
      NODE_ENV: "production",
      NOTION_TOKEN: process.env.NOTION_TOKEN || "your_token_here",
      NOTION_VERSION: process.env.NOTION_VERSION || "2022-06-28",
      PORT: 3001
    },
    error_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-error.log",
    out_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
};
```

#### 起動スクリプト
```bash
#!/bin/bash
# サーバー起動スクリプト

# 既存のサーバーを停止
pm2 delete notion-mcp google-calendar-mcp 2>/dev/null || true

# サーバーを起動
cd /home/tukapontas/ai-secretary2/
pm2 start ecosystem.config.js

# ステータス表示
pm2 status

# PM2の保存（再起動時に自動起動するため）
pm2 save
```

## 安全策と改良点

### 1. テンプレート構文対策

LLMが生成するプロンプト内のJavaScriptテンプレート構文（`${...}`）による問題を解決するため、多層防御策を実装しています：

```typescript
function escapeTemplateVariables(text: string): string {
  if (!text) return '';
  // ${...} 形式のすべてのテンプレート変数をブロック
  return text.replace(/\$\{(.*?)\}/g, '[template-variable-blocked]');
}
```

### 2. パラメータのサニタイズ

LLMが生成したJSONレスポンスの安全性を確保するための処理を実装：

```typescript
function safeParseAndValidate(content: string): any {
  // 関数呼び出しパターンをチェック（パース前の段階で）
  const dangerousPatterns = [
    /\b\w+\s*\(\s*\)/g,                // 関数呼び出し
    /\$\{.*?\}/g,                      // テンプレート構文
    /\btaskDbId\b/g,                   // 変数名そのまま
    /\bprocess\.env\.\w+\b/g,          // 環境変数参照
    /\bNOTION_\w+\b/g                  // 環境変数名
  ];
  
  // パターンチェック...
}
```

### 3. API優先モード

コネクタ内でAPIモードを優先的に使用し、APIが利用できない場合のみ従来のMCPモードにフォールバックする機能：

```typescript
async execute(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
  // APIモードを優先し、使用不可の場合はMCPモードにフォールバック
  if (this.baseUrl) {
    try {
      return await this.executeAPI(tool, params);
    } catch (error) {
      logger.warn(`API接続に失敗しました。MCPモードにフォールバックします: ${error.message}`);
      if (this.useMCP) {
        return this.executeMCP(tool, params);
      }
      throw error;
    }
  } else if (this.useMCP) {
    return this.executeMCP(tool, params);
  } else {
    throw new Error('実行可能な接続方法がありません');
  }
}
```

## 利点と成果

常駐型APIサーバー方式への移行によって、以下の効果が得られました：

1. **パフォーマンス向上**
   - 起動オーバーヘッドの排除による応答時間の短縮
   - 処理のタイムアウト問題の解消

2. **安定性の向上**
   - PM2による自動再起動機能によるエラー復旧
   - 長時間の操作や大量のデータ処理に対応

3. **拡張性の確保**
   - スケーラビリティの向上（必要に応じてインスタンス数の増加が可能）
   - 他のMCPサーバーへの容易な拡張

4. **運用性の改善**
   - ログファイルの分離によるトラブルシューティング容易化
   - サーバー状態のモニタリング機能の追加

## 今後の展望

1. **Google Calendar MCPサーバーの完全実装**
   - 現在のフレームワークを使用して実装予定
   - カレンダーワークフローとの統合

2. **エラーハンドリングの強化**
   - より詳細なエラーレポート
   - 自動再試行メカニズムの実装

3. **パフォーマンス最適化**
   - キャッシュ層の導入
   - リクエスト量に応じたスケーリング

4. **セキュリティ強化**
   - API認証の追加
   - レート制限の実装

5. **モニタリングの拡充**
   - パフォーマンスメトリクスの収集
   - 問題検出の自動化
