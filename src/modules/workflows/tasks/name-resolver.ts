/**
 * 名前解決サービス
 * あだ名やあいまいな表現からスタッフを特定するサービス
 */

import { NotionMCPConnector } from '../connectors/mcp/notion-mcp';
import logger from '../../../utilities/logger';

/**
 * LLMクライアントインターフェース
 */
interface LLMClient {
  generateStructuredResponse(prompt: string, options: any): Promise<any>;
}

/**
 * 名前解決結果インターフェース
 */
export interface NameResolutionResult {
  matched: boolean;
  staffId?: string;
  confidence: number;
  reason?: string;
}

/**
 * スタッフ情報インターフェース
 */
export interface StaffInfo {
  id: string;
  displayName: string;
  fullName?: string;
  nicknames?: string[];
}

/**
 * 名前解決サービス
 */
export class NameResolver {
  private llmClient: LLMClient;
  private notionMcp: NotionMCPConnector;
  private staffCache: StaffInfo[] = [];
  private cacheTimestamp: number = 0;
  private CACHE_TTL = 1000 * 60 * 15; // 15分キャッシュ
  
  /**
   * コンストラクタ
   * @param llmClient LLMクライアント
   * @param notionMcp NotionMCPコネクタ
   */
  constructor(llmClient: LLMClient, notionMcp: NotionMCPConnector) {
    this.llmClient = llmClient;
    this.notionMcp = notionMcp;
  }
  
  /**
   * スタッフ名を解決して一致するスタッフIDを返す
   * @param name 解決する名前
   * @returns 解決結果
   */
  async resolveStaffName(name: string): Promise<NameResolutionResult> {
    try {
      // スタッフリストの取得（キャッシュ利用）
      const staffList = await this.getStaffList();
      
      // 完全一致するケース（高速パス）
      const exactMatch = staffList.find(staff => 
        staff.displayName === name || 
        staff.fullName === name ||
        (staff.nicknames && staff.nicknames.includes(name))
      );
      
      if (exactMatch) {
        logger.info(`名前「${name}」は「${exactMatch.displayName}」に完全一致しました`);
        return {
          matched: true,
          staffId: exactMatch.id,
          confidence: 1.0,
          reason: '完全一致'
        };
      }
      
      // LLMによる曖昧マッチング
      const prompt = this.buildNameResolutionPrompt(name, staffList);
      
      const llmResponse = await this.llmClient.generateStructuredResponse(prompt, {
        responseFormat: { type: "json_object" }
      });
      
      const result = JSON.parse(llmResponse.content);
      if (result.matched) {
        logger.info(`名前「${name}」は「${result.staffId}」に解決されました（確信度: ${result.confidence}）`);
      } else {
        logger.warn(`名前「${name}」は解決できませんでした`);
      }
      
      return result;
    } catch (error) {
      logger.error('名前解決でエラーが発生しました:', error);
      // エラー時は未マッチ扱い
      return {
        matched: false,
        confidence: 0,
        reason: `エラー: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * スタッフリストを取得
   * @returns スタッフリスト
   */
  private async getStaffList(): Promise<StaffInfo[]> {
    const now = Date.now();
    
    // キャッシュが有効ならそれを使用
    if (this.staffCache.length > 0 && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.staffCache;
    }
    
    // スタッフ名マスタDBを取得
    const staffDatabaseId = process.env.NOTION_STAFF_DB_ID || '';
    const result = await this.notionMcp.execute('queryDatabase', {
      database_id: staffDatabaseId
    });
    
    if (!result.success) {
      throw new Error(`スタッフリストの取得に失敗しました: ${result.error}`);
    }
    
    // スタッフデータの整形
    const staffList = (result.data?.results || []).map((staff: any) => {
      // Notionの返却形式からプロパティを抽出
      const properties = staff.properties || {};
      
      // 表示名の取得
      const displayName = properties['表示名']?.rich_text?.[0]?.plain_text || '';
      
      // 正式名の取得
      const fullName = properties['氏名']?.title?.[0]?.plain_text || '';
      
      // あだ名リストの取得
      const nicknames = properties['別名']?.multi_select?.map((item: any) => item.name) || [];
      
      return {
        id: staff.id,
        displayName,
        fullName,
        nicknames
      };
    });
    
    // キャッシュ更新
    this.staffCache = staffList;
    this.cacheTimestamp = now;
    
    logger.info(`スタッフリスト（${staffList.length}名）を取得しました`);
    return staffList;
  }
  
  /**
   * 名前解決用プロンプト構築
   */
  private buildNameResolutionPrompt(name: string, staffList: StaffInfo[]): string {
    const staffDescriptions = staffList.map(staff => {
      const nicknames = staff.nicknames && staff.nicknames.length > 0 
        ? staff.nicknames.join(', ') 
        : '無し';
      return `- ID: ${staff.id}, 表示名: ${staff.displayName}, 本名: ${staff.fullName || '未設定'}, あだ名: ${nicknames}`;
    }).join('\n');
    
    return `
      以下のスタッフリストから、入力された名前「${name}」に最も一致する人物のIDを特定してください。
      完全一致だけでなく、略称やあだ名など部分的な一致や類似した呼び方も考慮してください。
      
      スタッフリスト:
      ${staffDescriptions}
      
      JSONで回答してください。出力フォーマット:
      { "matched": true/false, "staffId": "一致したスタッフのID", "confidence": 0.0-1.0の数値, "reason": "選択理由の簡単な説明" }
      
      一致するスタッフが見つからない場合は matched: false を返してください。
    `;
  }
}
