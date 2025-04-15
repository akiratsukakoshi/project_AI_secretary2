# PM2 による常駐型MCPサーバー管理ガイド

## 概要

gaku-co（ガクコ）プロジェクトでは、外部サービスとの連携のための常駐型MCPサーバーをProcess Manager 2（PM2）を使用して管理しています。このドキュメントでは、PM2の設定方法、MCPサーバーの起動/停止/監視方法、およびトラブルシューティングの手順について説明します。

## PM2とは

PM2は、Node.jsアプリケーションのためのプロダクション用プロセスマネージャーです。主な機能には以下があります：

- プロセスの自動再起動
- ログ管理とローテーション
- アプリケーションのクラスタリング
- システム起動時の自動起動
- モニタリングと状態管理

## 基本的なセットアップ

### PM2のインストール

```bash
npm install -g pm2
```

### ecosystem.config.js

PM2はecosystem.config.jsファイルを使用してアプリケーションの設定を管理します。

```javascript
// ecosystem.config.js
module.exports = {
  apps : [{
    name: "notion-mcp",
    script: "/home/tukapontas/ai-secretary2/mcp-servers/notion-mcp/build/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "200M",
    env: {
      NODE_ENV: "production",
      NOTION_TOKEN: process.env.NOTION_TOKEN || "your_notion_token",
      NOTION_VERSION: process.env.NOTION_VERSION || "2022-06-28",
      PORT: 3001
    },
    error_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-error.log",
    out_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
};
```

### 設定の説明

- **name**: サービスの識別名
- **script**: 実行するJavaScriptファイルへのパス
- **instances**: 実行するインスタンス数（1はシングルスレッド）
- **autorestart**: プロセスがクラッシュした場合に自動的に再起動するか
- **watch**: ファイル変更があった場合に自動的に再起動するか
- **max_memory_restart**: このメモリ使用量を超えた場合に自動的に再起動する
- **env**: プロセスに渡す環境変数
- **error_file**: エラーログを保存するファイルパス
- **out_file**: 標準出力を保存するファイルパス
- **log_date_format**: ログの日付フォーマット

## サーバー管理

### サーバーの起動

```bash
# 設定ファイルを使用して起動
pm2 start ecosystem.config.js

# 個別のプロセスとして起動
pm2 start /path/to/app.js --name "app_name"
```

### サーバーの停止

```bash
# 特定のサービスを停止
pm2 stop notion-mcp

# すべてのサービスを停止
pm2 stop all
```

### サーバーの再起動

```bash
# 特定のサービスを再起動
pm2 restart notion-mcp

# すべてのサービスを再起動
pm2 restart all
```

### サーバーの削除

```bash
# 特定のサービスを削除
pm2 delete notion-mcp

# すべてのサービスを削除
pm2 delete all
```

### ステータス確認

```bash
# すべてのサービスのステータスを表示
pm2 status

# より詳細な情報を表示
pm2 show notion-mcp
```

### ログの表示

```bash
# すべてのログを表示
pm2 logs

# 特定のサービスのログを表示
pm2 logs notion-mcp

# エラーログのみ表示
pm2 logs notion-mcp --err
```

## 起動スクリプト

プロジェクトには、MCPサーバーを起動するためのスクリプトが含まれています。

```bash
#!/bin/bash
# scripts/start-mcp-servers.sh

# 既存のサーバーを停止
pm2 delete notion-mcp google-calendar-mcp 2>/dev/null || true

# サーバーを起動
cd /home/tukapontas/ai-secretary2/
pm2 start ecosystem.config.js

# ステータス表示
pm2 status

# PM2の保存（再起動時に自動起動するため）
pm2 save
```

### スクリプトの実行

```bash
chmod +x scripts/start-mcp-servers.sh
./scripts/start-mcp-servers.sh
```

## ログローテーション設定

PM2にはログローテーション機能が組み込まれており、プラグインとして利用できます。

### インストール

```bash
pm2 install pm2-logrotate
```

### 設定

```bash
# ログの最大サイズ
pm2 set pm2-logrotate:max_size 10M

# 保持するログファイルの数
pm2 set pm2-logrotate:retain 5

# ローテーション間隔
pm2 set pm2-logrotate:interval_unit 'DD' # 日単位
pm2 set pm2-logrotate:interval 1 # 1日ごと
```

