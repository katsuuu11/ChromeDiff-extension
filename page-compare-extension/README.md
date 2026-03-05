# Page Compare Overlay - Chrome拡張

CMSを含むステージング環境と本番環境を重ねて比較し、公開後の差異をすばやくチェックするChrome拡張機能です。

## 機能

- **2ページを重ねて表示**：iframeで2つのURLを同時に表示
- **透過調整**：上のレイヤーの不透明度を0-100%で調整
- **ブレンドモード**：Normal と Difference の2種類
- **位置調整**：X/Y方向に±500pxまで微調整可能
- **スクロール同期**：両方のページを同時にスクロール
- **レイヤー切り替え**：操作対象を上下で切り替え
- **ヘッダ書き換え**：比較対象ドメインに対してのみ X-Frame-Options を限定的に無効化

## インストール手順

### 1. アイコン画像を準備（オプション）

このリポジトリには画像ファイル自体は含めていません（バイナリ制約のため）。
`page-compare-extension/icons/icon.png` を手動で追加してください（正方形のPNG推奨）。

**アイコンがない場合の回避策：**
manifest.jsonから以下の行を削除してください：
```json
"default_icon": {
  "16": "icons/icon.png",
  "32": "icons/icon.png",
  "48": "icons/icon.png",
  "128": "icons/icon.png"
},
```
および
```json
"icons": {
  "16": "icons/icon.png",
  "32": "icons/icon.png",
  "48": "icons/icon.png",
  "128": "icons/icon.png"
}
```

### 2. Chromeに拡張を読み込む

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダ全体を選択

### 3. 権限の確認

この拡張は `host_permissions` を持たず、`optional_host_permissions` を使って比較実行時に対象ドメイン分だけ許可を求める設計です。
そのため、インストール時に「すべてのサイトのデータを読み取る」系の恒久的なパーミッション警告は表示されません。

比較開始時に対象URLごとの権限リクエストが表示されます：
- 比較対象の2ドメインのみアクセスを許可してください（最小権限）

## 使い方

### 基本的な流れ

1. **拡張アイコンをクリック**してポップアップを開く
2. **Base URL**（下レイヤー）に本番サイトのURLを入力
   例：`https://www.example.com/page`
3. **Compare URL**（上レイヤー）にステージング環境（CMSを含む）のURLを入力
   例：`https://staging.example.com/page`
4. **「Open Compare」**ボタンをクリック
5. 新しいタブで比較画面が開く

### 比較画面の操作

#### マウス操作
- **スクロール**：マウスホイールで両ページを同時スクロール
- **スライダー**：
  - Opacity：上レイヤーの透明度
  - X Offset / Y Offset：上レイヤーの位置調整

#### キーボードショートカット
- **Space**：アクティブレイヤーを切り替え（クリック操作の対象を変更）
- **S**：スクロール同期のON/OFF切り替え
- **矢印キー**：位置を1pxずつ微調整
- **Shift + 矢印キー**：位置を10pxずつ調整

#### ブレンドモード
- **Normal**：通常の重ね
- **Difference**：差分が白く表示される

## トラブルシューティング

### iframeが表示されない

**原因**：ヘッダ書き換えルールが効いていない

**確認方法**：
1. 比較画面でF12を押してDevToolsを開く
2. Consoleタブでエラーを確認
3. `Refused to display ... in a frame` というエラーがあれば失敗

**対処法**：
1. `chrome://extensions/` で拡張の詳細を開く
2. 「サイトアクセス」が「すべてのサイト」になっているか確認
3. なっていない場合は変更して再度試す

### スクロール同期が効かない

**原因1**：Sync Scroll が OFF になっている
→ 「Sync Scroll: ON」ボタンを確認

**原因2**：content.js が読み込まれていない
→ iframe内でF12を開いてConsoleに "Content script loaded" が出ているか確認

**原因3**：一部のサイトはJavaScriptでスクロールを制御している
→ その場合は手動でスクロールするか、レイヤーを切り替えて操作

### 両方のURLが同じドメインの場合

同じドメイン内（例：staging.example.com と www.example.com）の比較も可能です。
ヘッダ書き換えルールはドメインに関係なく適用されます。

## ファイル構成

```
page-compare-extension/
├── manifest.json          # 拡張の設定
├── rules.json            # ヘッダ書き換えルール
├── popup.html            # URL入力UI
├── popup.js              # URL入力のロジック
├── overlay.html          # 比較画面UI
├── overlay.js            # 比較画面のロジック
├── content.js            # iframe内スクロール制御
├── background.js         # Service Worker
└── icons/
    └── icon.png          # アイコン（手動追加・1枚を各サイズに共通利用）
```

## セキュリティに関する注意

この拡張は **ユーザーが許可した比較対象ドメインに対してのみ、iframe 用サブフレームの X-Frame-Options を調整** します。

- **自分のブラウザでのみ使用してください**
- **公開前に権限と対象ドメインの最小化を必ず行ってください**
- 信頼できるサイトの比較にのみ使用してください

## ライセンス

自由に改変・利用してください。

## 開発者向けメモ

### ヘッダ書き換えの仕組み

`background.js` で比較開始時に dynamic rules を更新し、以下を実行：
1. 比較対象URLから抽出したドメインに限定
2. `sub_frame` レスポンスの `X-Frame-Options` ヘッダのみ削除

さらに content script も同じドメインにだけ動的登録し、影響範囲を最小限にしています。

### スクロール同期の仕組み

1. `overlay.js` が wheelイベントを検知
2. 両方のiframeに `postMessage` でスクロール量を送信
3. `content.js` が各iframe内で受信して `window.scrollTo()` を実行

別オリジンでも動作します（content scriptの権限で実行されるため）。

### 今後の拡張案

- [ ] スクリーンショット撮影機能
- [ ] 差分箇所の自動ハイライト
- [ ] 複数ページの一括比較
- [ ] カスタムCSS注入（要素の非表示など）
- [ ] 比較設定のプリセット保存
