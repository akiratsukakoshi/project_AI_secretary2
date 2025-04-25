# 設定外部化実装計画

## 概要
このドキュメントは、AI秘書プロジェクトにおける設定の外部化を実装するための詳細計画です。YAMLベースの設定システムを導入し、システムプロンプト、ボットの性格、ワークフローのトリガーワード、RAG設定などをコードから分離します。

## 実装フェーズ

### 第1フェーズ：システムプロンプトとボットの性格の外部化（最優先）

#### 1. 基本設定ディレクトリの作成

```
/home/tukapontas/ai-secretary2/config/
├── bots/
│   ├── gakuco.yml    # デフォルトの「ガクコ」性格プロファイル
```

#### 2. 設定読み込み用のYAMLパーサーの実装

```typescript
// src/utilities/config-loader.ts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'; // 新しい依存関係を追加
import logger from './logger';

class ConfigLoader {
  private configCache: Map<string, any> = new Map();
  private rootConfigPath: string;

  constructor(rootConfigPath: string = path.join(process.cwd(), 'config')) {
    this.rootConfigPath = rootConfigPath;
    // 設定ディレクトリの存在確認と作成
    if (!fs.existsSync(rootConfigPath)) {
      try {
        fs.mkdirSync(rootConfigPath, { recursive: true });
        fs.mkdirSync(path.join(rootConfigPath, 'bots'), { recursive: true });
        logger.info(`設定ディレクトリを作成しました: ${rootConfigPath}`);
      } catch (error) {
        logger.error(`設定ディレクトリの作成に失敗しました: ${error}`);
      }
    }
  }

  /**
   * YAMLファイルからの設定読み込み
   */
  loadConfig<T>(configPath: string): T {
    try {
      // キャッシュされているかチェック
      if (this.configCache.has(configPath)) {
        return this.configCache.get(configPath) as T;
      }

      // 絶対パスでない場合、ルート設定ディレクトリからの相対パスとする
      const fullPath = path.isAbsolute(configPath) 
        ? configPath 
        : path.join(this.rootConfigPath, configPath);

      // ファイルが存在するか確認
      if (!fs.existsSync(fullPath)) {
        throw new Error(`設定ファイルが見つかりません: ${fullPath}`);
      }

      // YAMLファイルを読み込み、解析
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      const config = yaml.load(fileContent) as T;

      // キャッシュに保存
      this.configCache.set(configPath, config);
      
      logger.info(`設定ファイルを読み込みました: ${configPath}`);
      return config;
    } catch (error) {
      logger.error(`設定ファイル読み込みエラー (${configPath}): ${error}`);
      throw error;
    }
  }

  /**
   * デフォルトのボット設定を取得
   */
  getBotConfig(botName: string = 'gakuco'): any {
    return this.loadConfig(`bots/${botName}.yml`);
  }

  /**
   * キャッシュされた設定をクリア
   */
  clearCache(): void {
    this.configCache.clear();
  }
}

// シングルトンインスタンスをエクスポート
export default new ConfigLoader();
```

#### 3. デフォルトのボット設定ファイルの作成

```yaml
# config/bots/gakuco.yml
name: "gaku-co"
display_name: "ガクコ"
version: "1.0"
description: "Discord上で動作するAI秘書"

# システムプロンプト（性格、振る舞い）
system_prompt: |
  あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。
  ユーザーからの質問に丁寧に答え、スケジュール管理やタスク管理をサポートします。
  自然な会話を心がけ、親しみやすく、プロフェッショナルな印象を与えてください。

# 応答スタイル
response_style:
  formality: "polite"  # 丁寧 (formal, polite, casual, friendly)
  verbosity: "concise" # 簡潔 (verbose, concise, brief)
  emoji: true          # 絵文字を使用する

# プロンプト生成時に反映させる特性
traits:
  - "親切で丁寧"
  - "効率的でわかりやすい説明"
  - "必要な情報を的確に提供"
  - "ユーモアを交えつつプロフェッショナル"

# トリガーワード（基本呼びかけ用）
trigger_words:
  - "ガクコ"
  - "がくこ"
  - "gakuco"

# 反応パターン（特定キーワードに対する反応）
reactions:
  greeting:
    - "おはよう"
    - "こんにちは"
    - "こんばんは"
  farewell:
    - "さようなら"
    - "バイバイ"
    - "また明日"
```

