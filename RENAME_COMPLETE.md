# Staging-Production Sync Checker

**テスト環境と本番環境の同期を確認する拡張機能**

## コンセプト

テスト環境から本番環境への反映が完璧か、視覚的にチェックします。

- **完全一致** → 同期OK、問題なし
- **差異あり** → 反映ミスを即座に検出

---

## 更新内容

### 拡張名
- 旧：Page Compare Overlay
- 新：**Staging-Production Sync Checker**

### 説明文
「テスト環境と本番環境を重ねて表示し、同期の完璧さを確認する」

### UI変更
- Base URL → **Production URL（本番環境）**
- Compare URL → **Staging/Test URL（テスト環境）**
- Open Compare → **Check Sync**

---

## 更新方法

### ファイル差し替え（推奨）

以下のファイルを上書き：
- manifest.json
- popup.html
- overlay.html
- content.js

その後、`chrome://extensions/` で **再読み込み（↻）**

---

## 使い方

1. 拡張アイコンをクリック
2. 本番URLとテストURLを入力
3. 「Check Sync」をクリック
4. **Difference モード** で差分を確認
   - 真っ黒 → 完璧に同期
   - 白く光る → その部分に差異あり

---

これで目的が明確になりました！
