# 環境構築ガイド

> 最終更新: 2026-03-15
> 対象OS: Windows 11

---

## 必要なツールの導入

### 1. Rust

Tauri のビルドに必要。

```powershell
# rustup インストーラをダウンロードして実行
# https://rustup.rs/ からインストーラを取得

# インストール後、バージョン確認
rustc --version
cargo --version
```

インストール後、Tauri が必要とする Windows Build Tools（MSVC）も要求される場合がある。
その際は Visual Studio Installer から「C++ によるデスクトップ開発」をインストールする。

### 2. Node.js（fnm 経由を推奨）

fnm（Fast Node Manager）を使うと Node バージョン管理が楽になる。

```powershell
# winget で fnm をインストール
winget install Schniz.fnm

# PowerShell プロファイルに fnm の初期化を追記
# $PROFILE を開く
notepad $PROFILE

# 以下を追記して保存
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression

# ターミナルを再起動後、最新 LTS をインストール
fnm install --lts
fnm use lts-latest

# 確認
node --version
```

> **Windows 特有の注意:** `$PROFILE` が存在しない場合は `New-Item -Path $PROFILE -Force` で作成してから編集する。
> また、スクリプト実行ポリシーが制限されている場合は以下を実行する（管理者 PowerShell）:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 3. pnpm

```powershell
# npm 経由でインストール
npm install -g pnpm

# または winget
winget install pnpm.pnpm

# 確認
pnpm --version
```

---

## プロジェクトのセットアップ

```powershell
# リポジトリをクローン（またはフォルダに移動）
cd C:\Users\<username>\Desktop\dev\LightMarkdownEditor

# 依存パッケージをインストール
pnpm install
```

> **注意:** 初回または node_modules の状態がおかしい場合は `CI=true pnpm install` を使う（[troubleshooting.md](./troubleshooting.md) 参照）。

---

## 開発サーバーの起動

```powershell
# Tauri 開発モード（Vite dev server + Rust ビルドが同時起動）
pnpm tauri dev
```

初回起動時は Rust クレートのコンパイルに数分かかる。2回目以降はキャッシュにより高速。

### フロントエンドのみ確認したい場合

```powershell
pnpm dev
# → http://localhost:1420 でブラウザ確認
```

### プロダクションビルド

```powershell
pnpm tauri build
# → src-tauri/target/release/bundle/ にインストーラが生成される
```
