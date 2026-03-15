# トラブルシューティング

> 最終更新: 2026-03-15

---

## ① pnpm の virtual store ズレ問題

**症状:** `pnpm add` 実行時に以下のようなエラーが出る。

```
ERR_PNPM_UNEXPECTED_VIRTUAL_STORE  Unexpected virtual store location
The dependencies at "node_modules" are currently symlinked from "light-md/node_modules/.pnpm"
```

**原因:** 以前のフォルダ構造（`light-md/` というサブフォルダにプロジェクトがあった状態）で pnpm を使用した後、ディレクトリをフラットに整理したことで、シンボリックリンクの参照先がズレた。

**解決策:**

```powershell
# 非対話型モードで強制的に node_modules を作り直す
CI=true pnpm install
```

これで virtual store が正しいパス（`node_modules/.pnpm`）に再構築される。

---

## ② Tailwind CSS v4 の設定は v3 と大きく異なる

**v3 の方法（古い / 使用しない）:**

```bash
npx tailwindcss init -p   # tailwind.config.js と postcss.config.js を生成
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**v4 の正しい方法（本プロジェクトで採用）:**

`tailwind.config.js` も `postcss.config.js` も**不要**。

```powershell
# Vite 用プラグインを追加インストール
pnpm add -D @tailwindcss/vite
```

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // ...
});
```

```css
/* src/index.css — これだけでOK */
@import "tailwindcss";
```

**ダークモード設定:**
v4 では `prefers-color-scheme` への対応が**デフォルト**。
`dark:` ユーティリティクラスは追加設定なしで動作する。

---

## ③ CI=true が必要な場面（非対話型ターミナル）

Claude Code（CLI）や CI 環境など、TTY（対話型ターミナル）でない環境で pnpm を実行すると、危険な操作（node_modules 削除など）を確認できないとしてエラーになることがある。

```
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY
```

**解決策:** 先頭に `CI=true` を付ける。

```powershell
CI=true pnpm install
```

---

## ④ tauri.conf.json と vite.config.ts のポート一致

Tauri は開発時に Vite dev server の URL を参照するため、両ファイルのポートが一致している必要がある。

```json
// tauri.conf.json
"devUrl": "http://localhost:1420"
```

```ts
// vite.config.ts
server: { port: 1420, strictPort: true }
```

ポートを変更する場合は**両方を同時に**変更すること。

---

## ⑤ App.css は現在未使用だが削除していない

`src/App.css` には旧サンプルのスタイルが残っているが、`App.tsx` からのインポートは削除済み。
ファイル自体は残置しているが、実際には何も影響しない。
混乱を避けたい場合は削除して構わない。
