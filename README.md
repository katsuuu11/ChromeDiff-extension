# Chrome Diff Pair

Chrome Diff Pair は、ステージング環境と本番環境を 2 つの通常 Chrome ウィンドウで並べて比較する Manifest V3 拡張です。

## v1 UX（シンプル版）

- ポップアップは **2つの入力だけ**で開始します。  
  - **ステージングURL**
  - **本番URL**
- URL の自動推測・自動生成は行いません。
- 補助ボタンは次の 2 つのみです。  
  - **今のタブをステージングに入れる**
  - **今のタブを本番に入れる**
- ユーザーが最終的な 2 つの URL を明示的に決める設計です。

## 主な機能

- ポップアップから「**比較を開始**」でセッション開始
- 左右ウィンドウを自動配置して同時比較
- スクロール同期（比率ベース）
- URL 同期（ON/OFF 可能）
- セッション操作（**再開 / やり直す / 終了**）
- 画面内コントロールバー（**ステージング / 本番 / 同期を止める / 同期を再開 / 位置を合わせる / 終了 / 最小化**）
- 状態表示（**比較中 / 同期停止中 / 片方の画面が閉じられました**）

## インストール

1. `chrome://extensions` を開く
2. **デベロッパーモード** を ON
3. **パッケージ化されていない拡張機能を読み込む** をクリック
4. このリポジトリ（`ChromeDiff-extension`）を選択
5. 拡張アイコンを開き、2つのURLを入れて **比較を開始**

## 権限

- `tabs`: 比較タブの操作、現在タブ URL の取得
- `windows`: 左右ウィンドウの作成・再配置
- `scripting`: 比較用コンテンツスクリプトの注入
- `storage`: セッション状態の保存
- `host_permissions: <all_urls>`: 入力された URL で動作するため

## 制限事項

- iframe オーバーレイ型の比較ではありません
- ピクセル単位の厳密 diff ツールではありません
- サイト構造によってはスクロール同期がずれる場合があります

## プロジェクト構成

```
/src
  /background
    service-worker.js
    session-manager.js
    window-manager.js
    url-mapper.js
    message-router.js
  /content
    compare-agent.js
    scroll-sync.js
    nav-sync.js
    control-bar.js
    page-state.js
  /popup
    popup.html
    popup.css
    popup.js
  /shared
    constants.js
    storage.js
    utils.js
    logger.js
manifest.json
README.md
```
