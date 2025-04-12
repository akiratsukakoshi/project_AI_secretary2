/**
 * ワークフローモジュールの型定義
 * v2.0: LLMによるツール選択のサポートを追加
 */

/**
 * パラメータスキーマの定義
 * (後方互換性のために残す)
 */
export interface ParamSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required: boolean;
    description: string;
    validator?: (value: any) => boolean;
    default?: any;
  };
}

/**
 * ワークフロー実行結果
 */
export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: any;
  requireFollowUp?: boolean; // マルチターン対話のフラグ
}

/**
 * ワークフロー実行コンテキスト
 * v2.0: serviceConnectors を追加
 */
export interface WorkflowContext {
  userId: string;
  channelId: string;
  messageId: string;
  conversationMemory?: any;
  sendResponse?: (message: string) => Promise<void>;
  progressUpdate: (message: string) => Promise<void>;
  serviceConnectors?: Map<string, any>; // ServiceConnector型のマップ
  llmClient: any;  // LLM呼び出し用クライアント
  stateManager: any; // 状態管理
  ragClient?: any;  // RAG検索用クライアント (オプション)
}

/**
 * v2.0: ワークフロー実行関数の型を変更
 * パラメータの代わりに生のユーザークエリを受け取る
 */
export type WorkflowExecutor = (
  userQuery: string,
  context: WorkflowContext
) => Promise<WorkflowResult>;

/**
 * エラーハンドラ関数の型
 * v2.0: パラメータの代わりに生のユーザークエリを受け取る
 */
export type ErrorHandler = (
  error: Error,
  userQuery: string,
  context: WorkflowContext
) => Promise<WorkflowResult>;

/**
 * ワークフロー定義
 * v2.0: parameterSchema を削除し、execute の型を変更
 */
export interface WorkflowDefinition {
  id: string;                     // ワークフローの一意識別子
  name: string;                   // 表示名
  description: string;            // 説明
  triggers: string[];             // トリガーワード・パターン
  requiredIntegrations?: string[]; // 必要な外部連携
  execute: WorkflowExecutor;      // 実行関数 - v2.0: userQueryを受け取る
  onError?: ErrorHandler;         // エラーハンドラ
}

/**
 * ワークフローの状態データ
 */
export interface WorkflowState {
  workflow: string;        // ワークフローID
  action: string;          // 現在のアクション
  step: string;            // 現在のステップ
  data: Record<string, any>; // 保存データ
  timestamp: Date;         // 更新日時
}

/**
 * 日時表現の種類
 */
export enum DateTimeExpressionType {
  ABSOLUTE = 'absolute',   // 絶対日時 (2023年4月1日10時など)
  RELATIVE = 'relative',   // 相対日時 (明日、3日後など)
  RECURRENCE = 'recurrence', // 繰り返し (毎週月曜日など)
  DURATION = 'duration',   // 期間 (30分間、2時間など)
}

/**
 * 日時表現の解析結果
 */
export interface DateTimeExpression {
  type: DateTimeExpressionType;
  value: Date | number | string;
  original: string;  // 元の表現
  confidence: number; // 解析の確信度 (0.0-1.0)
}
