/**
 * サービスコネクターインターフェイス
 * 外部サービス（Google Calendar、Notion等）との連携を抽象化する
 */

/**
 * サービスレスポンスの型定義
 */
export interface ServiceResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * サービスコネクターインターフェイス
 * v2.0: LLMによるツール選択のサポートを追加
 */
export interface ServiceConnector {
  /**
   * ツール実行メソッド
   * @param tool ツール名
   * @param params パラメータ
   */
  execute(tool: string, params: Record<string, any>): Promise<ServiceResponse>;
  
  /**
   * 利用可能なツール一覧を取得
   */
  getAvailableTools(): Promise<Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>>;
  
  /**
   * サービスの説明（LLMへの説明用）
   */
  getServiceDescription(): string;
}

/**
 * MCPベースのサービスコネクターインターフェイス
 */
export interface McpServiceConnector extends ServiceConnector {
  /**
   * MCPサーバーのURL
   */
  readonly mcpServerUrl: string;

  /**
   * MCPサーバーに接続
   */
  connect(): Promise<void>;
}

/**
 * API ベースのサービスコネクターインターフェイス
 */
export interface ApiServiceConnector extends ServiceConnector {
  /**
   * API のベースURL
   */
  readonly apiBaseUrl: string;

  /**
   * API認証情報をセット
   * @param credentials 認証情報
   */
  setCredentials(credentials: Record<string, any>): void;
}