#### 4. OpenAIサービスの修正

```typescript
// src/services/openai-service.ts の修正
import OpenAI from 'openai';
import { ChatMessage } from '../interfaces/openai';
import { ConversationMessage } from '../interfaces/memory';
import { env } from '../config/env';
import logger from '../utilities/logger';
import configLoader from '../utilities/config-loader'; // 追加

class OpenAIService {
  private openai: OpenAI;
  private botConfig: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    
    // ボット設定の読み込み
    try {
      this.botConfig = configLoader.getBotConfig();
      logger.info('ボット設定を読み込みました');
    } catch (error) {
      logger.error('ボット設定の読み込みに失敗しました。デフォルト設定を使用します。', error);
      this.botConfig = {
        system_prompt: "あなたはDiscord上で動作するAI秘書「gaku-co（ガクコ）」です。ユーザーからの質問に丁寧に答え、スケジュール管理やタスク管理をサポートします。"
      };
    }
  }

  /**
   * OpenAI APIを使用してテキスト生成を行う
   * @param {string} prompt - ユーザーからの入力メッセージ
   * @param {Array<ConversationMessage>} history - 会話履歴
   * @returns {Promise<string>} AIからの応答
   */
  async generateResponse(prompt: string, history: ConversationMessage[] = []): Promise<string> {
    try {
      logger.debug(`OpenAI APIリクエスト開始: ${prompt.substring(0, 50)}...`);
      
      // 外部化されたシステムプロンプトを使用
      const systemPrompt = this.botConfig.system_prompt;
      
      // 会話履歴の最新のメッセージを抽出（最大5件）
      const recentMessages = history
        .slice(-5)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // APIリクエスト用のメッセージ配列を構築
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...recentMessages,
        { role: "user", content: prompt }
      ];
      
      // ... 以下は変更なし
    }
    // ... 他のメソッドは変更なし
  }
}
```

#### 5. `package.json`の更新（依存関係追加）

```json
{
  "dependencies": {
    // 既存の依存関係...
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    // 既存の依存関係...
    "@types/js-yaml": "^4.0.9"
  }
}
```

#### 6. ボット設定の切り替え機能

```typescript
// src/services/bot-config-service.ts
import configLoader from '../utilities/config-loader';
import logger from '../utilities/logger';
import * as fs from 'fs';
import * as path from 'path';

class BotConfigService {
  private currentBotName: string = 'gakuco';
  
  /**
   * 現在のボット設定を取得
   */
  getCurrentBotConfig(): any {
    return configLoader.getBotConfig(this.currentBotName);
  }
  
  /**
   * ボットプロファイルを切り替え
   * @param botName 使用するボット名
   */
  switchBotProfile(botName: string): boolean {
    try {
      // 指定されたボット設定ファイルが存在するか確認
      const configPath = path.join(process.cwd(), 'config', 'bots', `${botName}.yml`);
      if (!fs.existsSync(configPath)) {
        logger.error(`ボット設定ファイルが見つかりません: ${configPath}`);
        return false;
      }
      
      // ボット名を切り替え
      this.currentBotName = botName;
      
      // キャッシュをクリアして新しい設定を読み込むように強制
      configLoader.clearCache();
      
      logger.info(`ボットプロファイルを切り替えました: ${botName}`);
      return true;
    } catch (error) {
      logger.error(`ボットプロファイル切り替えエラー: ${error}`);
      return false;
    }
  }
  
  /**
   * 利用可能なボットプロファイルのリストを取得
   */
  getAvailableProfiles(): string[] {
    try {
      const botsDir = path.join(process.cwd(), 'config', 'bots');
      if (!fs.existsSync(botsDir)) {
        return [];
      }
      
      // .ymlファイルを検索して拡張子を除いた名前を返す
      return fs.readdirSync(botsDir)
        .filter(file => file.endsWith('.yml'))
        .map(file => file.replace('.yml', ''));
    } catch (error) {
      logger.error(`利用可能なプロファイル取得エラー: ${error}`);
      return [];
    }
  }
}

export default new BotConfigService();
```

### 第2フェーズ：ワークフローのトリガーワードの外部化

#### 1. ワークフロー設定ディレクトリの作成

```
/home/tukapontas/ai-secretary2/config/
├── bots/
│   └── ...
├── workflows/
│   ├── calendar.yml
│   ├── task.yml
│   └── common.yml
```

