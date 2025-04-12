/**
 * ワークフローモジュールのインデックスファイル
 * v2.0: 全てのコンポーネントを一箇所からエクスポート
 */

// コアコンポーネントのエクスポート
export * from './core/workflow-types';
export { WorkflowManager } from './core/workflow-manager';
export { default as workflowRegistry } from './core/workflow-registry';
export { default as stateManager } from './core/state-manager';

// サービスコネクターインターフェースのエクスポート
export * from './core/service-connector.interface';

// LLM関連のエクスポート
export { LLMClient, OpenAIClient } from './llm/llm-client';
export { ToolSelector } from './llm/tool-selector';

// プロンプトテンプレートのエクスポート
export { calendarPrompts } from './prompts/calendar-prompts';
export { taskPrompts } from './prompts/task-prompts';

// MCPコネクタのエクスポート
export { MCPConnectorBase } from './connectors/mcp/mcp-connector-base';
export { GoogleCalendarMCPConnector } from './connectors/mcp/google-calendar-mcp';
export { NotionMCPConnector } from './connectors/mcp/notion-mcp';

// 今後、特定のワークフローもここからエクスポートする
// 例: export { calendarWorkflow } from './calendar/calendar-workflow';
// 例: export { taskWorkflow } from './tasks/task-workflow';
