import { WorkflowState } from './workflow-types';
import logger from '../../../utilities/logger';
import supabase from '../../../config/supabase';

/**
 * ワークフローの状態管理クラス
 * マルチターン対話などでワークフローの状態を保持する
 */
class StateManager {
  // インメモリキャッシュ（高速アクセス用）
  private stateCache: Map<string, WorkflowState> = new Map();
  
  // 状態のTTL（分）
  private readonly STATE_TTL_MINUTES = 30;
  
  /**
   * ユーザーIDからキャッシュキーを生成
   * @param userId ユーザーID
   * @returns キャッシュキー
   */
  private getStateKey(userId: string): string {
    return `workflow_state:${userId}`;
  }
  
  /**
   * ユーザーの状態を保存
   * @param userId ユーザーID
   * @param state 保存する状態
   */
  async saveState(userId: string, state: Omit<WorkflowState, 'timestamp'>): Promise<void> {
    const timestamp = new Date();
    const fullState: WorkflowState = {
      ...state,
      timestamp
    };
    
    // キャッシュに保存
    const key = this.getStateKey(userId);
    this.stateCache.set(key, fullState);
    
    try {
      // Supabaseにも保存（永続化）
      const { error } = await supabase
        .from('workflow_states')
        .upsert([
          {
            user_id: userId,
            state: fullState,
            updated_at: timestamp.toISOString()
          }
        ], { onConflict: 'user_id' });
      
      if (error) {
        logger.error('Failed to save workflow state:', error);
      }
    } catch (error) {
      logger.error('Error during state save:', error);
    }
  }
  
  /**
   * ユーザーの状態を取得
   * @param userId ユーザーID
   * @returns 保存された状態、または null
   */
  async getState(userId: string): Promise<WorkflowState | null> {
    const key = this.getStateKey(userId);
    
    // まずキャッシュをチェック
    if (this.stateCache.has(key)) {
      const cachedState = this.stateCache.get(key)!;
      
      // TTLチェック
      if (this.isStateValid(cachedState.timestamp)) {
        return cachedState;
      } else {
        // 期限切れの場合はキャッシュから削除
        this.stateCache.delete(key);
      }
    }
    
    try {
      // キャッシュになければSupabaseから取得
      const { data, error } = await supabase
        .from('workflow_states')
        .select('state, updated_at')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // レコードが存在しない場合
          return null;
        }
        logger.error('Error fetching workflow state:', error);
        return null;
      }
      
      if (!data) return null;
      
      // 状態の有効期限チェック
      const updatedAt = new Date(data.updated_at);
      if (!this.isStateValid(updatedAt)) {
        // 期限切れ - 削除して null を返す
        await this.clearState(userId);
        return null;
      }
      
      const state: WorkflowState = data.state;
      
      // キャッシュに保存
      this.stateCache.set(key, state);
      
      return state;
    } catch (error) {
      logger.error('Error during state retrieval:', error);
      return null;
    }
  }
  
  /**
   * 状態が有効期限内かチェック
   * @param timestamp 状態のタイムスタンプ
   * @returns 有効ならtrue
   */
  private isStateValid(timestamp: Date): boolean {
    const now = new Date();
    const ttlMs = this.STATE_TTL_MINUTES * 60 * 1000;
    return (now.getTime() - timestamp.getTime()) < ttlMs;
  }
  
  /**
   * ユーザーの状態をクリア
   * @param userId ユーザーID
   */
  async clearState(userId: string): Promise<void> {
    const key = this.getStateKey(userId);
    
    // キャッシュから削除
    this.stateCache.delete(key);
    
    try {
      // Supabaseからも削除
      const { error } = await supabase
        .from('workflow_states')
        .delete()
        .eq('user_id', userId);
      
      if (error) {
        logger.error('Failed to clear workflow state:', error);
      }
    } catch (error) {
      logger.error('Error during state clearing:', error);
    }
  }
  
  /**
   * 期限切れの状態を一括削除（定期的に呼び出す）
   */
  async cleanupExpiredStates(): Promise<number> {
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() - this.STATE_TTL_MINUTES);
    
    try {
      // Supabaseから期限切れの状態を削除
      const { data, error } = await supabase
        .from('workflow_states')
        .delete()
        .lt('updated_at', expirationDate.toISOString())
        .select('user_id');
      
      if (error) {
        logger.error('Failed to cleanup expired states:', error);
        return 0;
      }
      
      // キャッシュからも期限切れのものを削除
      for (const [key, state] of this.stateCache.entries()) {
        if (!this.isStateValid(state.timestamp)) {
          this.stateCache.delete(key);
        }
      }
      
      const deletedCount = data?.length || 0;
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired workflow states`);
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Error during expired states cleanup:', error);
      return 0;
    }
  }
}

// シングルトンインスタンスをエクスポート
export default new StateManager();