#### 2. ワークフロー設定ファイル

```yaml
# config/workflows/calendar.yml
id: "calendar"
name: "スケジュール管理"
description: "Googleカレンダーの予定を管理します。予定の表示、作成、編集、削除ができます。"

# トリガーワード
triggers:
  - "予定"
  - "スケジュール" 
  - "カレンダー"
  - "空き時間"

# 正規表現トリガー
regex_triggers:
  - "/^(いつ|何時|何日).+(予定|空き|会議|ミーティング)/i"

# パラメータスキーマ
parameters:
  action:
    type: "string"
    required: true
    description: "実行するアクション（表示/作成/編集/削除）"
    validator: ["表示", "作成", "編集", "削除", "移動"]
  date:
    type: "date"
    required: false
    description: "日付（今日、明日、次の月曜、2025/4/20など）"

# 必要な統合
required_integrations: ["google-calendar"]
```

#### 3. ワークフローレジストリの修正

```typescript
// src/modules/workflows/core/workflow-registry.ts の修正
import { WorkflowDefinition } from './workflow-types';
import logger from '../../../utilities/logger';
import configLoader from '../../../utilities/config-loader'; // 追加
import * as fs from 'fs';
import * as path from 'path';

/**
 * ワークフローレジストリ
 * 全てのワークフローを登録・管理する
 */
class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  
  /**
   * 設定ファイルからワークフローを読み込む
   */
  loadWorkflowsFromConfig(): void {
    try {
      const workflowsDir = path.join(process.cwd(), 'config', 'workflows');
      if (!fs.existsSync(workflowsDir)) {
        logger.warn('ワークフロー設定ディレクトリが見つかりません');
        return;
      }
      
      // .ymlファイルを検索
      const workflowFiles = fs.readdirSync(workflowsDir)
        .filter(file => file.endsWith('.yml'));
      
      for (const file of workflowFiles) {
        try {
          const configPath = `workflows/${file}`;
          const workflowConfig = configLoader.loadConfig(configPath);
          
          // WorkflowDefinition形式に変換
          const workflowDef: WorkflowDefinition = {
            id: workflowConfig.id,
            name: workflowConfig.name,
            description: workflowConfig.description,
            triggers: [
              ...workflowConfig.triggers || [], 
              ...(workflowConfig.regex_triggers || [])
            ],
            parameters: workflowConfig.parameters || {},
            requiredIntegrations: workflowConfig.required_integrations || []
          };
          
          this.registerWorkflow(workflowDef);
          logger.info(`設定ファイルからワークフロー "${workflowDef.id}" を読み込みました`);
        } catch (error) {
          logger.error(`ワークフロー設定ファイル ${file} の読み込みエラー:`, error);
        }
      }
    } catch (error) {
      logger.error('ワークフロー設定ファイルの読み込みに失敗しました:', error);
    }
  }
  
  // 既存のメソッド...
}
```

### 第3フェーズ：RAG設定の外部化

#### 1. RAG設定ディレクトリの作成

```
/home/tukapontas/ai-secretary2/config/
├── bots/
│   └── ...
├── workflows/
│   └── ...
├── rag/
│   ├── triggers.yml
```

#### 2. RAG設定ファイルの作成

```yaml
# config/rag/triggers.yml
enabled: true

# 明示的なトリガーワード
explicit_triggers:
  - "探して"
  - "検索して"
  - "教えて"
  - "調べて"

# トリガーパターン
trigger_patterns:
  # 疑問文パターン
  question_mark: 
    enabled: true
    priority: high
    
  # 5W1H質問パターン  
  wh_questions:
    enabled: true
    patterns:
      - "いつ"
      - "どこ" 
      - "誰が"
      - "何を"
      - "どのように"
      - "なぜ"
    priority: medium

# 自動検出設定
auto_detection:
  enabled: true
  confidence_threshold: 0.7
```

#### 3. クエリプロセッサの修正