## システム起動時の自動起動

PM2で管理しているプロセスをシステム起動時に自動的に起動するように設定できます。

```bash
# 現在の設定を保存
pm2 save

# 起動スクリプトを生成
pm2 startup

# 表示された指示に従って実行
# 例: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u username --hp /home/username
```

## トラブルシューティング

### よくある問題と解決策

#### サーバーが起動しない

1. ログを確認: `pm2 logs notion-mcp --err`
2. 環境変数が正しく設定されているか確認
3. スクリプトのパスが正しいか確認
4. ポート競合がないか確認: `netstat -tuln | grep 3001`

#### メモリ使用量が高い

1. メモリ使用状況を確認: `pm2 monit`
2. `max_memory_restart` 設定を調整
3. メモリリークの可能性がないか確認

#### ログファイルが肥大化している

1. ログローテーションを設定
2. ログレベルを調整
3. 不要なログファイルの削除: `find /home/tukapontas/ai-secretary2/logs -name "*.log" -type f -mtime +7 -delete`

## 詳細設定

### クラスタモード

複数のCPUコアを活用するために、PM2が提供するクラスタモードを利用できます。

```javascript
module.exports = {
  apps: [{
    name: "notion-mcp-cluster",
    script: "/path/to/app.js",
    instances: "max", // または具体的な数値（例：4）
    exec_mode: "cluster"
  }]
};
```

### 環境ごとの設定

異なる環境（開発、テスト、本番）で異なる設定を使用できます。

```javascript
module.exports = {
  apps: [{
    name: "notion-mcp",
    script: "/path/to/app.js",
    env: {
      NODE_ENV: "development",
      PORT: 3001
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3001
    },
    env_test: {
      NODE_ENV: "test",
      PORT: 3002
    }
  }]
};
```

起動時に環境を指定する:

```bash
pm2 start ecosystem.config.js --env production
```

## gaku-co プロジェクトでのPM2の活用

### 現在の構成

gaku-co プロジェクトでは、以下のサービスをPM2で管理しています：

1. **Notion MCP サーバー**
   - ポート: 3001
   - Notionとの連携に使用

2. **Google Calendar MCP サーバー** (将来実装予定)
   - ポート: 3002
   - Googleカレンダーとの連携に使用

### モニタリングダッシュボード

PM2のモニタリングダッシュボードを使用して、各MCPサーバーの状態を監視できます：

```bash
pm2 monit
```

このコマンドは、CPUとメモリ使用量、ログ、その他のメトリクスを含むインタラクティブなダッシュボードを表示します。

### ウェブベースのダッシュボード (PM2 Plus)

より高度なモニタリング機能が必要な場合は、PM2 Plusを検討することもできます：

```bash
pm2 plus
```

このコマンドは、PM2 Plusへの登録プロセスを開始します。PM2 Plusは、ウェブベースのダッシュボード、詳細なメトリクス、アラート機能などを提供します。

## MCPサーバーにおけるセキュリティ考慮事項

### 1. API認証の検討

現在のMCPサーバーは内部環境での使用を想定していますが、より堅牢なセキュリティが必要な場合は、API認証を追加することを検討してください：

```javascript
// server/index.js
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.MCP_API_KEY) {
    return res.status(401).json({ error: '認証エラー: 無効なAPIキー' });
  }
  next();
});
```

### 2. ネットワーク分離

MCPサーバーをプライベートネットワーク内に配置し、外部からの直接アクセスを制限することを検討してください。

### 3. 環境変数の保護

機密性の高い環境変数（APIキーなど）の管理には、dotenv-safe や環境変数の暗号化ツールの使用を検討してください。

## まとめ

PM2を使用することで、gaku-co プロジェクトのMCPサーバーを効率的に管理し、安定した運用を実現しています。自動再起動、ログ管理、モニタリング機能により、サーバーの信頼性が向上し、問題の早期発見と解決が可能になります。

将来的には、さらに多くのサービスをPM2で管理することで、システム全体の安定性と拡張性を高めていく予定です。
