/**
 * @file 拖拽功能模块
 * 按住画布区域拖动整个看板娘容器（支持鼠标和触摸）
 * @module drag
 */

function registerDrag() {
  const waifu = document.getElementById('waifu');
  const head = document.getElementById('waifu-head');
  if (!waifu || !head) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originBottom = 0;

  /** 拖拽开始 */
  function onPointerDown(e: PointerEvent) {
    // 只在拖拽模式激活时响应
    if (!waifu.classList.contains('waifu-drag-active')) return;
    // 忽略右键
    if (e.button && e.button !== 0) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // 记录当前定位（left + bottom）
    const rect = waifu.getBoundingClientRect();
    originLeft = rect.left;
    originBottom = window.innerHeight - rect.bottom;

    // 移除 transition 让拖拽跟手
    waifu.style.transition = 'none';
    waifu.classList.add('waifu-dragging');

    // 阻止文字选中和默认拖拽行为
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
  }

  /** 拖拽中 */
  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = waifu.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // 计算新位置，约束在屏幕内
    let newLeft = originLeft + dx;
    let newBottom = originBottom - dy;

    // 左右边界
    if (newLeft < 0) newLeft = 0;
    if (newLeft + w > vw) newLeft = vw - w;

    // 上下边界
    if (newBottom < 0) newBottom = 0;
    if (newBottom + h > vh) newBottom = vh - h;

    waifu.style.left = `${newLeft}px`;
    waifu.style.bottom = `${newBottom}px`;
    waifu.style.right = 'auto';
  }

  /** 拖拽结束 */
  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;

    waifu.classList.remove('waifu-dragging');

    // 恢复 transition，让后续动画正常
    requestAnimationFrame(() => {
      waifu.style.transition = '';
    });
  }

  head.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  // 清理函数（供未来使用）
  return () => {
    head.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };
}

export default registerDrag;
