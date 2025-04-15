# ワークフローモジュール実装ガイド

## 概要

gaku-co（ガクコ）のワークフローモジュールは、ユーザーの自然言語指示をDiscordで受け取り、適切な外部サービスと連携して業務を自動化するシステムです。LLMを活用したツール選択と、モジュラー設計によるワークフロー管理を特徴としています。このドキュメントでは、ワークフローモジュールの設計思想、実装詳細、およびカスタマイズ方法について説明します。

## アーキテクチャ概要

```
                 ユーザー (Discord)
                        ↓
                   Discord Bot
                        ↓
              ワークフローマネージャー
                        ↓
                インテント認識/ルーティング
                        ↓
       ┌───────────────┬───────────────┐
       ↓               ↓               ↓
 カレンダーワークフロー  タスクワークフロー  その他ワークフロー
       ↓               ↓               ↓
    LLMツール選択    LLMツール選択    LLMツール選択
       ↓               ↓               ↓
 Google Calendar MCP   Notion MCP     その他MCP
```

### 主要コンポーネント

1. **ワークフローマネージャー** (`workflow-manager.ts`)
   - ユーザー入力からワークフローを特定
   - 各ワークフローへのルーティング
   - 結果のフォーマットと返送

2. **ワークフロー定義** (`calendar-workflow.ts`, `task-workflow.ts` など)
   - トリガーキーワードの定義
   - LLMとの連携ロジック
   - 外部サービスとの連携

3. **MCPコネクタ** (`google-calendar-mcp.ts`, `notion-mcp.ts` など)
   - サービス接続の抽象化
   - ツール一覧の取得と提供
   - ツール実行と結果処理

4. **プロンプトテンプレート** (`calendar-prompts.ts`, `task-prompts.ts` など)
   - LLMへの指示生成
   - 安全なテンプレート処理
   - 結果フォーマット

## 核心コンポーネント

### 1. ServiceConnector インターフェース

外部サービスとの接続を抽象化するインターフェース。API連携とMCP連携の両方に対応します。

```typescript
// service-connector.interface.ts
export interface ServiceConnector {
  // ツール実行メソッド
  execute(tool: string, params: Record<string, any>): Promise<ServiceResponse>;
  
  // 利用可能なツール一覧を取得
  getAvailableTools(): Promise<Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>>;
  
  // サービスの説明（LLMへの説明用）
  getServiceDescription(): string;
}
```

### 2. WorkflowDefinition インターフェース

各ワークフローの定義と実行ロジックを規定します。

```typescript
// workflow-types.ts
export interface WorkflowDefinition {
  id: string;                // ワークフローの一意識別子
  name: string;              // 表示名
  description: string;       // 説明
  triggers: string[];        // トリガーワード・パターン
  execute: (userQuery: string, context: WorkflowContext) => Promise<WorkflowResult>;
}
```

### 3. MCPConnectorBase クラス

APIモードとMCPモードの両方をサポートするハイブリッド型コネクタの基底クラス。

```typescript
// mcp-connector-base.ts (一部抜粋)
export abstract class MCPConnectorBase implements ServiceConnector {
  constructor(
    protected readonly baseUrl?: string,     // API URL（設定時はAPIモード優先）
    protected readonly apiKey?: string,      // API認証キー
    protected readonly useMCP: boolean = true, // MCPモード有効フラグ
    protected readonly mcpConfigPath?: string, // MCP設定ファイルパス
    protected readonly mcpServiceName?: string // MCP設定内のサービス名
  ) {
    // 初期化ロジック...
  }
  
  // ツール実行（APIモード優先・MCPモードフォールバック）
  async execute(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
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
  
  // ツール一覧取得
  async getAvailableTools(): Promise<Array<{name: string; description: string; parameters: Record<string, any>;}>> {
    // 実装ロジック...
  }
  
  // 各サービス固有の説明
  abstract getServiceDescription(): string;
  
  // API実行（個別実装）
  protected async executeAPI(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    // 実装ロジック...
  }
  
  // MCP実行（個別実装）
  protected async executeMCP(tool: string, params: Record<string, any>): Promise<ServiceResponse> {
    // 実装ロジック...
  }
}
```

