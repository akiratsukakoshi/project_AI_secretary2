# ワークフロー／RAG／通常回答の切り分けと設定ガイド

このドキュメントでは、AI秘書システムにおけるメッセージ処理の流れと、異なる処理パス（ワークフロー／RAG／通常回答）への振り分け方法について説明します。

## 目次

1. [全体の処理フロー](#全体の処理フロー)
2. [判断に関わるファイル](#判断に関わるファイル)
3. [キーワードトリガーの設定](#キーワードトリガーの設定)
4. [カスタマイズ方法](#カスタマイズ方法)
5. [デバッグとトラブルシューティング](#デバッグとトラブルシューティング)

## 全体の処理フロー

ユーザーからのメッセージは以下の流れで処理されます：

```
ユーザーメッセージ
    ↓
ワークフローマネージャーで処理試行 ------→ 処理成功 → ワークフロー実行
    ↓ (処理できない場合)                       ↓
RAG処理へフォールバック                    ワークフロー応答
    ↓
queryProcessor.detectTriggerType で処理タイプ判定
    ↓
  /   |   \
 ↓    ↓    ↓
RAG  ワークフロー  通常会話
 ↓    ↓          ↓
RAG検索  (現状は通常会話に)  OpenAI応答生成
 ↓                      ↓
RAG応答                 通常応答
```

### 処理優先順位

1. **ワークフローマネージャー**: 最初にワークフローとしての処理を試みる
2. **queryProcessor.detectTriggerType**: ワークフロー処理失敗時に実行され、メッセージタイプを判定
3. **処理分岐**: 判定結果に基づき適切な処理（RAG/ワークフロー/会話）を実行

## 判断に関わるファイル

処理の振り分けに関わる主要ファイルは以下の通りです：

### 1. `src/index.ts` <!-- WORKFLOW_ENTRY_POINT -->
- ワークフローマネージャー初期化
- メッセージ受信イベントハンドリング
- RAGへのフォールバック処理
- 強制RAGモード設定

```typescript
// ワークフローマネージャーで処理を試みる
const workflowResult = await workflowManager.processMessage({
  content: prompt,
  userId: message.author.id,
  channelId: message.channel.id,
  messageId: message.id
});

// ワークフローで処理できた場合
if (workflowResult) {
  // ...
  return;
}

// ワークフローで処理できなかった場合、RAG処理へフォールバック
logger.info('ワークフローでの処理なし、RAG処理へフォールバック');

// 強制RAGモード（デバッグ用）
const enableForceRag = true; // デバッグ用フラグ - 本番環境ではfalseに設定
if (enableForceRag && (prompt.includes('記憶') || prompt.includes('会議') || prompt.includes('議事録') || prompt.includes('強制RAG'))) {
  console.log('⚠️⚠️⚠️ 強制RAGモードが有効化されました（デバッグ用）');
  prompt = "強制RAG " + prompt;
}

// DiscordBot-RAG統合モジュールでメッセージを処理
const { response, usedRag } = await discordRagIntegration.processMessage(message, prompt);
```

### 2. `src/modules/rag/discordRagIntegration.ts` <!-- RAG_INTEGRATION -->
- RAG処理のエントリポイント
- トリガータイプの検出と処理の分岐
- 強制RAGモードの実装

```typescript
// クエリのトリガータイプを検出
const triggerType = queryProcessor.detectTriggerType(content);

// テスト強制RAG分岐
const forceRag = content.includes('強制RAG') || content.includes('記憶');
if (forceRag) {
  // 強制RAGモードの処理
  // ...
} else {
  // トリガータイプに基づいて処理を分岐
  switch (triggerType) {
    case 'rag':
      // RAG処理
      break;
    case 'workflow':
      // ワークフロー処理（現状は通常会話として扱う）
      break;
    case 'conversation':
    default:
      // 通常の会話
      break;
  }
}
```

### 3. `src/modules/rag/query/queryProcessor.ts` <!-- TRIGGER_DETECTION -->
- メッセージタイプの判定ロジック
- キーワードパターンの定義
- メッセージからの情報抽出

```typescript
detectTriggerType(content: string): 'rag' | 'workflow' | 'conversation' {
  // 明示的RAGキーワード - 最も優先度の高いシンプルなチェック（単一キーワード）
  const simpleKeywords = ['記憶', '議事録', '会議', 'ミーティング', '履歴', '検索'];
  for (const keyword of simpleKeywords) {
    if (content.toLowerCase().includes(keyword)) {
      return 'rag';
    }
  }
  
  // 明示的なRAG起動トリガーワード（次に優先）
  const hasExplicitRagTrigger = content.match(/ガクコ.*記憶を確認|ガクコ.*データを確認|記憶を確認|...|/i);
  if (hasExplicitRagTrigger) {
    return 'rag';
  }
  
  // 他の判定ロジック...
}
```

### 4. `src/modules/workflows/workflowManager.ts` <!-- WORKFLOW_MANAGER -->
- ワークフロー処理のエントリポイント
- ワークフローパターンの検出
- ワークフロー実行

## キーワードトリガーの設定

各処理パスのトリガーとなるキーワードは以下のファイルで設定されています：

### 1. RAGトリガーキーワード <!-- RAG_KEYWORDS -->

`src/modules/rag/query/queryProcessor.ts` のdetectTriggerTypeメソッド内：

```typescript
// シンプルなキーワードマッチング
const simpleKeywords = ['記憶', '議事録', '会議', 'ミーティング', '履歴', '検索'];

// 正規表現パターンによるマッチング
const hasExplicitRagTrigger = content.match(/ガクコ.*記憶を確認|ガクコ.*データを確認|ガクコ.*記録確認|記憶を確認して|記憶を確認|データを確認|記録確認|情報を確認|情報を探|検索して|履歴を確認|過去の.*を確認|議事録|会議.*議事録|会議.*記録/i);

// 記憶・会議特化のチェック
const hasMemoryMeetingKeywords = content.match(/記憶|会議|議事録|ミーティング|打ち合わせ/i);

// RAGトリガー検出
const hasRagTrigger = content.match(/ガクコ.*探して|検索して|調べて|ガクコ.*について|検索|教えて.*情報|調査|確認して|教えて|知りたい|共有して/i);
```

### 2. ワークフロートリガーキーワード <!-- WORKFLOW_KEYWORDS -->

`src/modules/rag/query/queryProcessor.ts` のdetectTriggerTypeメソッド内：

```typescript
// ワークフロートリガー検出
const hasWorkflowTrigger = content.match(/ガクコ.*ワークフロー|ワークフロー実行|タスク管理|タスク追加|カレンダー|予定管理|スケジュール設定/i);

// 日付+タスク関連の組み合わせ
const hasDateKeywords = content.match(/(\d+)月(\d+)日|今日|明日|昨日|先日|先週|今週|来週/);
const hasTaskKeywords = content.toLowerCase().includes('タスク') || 
                          content.toLowerCase().includes('todo') || 
                          content.toLowerCase().includes('やること') ||
                          content.toLowerCase().includes('予定');
```

### 3. 強制RAGモードのキーワード <!-- FORCE_RAG_KEYWORDS -->

`src/index.ts` 内：

```typescript
// 強制RAGモード（デバッグ用）
if (enableForceRag && (prompt.includes('記憶') || prompt.includes('会議') || prompt.includes('議事録') || prompt.includes('強制RAG'))) {
  console.log('⚠️⚠️⚠️ 強制RAGモードが有効化されました（デバッグ用）');
  prompt = "強制RAG " + prompt;
}
```

## カスタマイズ方法

### RAGトリガーのカスタマイズ

RAGトリガーを追加・変更するには、`src/modules/rag/query/queryProcessor.ts`の`detectTriggerType`メソッドを編集します：

1. シンプルキーワード配列への追加:
```typescript
const simpleKeywords = ['記憶', '議事録', '会議', 'ミーティング', '履歴', '検索', 'あなたの追加キーワード'];
```

2. 正規表現パターンの追加:
```typescript
const hasExplicitRagTrigger = content.match(/既存パターン|あなたの追加パターン/i);
```

### ワークフロートリガーのカスタマイズ

ワークフロートリガーを追加・変更するには、同じく`queryProcessor.ts`ファイルを編集します：

```typescript
const hasWorkflowTrigger = content.match(/既存パターン|あなたの追加パターン/i);
```

### 強制RAGモードの調整

本番環境では強制RAGモードを無効化するか、より制限されたキーワードセットにすることをお勧めします：

```typescript
// 本番環境
const enableForceRag = false; // 完全に無効化

// もしくは特定のデバッグキーワードのみに制限
if (enableForceRag && prompt.includes('強制RAG')) {
  prompt = "強制RAG " + prompt;
}
```

## デバッグとトラブルシューティング

### ログレベルの設定

デバッグ時はログレベルを`debug`に設定することで詳細なトレースが可能になります：

```
# .env
LOG_LEVEL=debug
```

### 強制RAGモード

強制RAGモードを使用すると、特定のキーワードを含むメッセージを強制的にRAG処理できます：

```typescript
// src/index.ts
const enableForceRag = true;
```

### 一般的な問題

1. **RAGが起動しない**: `queryProcessor.ts`のキーワードパターンを確認
2. **ワークフローが優先されすぎる**: ワークフローマネージャーの判定条件を見直す
3. **ビルド問題**: `package.json`の起動スクリプトと`tsconfig.json`の出力設定を確認

---

このドキュメントは随時更新されます。新しいトリガーや処理パスが追加された場合は、ここに記載してください。 