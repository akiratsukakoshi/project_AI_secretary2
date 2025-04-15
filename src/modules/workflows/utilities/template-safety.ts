// src/modules/workflows/utilities/template-safety.ts

import logger from "../../../utilities/logger";

/**
 * テンプレート変数構文（${...}）をブロックして安全な文字列に変換する
 * @param text 処理対象の文字列
 * @returns テンプレート変数構文がブロックされた安全な文字列
 */
export function escapeTemplateVariables(text: string): string {
  if (!text) return "";
  
  // ${...} 形式のすべてのテンプレート変数をブロック
  return text.replace(/\${(.*?)}/g, "[template-variable-blocked]");
}

/**
 * JSONオブジェクト内の全ての文字列値に対してテンプレート変数をエスケープする
 * @param obj JSONオブジェクト
 * @returns テンプレート変数がエスケープされたオブジェクト
 */
export function deepEscapeTemplateVariables(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // 文字列の場合は直接エスケープ
  if (typeof obj === "string") {
    return escapeTemplateVariables(obj);
  }
  
  // 配列の場合は各要素に再帰的に適用
  if (Array.isArray(obj)) {
    return obj.map(item => deepEscapeTemplateVariables(item));
  }
  
  // オブジェクトの場合は各プロパティに再帰的に適用
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepEscapeTemplateVariables(value);
    }
    return result;
  }
  
  // その他の型はそのまま返す
  return obj;
}

/**
 * 実際のデータベースIDを安全に置換した文字列を生成する
 * データベースIDを直接埋め込み、テンプレート構文を使用しない
 * @param text 置換対象の文字列
 * @param idMapping ID名と実際の値のマッピング
 * @returns 安全に置換された文字列
 */
export function replaceDbIdsWithValues(text: string, idMapping: Record<string, string>): string {
  if (!text) return "";
  
  let result = text;
  // 各IDを実際の値に置換
  for (const [idName, idValue] of Object.entries(idMapping)) {
    // 変数名のパターンを識別して実際の値に置換
    const upperIdName = idName.toUpperCase();
    
    // 単純な文字列置換で安全に実装
    const patterns = [
      "${" + idName + "}",
      "${" + idName + "Value}",
      "${" + upperIdName + "}",
      "${process.env." + upperIdName + "}"
    ];
    
    for (const pattern of patterns) {
      result = result.split(pattern).join(idValue);
    }
  }
  
  // 残ったテンプレート変数構文をブロック
  return escapeTemplateVariables(result);
}

/**
 * プロンプトを安全に生成する - テンプレート変数を直接値に置換し、残りをエスケープ
 * @param templateText プロンプトのテンプレート
 * @param dbIds データベースIDマッピング
 * @returns 安全なプロンプト文字列
 */
export function createSafePrompt(templateText: string, dbIds: Record<string, string>): string {
  // 最初に既知のデータベースIDを実際の値に置換
  const replacedText = replaceDbIdsWithValues(templateText, dbIds);
  
  // 残ったテンプレート変数構文を全てブロック
  return escapeTemplateVariables(replacedText);
}