## ワークフロー実装例

### タスク管理ワークフロー

Notionを使用したタスク管理機能の実装例です。

```typescript
// task-workflow.ts (一部抜粋)
export const taskWorkflow: WorkflowDefinition = {
  id: 'task',
  name: 'タスク管理',
  description: 'Notionタスク管理ワークフロー',
  triggers: ['タスク', 'タスク管理', 'todo', 'to-do', 'やること'],
  
  execute: async (userQuery, context) => {
    // NotionMCPコネクタ取得
    const notionMCP = context.serviceConnectors.get('notion') as NotionMCPConnector;
    
    if (!notionMCP) {
      return {
        success: false,
        message: 'Notionサービスに接続できません。'
      };
    }
    
    try {
      // 利用可能なツールを取得
      const availableTools = await notionMCP.getAvailableTools();
      
      // ツール選択プロンプトの構築（安全版）
      const prompt = taskPrompts.buildToolSelectionPrompt(userQuery, availableTools);
      
      // LLMによるツール選択と実行プラン生成
      const llmResponse = await context.llmClient.generateStructuredResponse(prompt, {
        responseFormat: { type: "json_object" }
      });
      
      // LLMレスポンスの安全な解析とツール実行
      // ...
      
      // 結果を返却
      return {
        success: true,
        message: taskPrompts.formatResponse(result.data, toolSelection.tool),
        data: result.data
      };
    } catch (error) {
      // エラーハンドリング
      // ...
    }
  }
};
```

## 安全対策

ワークフローモジュールには、LLMとの連携における安全性を確保するための多層防御策が実装されています。

### 1. テンプレート構文対策

JavaScriptのテンプレート構文（`${...}`）による問題を防止する機能：

```typescript
// template-safety.ts
export function escapeTemplateVariables(text: string): string {
  if (!text) return '';
  // ${...} 形式のすべてのテンプレート変数をブロック
  return text.replace(/\$\{(.*?)\}/g, '[template-variable-blocked]');
}

export function deepEscapeTemplateVariables(obj: any): any {
  // オブジェクト内の全ての文字列値に対して再帰的に適用
  // ...
}
```

### 2. 安全なJSONパース

LLMが生成したJSONレスポンスを安全に処理するための機能：

```typescript
// task-workflow.ts内の関数
function safeParseAndValidate(content: string): any {
  // 関数呼び出しパターンなどの危険なコードをチェック
  const dangerousPatterns = [
    /\b\w+\s*\(\s*\)/g,      // 関数呼び出し
    /\$\{.*?\}/g,            // テンプレート構文
    // その他のパターン
  ];
  
  // パターンチェックと検証
  // ...
  
  // 安全にパースして返却
  return JSON.parse(sanitizedContent);
}
```

## プロンプトテンプレート設計

LLMとの効果的な連携のためのプロンプト設計パターン：

```typescript
// task-prompts.ts
export const taskPrompts = {
  buildToolSelectionPrompt: (userQuery: string, availableTools: any[]): string => {
    // ツール説明の整形
    const toolDescriptions = availableTools.map(tool => 
      `- ${tool.name}: ${tool.description}\n  パラメータ: ${JSON.stringify(tool.parameters)}`
    ).join('\n');
    
    // プロンプトテンプレート（テンプレート構文を使わない設計）
    const promptTemplate = `
あなたはNotionのタスク管理を担当するエージェントです。
ユーザーの要求に基づいて、適切なNotionツールを選択し、必要なパラメータを設定してください。

ユーザーの要求: "${userQuery}"

タスク管理用データベースID情報:
- タスクデータベースID: "${DB_IDS.taskDbId}"
- スタッフデータベースID: "${DB_IDS.staffDbId}"
- カテゴリデータベースID: "${DB_IDS.categoryDbId}"

利用可能なツール:
${toolDescriptions}

