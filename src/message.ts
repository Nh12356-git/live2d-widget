/**
 * @file 消息显示模块，负责看板娘气泡消息和欢迎语
 * @module message
 */

import { randomSelection } from './utils.js';

/**
 * 时间段配置类型
 * 用于根据时间段显示不同的欢迎语
 */
type Time = {
  /** 时间段，格式 "HH-HH"，如 "00-06" 表示 0 点到 6 点 */
  hour: string;
  /** 该时间段显示的消息 */
  text: string;
}[];

/** 消息定时器，用于控制消息显示时长 */
let messageTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * HTML 转义函数，防止 XSS 注入
 * @param str - 需要转义的字符串
 * @returns 转义后的安全字符串
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 显示看板娘消息
 * 支持优先级机制，高优先级消息会覆盖低优先级
 * @param text - 消息文本或文本数组（随机选择）
 * @param timeout - 显示时长（毫秒）
 * @param priority - 优先级（数值越大优先级越高）
 * @param override - 是否覆盖当前消息
 */
function showMessage(
  text: string | string[],
  timeout: number,
  priority: number,
  override: boolean = true
) {
  // 获取当前消息优先级
  let currentPriority = parseInt(sessionStorage.getItem('waifu-message-priority'), 10);
  if (isNaN(currentPriority)) {
    currentPriority = 0;
  }

  // 优先级检查：高优先级不被低优先级覆盖
  if (
    !text ||
    (override && currentPriority > priority) ||
    (!override && currentPriority >= priority)
  )
    return;

  // 清除之前的定时器
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }

  // 随机选择消息并显示
  text = randomSelection(text) as string;
  sessionStorage.setItem('waifu-message-priority', String(priority));
  const tips = document.getElementById('waifu-tips')!;
  tips.innerHTML = text;
  tips.classList.add('waifu-tips-active');

  // 重新定位气泡（可能从上方切到下方）
  if (typeof (window as any).__repositionTips === 'function') {
    requestAnimationFrame(() => (window as any).__repositionTips());
  }

  // 设置定时器，到期后隐藏消息
  messageTimer = setTimeout(() => {
    sessionStorage.removeItem('waifu-message-priority');
    tips.classList.remove('waifu-tips-active');
  }, timeout);
}

/**
 * 检测访问来源（搜索引擎）
 * @returns 来源类型和关键词
 */
function detectReferrer(): { type: string; keyword?: string } {
  if (document.referrer === '') return { type: 'none' };
  try {
    const referrer = new URL(document.referrer);
    // 本地访问
    if (location.hostname === referrer.hostname) return { type: 'localhost' };
    const hostname = referrer.hostname;
    // 百度搜索
    if (/baidu\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('wd');
      return { type: 'baidu', keyword: kw || '' };
    }
    // 360 搜索
    if (/so\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('q');
      return { type: 'so', keyword: kw || '' };
    }
    // 搜狗搜索
    if (/sogou\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('query');
      return { type: 'sogou', keyword: kw || '' };
    }
    // 谷歌搜索
    if (/google\.(com|co\.\w+|com\.\w+)$/.test(hostname)) {
      return { type: 'google', keyword: hostname };
    }
    // 其他来源
    return { type: 'default', keyword: hostname };
  } catch {
    return { type: 'none' };
  }
}

/**
 * 生成欢迎消息
 * 根据时间段、来源和模板生成个性化的欢迎语
 * @param time - 时间段配置数组
 * @param welcomeTemplate - 欢迎模板（支持 $1 占位符）
 * @param referrerTemplates - 来源模板配置
 * @returns 生成的欢迎消息 HTML
 */
function welcomeMessage(
  time: Time,
  welcomeTemplate?: string,
  referrerTemplates?: Record<string, string>
): string {
  // 首页时根据时间段显示消息
  if (location.pathname === '/') {
    for (const { hour, text } of time) {
      const now = new Date(),
        after = Number(hour.split('-')[0]),
        before = Number((hour.split('-')[1] ?? hour.split('-')[0]));
      const h = now.getHours();
      // 支持跨午夜范围，如 "22-06"
      const inRange = after <= before
        ? h >= after && h <= before
        : h >= after || h <= before;
      if (inRange) {
        return text;
      }
    }
  }

  if (!welcomeTemplate) return '';

  // 根据来源显示不同欢迎语
  const referrer = detectReferrer();
  if (referrer.type === 'localhost' || referrer.type === 'none') {
    return i18n(welcomeTemplate, document.title);
  }
  if (referrerTemplates && referrerTemplates[referrer.type]) {
    const template = referrerTemplates[referrer.type];
    // 搜索引擎：显示搜索关键词 + 页面标题
    if (referrer.type === 'baidu' || referrer.type === 'so' || referrer.type === 'sogou') {
      return i18n(template, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
    }
    // 谷歌：显示页面标题
    if (referrer.type === 'google') {
      return i18n(template, document.title) + '<br>' + i18n(welcomeTemplate, document.title);
    }
    // 其他来源
    if (referrer.type === 'default') {
      return i18n(template, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
    }
  }
  // 默认来源模板
  const referrerTemplate = referrerTemplates?.default;
  if (referrerTemplate) {
    return i18n(referrerTemplate, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
  }
  return i18n(welcomeTemplate, document.title);
}

/**
 * 国际化模板替换
 * 将模板中的 $1, $2 等占位符替换为实际值
 * @param template - 包含占位符的模板字符串
 * @param args - 替换值
 * @returns 替换后的字符串
 */
function i18n(template: string, ...args: string[]) {
  return template.replace(/\$(\d+)/g, (_, idx) => {
    const i = parseInt(idx, 10) - 1;
    return escapeHtml(args[i] ?? '');
  });
}

export { showMessage, welcomeMessage, i18n, escapeHtml, Time };