```typescript
// src/modules/rag/query/queryProcessor.ts の一部修正
import { Message } from 'discord.js';
import logger from '../../../utilities/logger';
import configLoader from '../../../utilities/config-loader'; // 追加

/**
 * ユーザーからの入力クエリを処理するクラス
 */
class QueryProcessor {
  private ragConfig: any;
  
  constructor() {
    try {
      this.ragConfig = configLoader.loadConfig('rag/triggers.yml');
      logger.info('RAG設定を読み込みました');
    } catch (error) {
      logger.error('RAG設定の読み込みに失敗しました。デフォルト設定を使用します。', error);
      this.ragConfig = {
        enabled: true,
        explicit_triggers: ["探して", "検索して", "教えて", "調べて"]
      };
    }
  }
  
  // 既存のメソッド...
  
  /**
   * ユーザー入力からトリガータイプを検出
   * @returns トリガータイプ (rag, workflow, conversation)
   */
  detectTriggerType(content: string): 'rag' | 'workflow' | 'conversation' {
    // RAG機能が無効化されている場合
    if (!this.ragConfig.enabled) {
      return 'conversation';
    }
    
    // 明示的なRAG起動トリガーワード（設定ファイルから）
    const explicitTriggers = this.ragConfig.explicit_triggers || [];
    for (const trigger of explicitTriggers) {
      if (content.toLowerCase().includes(trigger.toLowerCase())) {
        logger.info(`明示的RAGトリガー検出: ${trigger}`);
        return 'rag';
      }
    }
    
    // 5W1H質問パターン（設定ファイルから）
    if (this.ragConfig.trigger_patterns?.wh_questions?.enabled) {
      const whPatterns = this.ragConfig.trigger_patterns.wh_questions.patterns || [];
      for (const pattern of whPatterns) {
        if (content.includes(pattern)) {
          logger.info(`5W1H質問パターン検出: ${pattern}`);
          return 'rag';
        }
      }
    }
    
    // 残りの既存のロジック...
  }
  
  // 他のメソッド...
}
```

### 第4フェーズ：グローバル設定の実装

#### 1. グローバル設定ファイルの作成

```yaml
# config/system.yml
version: "1.0"
environment: "production"  # production, development, test

# モデル設定
models:
  chat: "gpt-4-turbo"
  embedding: "text-embedding-3-small"
  
# トークン制限
token_limits:
  max_tokens: 500
  max_tokens_rag: 800
  
# デフォルト設定
defaults:
  bot_profile: "gakuco"
  temperature: 0.7
  
# ロギング設定
logging:
  level: "info"  # debug, info, warn, error
  format: "json"
```

#### 2. メインインデックスの修正

```typescript
// src/index.ts の修正
// インポートは同じ

import configLoader from './utilities/config-loader'; // 追加
import botConfigService from './services/bot-config-service'; // 追加

// グローバル設定の読み込み
let systemConfig;
try {
  systemConfig = configLoader.loadConfig('system.yml');
  logger.info('システム設定を読み込みました');
} catch (error) {
  logger.error('システム設定の読み込みに失敗しました。デフォルト設定を使用します。', error);
  systemConfig = {
    defaults: {
      bot_profile: 'gakuco'
    }
  };
}

// デフォルトのボットプロファイルを設定
if (systemConfig.defaults?.bot_profile) {
  botConfigService.switchBotProfile(systemConfig.defaults.bot_profile);
}

// ワークフローを設定ファイルから登録
workflowRegistry.loadWorkflowsFromConfig();

// その他の既存の初期化コード...
```

## 実施スケジュール

### 1日目：
- プロジェクト依存関係の追加 (js-yaml)
- 設定ファイルローダーの実装
- ボット設定ファイルの作成

### 2日目：
- OpenAIサービスの修正
- ボット設定サービスの実装
- ユニットテスト

### 3日目：
- ワークフロー設定の実装
- ワークフローレジストリの修正

### 4日目：
- RAG設定の実装
- クエリプロセッサの修正

### 5日目：
- グローバル設定の実装
- 統合テスト
- ドキュメント整備

## リスク管理

1. **後方互換性**:
   - 既存の機能が壊れないように、設定ファイルが見つからない場合はデフォルト値を使用

2. **エラー処理**:
   - 設定ファイルの読み込みエラーに対するグレースフルなフォールバック機構を全ての箇所に実装

3. **パフォーマンス**:
   - 頻繁な設定ファイル読み込みを避けるためのキャッシング機能の実装

4. **テスト**:
   - 各フェーズの実装後に単体テストと統合テストを実施
   - 設定変更が正しく反映されるかの検証

5. **デプロイプラン**:
   - 本番環境に一度にすべての変更を適用せず、フェーズごとに段階的に適用 