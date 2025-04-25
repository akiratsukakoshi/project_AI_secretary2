# 実現したいこと
　-system promptとボット自体、並びにワークフロー等のトリガーワードをプログラム上の書き換えではなくて、ymlファイルなど別ソースで外部化したい【背景】
　-キャラクターの変更や調整をなるべく簡単に1か所でできるようにしたい
　-ワークフロー、RAGの起動をなるべくシンプルに一元管理で調整できるようにしたい作業フォルダ：

# 実現方法
YAML ベースの設定システムを実装することを提案します。これにより以下が可能になります：

システムプロンプトとボットの性格を外部化
ワークフローのトリガーワードを一箇所で管理
コード変更なしで RAG の動作を設定
異なるボット「プロファイル」の簡単な切り替え

提案するソリューション
1. 設定ディレクトリ構造の作成
/home/tukapontas/ai-secretary2/config/
├── bots/                           # ボットの性格プロファイル
│   ├── gakuco.yml                  # デフォルトの「ガクコ」性格
│   └── alternatives/               # 必要に応じた代替性格
│       ├── formal.yml
│       └── casual.yml
├── workflows/                      # ワークフロー設定
│   ├── calendar.yml
│   ├── task.yml
│   ├── notion.yml
│   └── common.yml                  # 共有ワークフロー設定
├── rag/                            # RAG 設定
│   ├── triggers.yml                # RAG 検出トリガー
│   └── sources.yml                 # ソースタイプ設定
└── system.yml                      # グローバルシステム設定
2. サンプル YAML 設定ファイル
config/bots/gakuco.yml
yamlname: "gaku-co"
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
config/workflows/calendar.yml
yamlid: "calendar"
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
  - pattern: "^(いつ|何時|何日).+(予定|空き|会議|ミーティング)"
    flags: "i"  # 大文字小文字を区別しない

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
  # 他のパラメータ定義...

# ワークフロープロンプト
prompts:
  selection: |
    あなたはGoogleカレンダーを操作するエージェントです。
    ユーザーの要求: "{{query}}"
    
    利用可能なツール:
    {{tool_descriptions}}
    
    これらのツールを使って、ユーザーの要求に応えてください。
  # 他のプロンプト定義...

# 必要な統合
required_integrations: ["google-calendar"]
config/rag/triggers.yml
yaml# RAG検索トリガー設定
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
  confidence_threshold: 0.7  # 0.0-1.0、自動検出の信頼度閾値
  
# ユーザー確認設定
user_confirmation:
  enabled: true  # 確信度が低い場合にユーザーに確認するか
  threshold: 0.5  # この値以下の確信度で確認する
3. 実装戦略
フェーズ1: 設定読み込みシステム

YAML ファイルを読み込んで解析する設定マネージャークラスを作成
繰り返しのファイル読み取りを避けるためのキャッシング実装
設定ファイルの検証を追加

フェーズ2: ボットの性格統合

外部化されたシステムプロンプトを使用するように OpenAI サービスを修正
異なるボットプロファイル間を切り替えるメカニズムの作成

フェーズ3: ワークフロー統合

設定からトリガーワードを読み込むようにワークフローレジストリを更新
外部化されたパラメータを使用するようにワークフロー定義を修正

フェーズ4: RAG 統合

外部化されたトリガーパターンを使用するようにクエリプロセッサを更新
設定ベースの検出ロジックを実装

修正が必要な主要ファイル
プロジェクト構造に基づいて、修正が必要な主なファイルは以下の通りです：

OpenAI サービス: /home/tukapontas/ai-secretary2/src/services/openai.ts
ワークフローレジストリ: /home/tukapontas/ai-secretary2/src/modules/workflows/core/workflow-registry.ts
クエリプロセッサ: /home/tukapontas/ai-secretary2/src/modules/rag/query/queryProcessor.ts
メインインデックス: /home/tukapontas/ai-secretary2/src/index.ts

このアプローチの利点

集中管理された設定: ボットの性格、ワークフロートリガー、RAG設定がすべて一箇所に
簡単な更新: コードに触れることなく動作を変更可能
バージョン管理: gitで設定の変更を追跡
複数の性格: 異なるコンテキスト用に異なるボットペルソナを作成
結合度の低減: 実装から設定を分離

考慮事項

後方互換性: 既存の機能が壊れないようにする
エラー処理: 設定ファイルが欠落または無効な場合のグレースフルなフォールバック
ドキュメント: YAMLスキーマの明確なドキュメントを作成
テスト: 異なる設定間の移行をテスト