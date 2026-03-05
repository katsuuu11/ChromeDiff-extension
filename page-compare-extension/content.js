// iframe内で動作するスクリプト
// overlay.jsからのpostMessageを受け取ってスクロールを実行

window.addEventListener('message', (event) => {
  // セキュリティチェック（拡張からのメッセージのみ受け入れ）
  if (event.data && event.data.type === 'SCROLL_DELTA') {
    const deltaX = event.data.deltaX;
    const deltaY = event.data.deltaY;
    
    // 現在のスクロール位置を取得
    const currentX = window.scrollX || window.pageXOffset;
    const currentY = window.scrollY || window.pageYOffset;
    
    // スクロールを実行
    window.scrollTo({
      left: currentX + deltaX,
      top: currentY + deltaY,
      behavior: 'auto' // smoothにすると遅延が出るのでauto
    });
  }
});

// 拡張が読み込まれたことを確認するためのログ（開発用、本番では削除可）
console.log('Page Compare Extension: Content script loaded');
