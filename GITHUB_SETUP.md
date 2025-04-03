# GitHubリポジトリのセットアップ手順

以下の手順に従って、このプロジェクトをGitHubリポジトリにアップロードしてください。

## 前提条件

- Gitがインストールされていること
- GitHubアカウントを持っていること
- WSL環境が設定されていること

## 手順

### 1. GitHubでリポジトリを作成
1. GitHubにログイン
2. 右上の「+」アイコンをクリック→「New repository」を選択
3. リポジトリ名を「ai-secretary2」に設定
4. 必要に応じて説明を追加
5. 「Create repository」をクリック

### 2. WSL環境でリポジトリを初期化

```bash
# プロジェクトディレクトリに移動
cd ~/ai-secretary2

# Gitリポジトリを初期化
git init

# 全てのファイルをステージング
git add .

# 初期コミットを作成
git commit -m "Initial commit: project structure and base files"

# mainブランチに名前を変更（Gitの新しい標準に合わせる）
git branch -M main

# GitHubリポジトリをリモートとして追加（URLは実際のリポジトリURLに置き換えてください）
git remote add origin https://github.com/あなたのユーザー名/ai-secretary2.git

# リモートリポジトリにプッシュ
git push -u origin main
```

### 3. WSL環境で開発を続ける

```bash
# 依存関係をインストール
npm install

# .envファイルを作成して必要な情報を設定
cp .env.example .env
# エディタで.envファイルを開き、必要な情報を入力

# 開発サーバーを起動
npm run dev
```

## トラブルシューティング

- `git push`でエラーが発生する場合は、GitHubの認証情報が正しく設定されているか確認してください。
- `npm install`でエラーが発生する場合は、Node.jsとnpmが正しくインストールされているか確認してください。

必要に応じて、上記の手順を調整してください。