【セキュリティ上の重要警告】
最も重要: あなたの出力がJSONとして安全であることを確保してください:
- データベースIDはリテラル文字列としてのみ出力
- 変数名を文字列として出力しない
- 関数形式は絶対に出力しない
...

以下の形式でJSON出力のみ生成してください:
{
  "tool": "使用するツール名",
  "parameters": {
    "パラメータ名": "パラメータ値",
    ...
  }
}
`;
    
    // 安全なプロンプト生成
    return createSafePrompt(promptTemplate, DB_IDS);
  },
  
  formatResponse: (data: any, toolType: string): string => {
    // 結果フォーマットロジック
    // ...
  }
};
```

## 新しいワークフローの追加方法

プロジェクトに新しいワークフローを追加する手順：

### 1. ワークフロー定義を作成

新しいワークフロー定義ファイルを `src/modules/workflows/your-workflow/your-workflow.ts` に作成します：

```typescript
import { WorkflowDefinition } from '../core/workflow-types';
import { yourWorkflowPrompts } from '../prompts/your-workflow-prompts';
import { YourServiceMCPConnector } from '../connectors/mcp/your-service-mcp';

export const yourWorkflow: WorkflowDefinition = {
  id: 'your-workflow',
  name: 'あなたのワークフロー',
  description: 'あなたのワークフローの説明',
  triggers: ['トリガーワード1', 'トリガーワード2', '正規表現パターン'],
  
  execute: async (userQuery, context) => {
    // 実装ロジック
    // ...
    
    return {
      success: true,
      message: '処理結果',
      data: resultData
    };
  }
};
```

### 2. プロンプトテンプレートを作成

`src/modules/workflows/prompts/your-workflow-prompts.ts` にプロンプトテンプレートを定義します：

```typescript
import { createSafePrompt } from '../utilities/template-safety';

export const yourWorkflowPrompts = {
  buildToolSelectionPrompt: (userQuery: string, availableTools: any[]): string => {
    // プロンプト構築ロジック
    // ...
    
    return createSafePrompt(promptTemplate, yourIds);
  },
  
  formatResponse: (data: any, toolType: string): string => {
    // レスポンス整形ロジック
    // ...
  }
};
```

### 3. MCPコネクタを実装

`src/modules/workflows/connectors/mcp/your-service-mcp.ts` にMCPコネクタを実装します：

```typescript
import { MCPConnectorBase } from './mcp-connector-base';

export class YourServiceMCPConnector extends MCPConnectorBase {
  constructor() {
    super(
      'http://localhost:3003', // APIサーバーURL
      undefined, // APIキー (必要に応じて)
      true, // MCPモードもバックアップとして有効化
      '/home/tukapontas/ai-secretary2/mcp-config.json',
      'your-service'
    );
  }

  getServiceDescription(): string {
    return 'あなたのサービスの説明';
  }
}
```

### 4. ワークフローをレジストリに登録

`src/modules/workflows/core/workflow-registry.ts` にワークフローを登録します：

```typescript
// 既存のインポートに加えて
import { yourWorkflow } from '../your-workflow/your-workflow';

// 初期化関数内に追加
initialize(): void {
  // 既存のワークフロー登録
  this.registerWorkflow(calendarWorkflow);
  this.registerWorkflow(taskWorkflow);
  
  // 新しいワークフローを登録
  this.registerWorkflow(yourWorkflow);
}
```

## テンプレート構文対策詳細

LLMとの連携時に発生する可能性のある `taskDbId is not a function` などのエラーを防止するための多層防御戦略は以下の通りです：

1. **プロンプト強化**
   - LLMに送信するプロンプトで徹底した禁止指示
   - テンプレート構文を使わないプロンプト構築方式

2. **出力検証**
   - 生成されたテキストの安全性検証
   - 危険なパターンの検出と拒否

3. **サニタイズ**
   - 実際に使用する前の徹底的なサニタイズと変換
   - 変数参照を実際の値（文字列リテラル）に置き換え

