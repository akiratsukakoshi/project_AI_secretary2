#!/bin/bash
# サーバー起動スクリプト

# 既存のサーバーを停止
pm2 delete notion-mcp google-calendar-mcp 2>/dev/null || true

# サーバーを起動
cd /home/tukapontas/ai-secretary2/
pm2 start ecosystem.config.js

# 将来的にGoogle Calendar MCPを追加する場合の準備
# cd /home/tukapontas/ai-secretary2/mcp-servers/google-calendar-mcp
# pm2 start build/index.js --name google-calendar-mcp --log /home/tukapontas/ai-secretary2/logs/google-calendar-mcp.log

# ステータス表示
pm2 status

# PM2の保存（再起動時に自動起動するため）
pm2 save
