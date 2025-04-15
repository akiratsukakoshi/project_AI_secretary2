#!/bin/bash
# PM2のログローテーション設定スクリプト

# pm2-logrotateモジュールをインストール
pm2 install pm2-logrotate

# ログローテーションの設定
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# 設定を表示
echo "PM2ログローテーション設定が完了しました"
pm2 conf | grep pm2-logrotate