これらの対策は `template-safety.ts` や各ワークフローの `safeParseAndValidate` 関数で実装されています。

## ワークフロー開発のベストプラクティス

1. **モジュール分離を徹底**
   - 各ワークフローは独立したモジュールとして実装
   - 共通ロジックを基底クラスやユーティリティに抽出
   - 循環参照を避けたクリーンな依存関係

2. **安全性の確保**
   - テンプレート構文などの危険なパターンを防御
   - ユーザー入力の適切な検証
   - エラーハンドリングの徹底

3. **プロンプト設計の工夫**
   - LLMに明確で具体的な指示を提供
   - 禁止事項と警告を明示的に記載
   - 安全なテンプレート処理の活用

4. **テストと検証**
   - 単体テストによる機能検証
   - エラーケースの網羅的なテスト
   - 実際のユーザーシナリオでの検証

## ディレクトリ構造

完全なワークフローモジュールのディレクトリ構造は以下の通りです：

```
src/modules/workflows/
  ├── calendar/                 # カレンダーワークフロー
  │   ├── calendar-helper.ts    # カレンダー関連ヘルパー関数
  │   └── calendar-workflow.ts  # カレンダーワークフロー定義
  ├── connectors/               # 外部サービス連携
  │   ├── api/                  # 直接API連携用（将来的に）
  │   └── mcp/                  # MCP連携用
  │       ├── google-calendar-mcp.ts    # Google Calendar MCP連携
  │       ├── mcp-connector-base.ts     # 基底コネクタクラス
  │       └── notion-mcp.ts             # Notion MCP連携
  ├── core/                     # コアコンポーネント
  │   ├── parameter-extractor.ts       # パラメータ抽出機能
  │   ├── service-connector.interface.ts # サービスコネクタインターフェース
  │   ├── state-manager.ts             # 状態管理
  │   ├── workflow-manager.ts          # ワークフロー管理
  │   ├── workflow-registry.ts         # ワークフロー登録
  │   └── workflow-types.ts            # 型定義
  ├── index.ts                  # モジュールエントリポイント
  ├── llm/                      # LLM連携
  │   ├── llm-client.ts         # LLMクライアント
  │   └── tool-selector.ts      # ツール選択ロジック
  ├── prompts/                  # プロンプトテンプレート
  │   ├── calendar-prompts.ts   # カレンダー関連プロンプト
  │   └── task-prompts.ts       # タスク関連プロンプト
  ├── tasks/                    # タスク管理ワークフロー
  │   ├── name-resolver.ts      # 名前解決機能
  │   ├── reminder-service.ts   # リマインダーサービス
  │   ├── task-model.ts         # タスクデータモデル
  │   └── task-workflow.ts      # タスクワークフロー定義
  └── utilities/                # ユーティリティ
      └── template-safety.ts    # テンプレート構文安全対策
```

## 環境変数設定

ワークフローモジュールの動作には以下の環境変数が必要です：

```dotenv
# Notion MCP設定
NOTION_TOKEN=your_notion_token
NOTION_VERSION=2022-06-28
NOTION_TASK_DB_ID=your_task_database_id
NOTION_STAFF_DB_ID=your_staff_database_id
NOTION_CATEGORY_DB_ID=your_category_database_id

# Google Calendar MCP設定
GOOGLE_CALENDAR_ID=your_calendar_id

# Discord設定
DISCORD_TOKEN=your_discord_token
REMINDER_CHANNEL_ID=your_reminder_channel_id

# LLM設定
OPENAI_API_KEY=your_openai_api_key
```

## 結論

gaku-co（ガクコ）のワークフローモジュールは、LLMによる自然言語理解と外部サービス連携を組み合わせた柔軟なシステムです。モジュラー設計により、新しいワークフローの追加が容易で、テンプレート構文対策などの安全策により堅牢な実装を実現しています。

今後は、Google Calendarワークフローの完全実装や、他の業務に対応する新しいワークフローの追加、セキュリティとパフォーマンスの最適化などを予定しています。
