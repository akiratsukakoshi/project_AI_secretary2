/**
 * タスク管理のデータモデル
 */

/**
 * Notionタスク情報
 */
export interface NotionTask {
  id: string;
  title: string;
  assignee?: {
    id: string;
    name?: string;
  };
  status?: string;
  priority?: string;
  dueDate?: Date;
  completedDate?: Date;
  category?: {
    id: string;
    name?: string;
  };
  parentCategory?: string;
  recurrence?: string;
  type?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * スタッフ情報
 */
export interface StaffMember {
  id: string;
  displayName: string;
  fullName?: string;
  notionName?: string;
  discordName?: string;
  nicknames?: string[];
  color?: string;
}

/**
 * カテゴリ情報
 */
export interface Category {
  id: string;
  name: string;
  parentCategory?: string;
}

/**
 * タスクステータス
 */
export enum TaskStatus {
  PENDING = '未着手',
  IN_PROGRESS = '進行中',
  COMPLETED = '完了',
  CANCELED = 'キャンセル'
}

/**
 * タスク優先度
 */
export enum TaskPriority {
  HIGH = '高',
  MEDIUM = '中',
  LOW = '低'
}

/**
 * タスク種別
 */
export enum TaskType {
  RECURRING = '定期タスク',
  PROJECT = 'プロジェクトタスク',
  EVENT = 'イベント'
}

/**
 * 繰り返し種別
 */
export enum RecurrenceType {
  NONE = 'なし',
  WEEKLY = '週次',
  MONTHLY = '月次',
  QUARTERLY = '四半期ごと',
  YEARLY = '年次'
}

/**
 * Notionタスクから内部表現への変換
 */
export function mapNotionResponseToTask(notionResponse: any): NotionTask {
  return {
    id: notionResponse.id,
    title: notionResponse.title || 'タイトルなし',
    assignee: notionResponse.assignee ? {
      id: notionResponse.assignee.id,
      name: notionResponse.assignee.name
    } : undefined,
    status: notionResponse.status,
    priority: notionResponse.priority,
    dueDate: notionResponse.dueDate ? new Date(notionResponse.dueDate) : undefined,
    completedDate: notionResponse.completedDate ? new Date(notionResponse.completedDate) : undefined,
    category: notionResponse.category ? {
      id: notionResponse.category.id,
      name: notionResponse.category.name
    } : undefined,
    parentCategory: notionResponse.parentCategory,
    recurrence: notionResponse.recurrence,
    type: notionResponse.type,
    description: notionResponse.description,
    createdAt: new Date(notionResponse.createdAt || Date.now()),
    updatedAt: new Date(notionResponse.updatedAt || Date.now())
  };
}

/**
 * 内部表現からNotionタスクリクエストへの変換
 */
export function mapTaskToNotionRequest(task: Partial<NotionTask>): Record<string, any> {
  const request: Record<string, any> = {};
  
  if (task.title !== undefined) request.title = task.title;
  if (task.status !== undefined) request.status = task.status;
  if (task.priority !== undefined) request.priority = task.priority;
  if (task.description !== undefined) request.description = task.description;
  if (task.type !== undefined) request.type = task.type;
  if (task.recurrence !== undefined) request.recurrence = task.recurrence;
  
  // 日付関連
  if (task.dueDate !== undefined) {
    request.dueDate = task.dueDate instanceof Date
      ? task.dueDate.toISOString().split('T')[0] // YYYY-MM-DD形式
      : task.dueDate;
  }
  
  if (task.completedDate !== undefined) {
    request.completedDate = task.completedDate instanceof Date
      ? task.completedDate.toISOString()
      : task.completedDate;
  }
  
  // リレーション
  if (task.assignee !== undefined) {
    request.assignee = task.assignee?.id;
  }
  
  if (task.category !== undefined) {
    request.category = task.category?.id;
  }
  
  return request;
}
