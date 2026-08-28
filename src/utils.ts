/**
 * @file 工具函数模块
 * @module utils
 */

/**
 * 从数组中随机选择一个元素，或直接返回原值
 * @param obj - 字符串数组或单个字符串
 * @returns 随机选择的元素或原值
 */
function randomSelection(obj: string[] | string): string {
  return Array.isArray(obj) ? obj[Math.floor(Math.random() * obj.length)] : obj;
}

/**
 * 根据网页视口大小计算看板娘默认画布缩放比例
 * 以视口高度 720px 为基准 1.0（1080p 全屏时约 1.5，与原默认一致），
 * 同时受视口宽度约束，避免窄屏下超出屏幕。
 * @returns 默认缩放比例（0.6 ~ 3.0）
 */
function computeAutoScale(): number {
  const vh = window.innerHeight || 900;
  const vw = window.innerWidth || 1600;
  const byH = vh / 720;
  const byW = vw / 1000;
  const scale = Math.min(byH, byW);
  return Math.max(0.6, Math.min(3.0, Math.round(scale * 10) / 10));
}

/**
 * 从 N 个选项中随机选择一个，排除指定索引
 * @param total - 选项总数
 * @param excludeIndex - 要排除的索引
 * @returns 随机选择的索引（不会等于 excludeIndex）
 */
function randomOtherOption(total: number, excludeIndex: number): number {
  if (total <= 1) return 0;
  const idx = Math.floor(Math.random() * (total - 1));
  return idx >= excludeIndex ? idx + 1 : idx;
}

/**
 * 异步加载外部资源（CSS 或 JS）
 * @param url - 资源路径
 * @param type - 资源类型：'css' 或 'js'
 * @returns 加载成功返回资源路径，失败则 reject
 */
function loadExternalResource(url: string, type: string): Promise<string> {
  return new Promise((resolve: any, reject: any) => {
    let tag;

    if (type === 'css') {
      tag = document.createElement('link');
      tag.rel = 'stylesheet';
      tag.href = url;
    }
    else if (type === 'js') {
      tag = document.createElement('script');
      tag.src = url;
    }
    else {
      reject(new Error(`Unsupported resource type: ${type}`));
      return;
    }
    tag.onload = () => resolve(url);
    tag.onerror = () => {
      tag.remove();
      reject(url);
    };
    document.head.appendChild(tag);
  });
}

export { randomSelection, loadExternalResource, randomOtherOption, computeAutoScale };
