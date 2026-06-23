/**
 * @file Contains functions for displaying waifu messages.
 * @module message
 */

import { randomSelection } from './utils.js';

type Time = {
  /**
   * Time period, format is "HH-HH", e.g. "00-06" means from 0 to 6 o'clock.
   * @type {string}
   */
  hour: string;
  /**
   * Message to display during this time period.
   * @type {string}
   */
  text: string;
}[];

let messageTimer: NodeJS.Timeout | null = null;

/**
 * Display waifu message.
 * @param {string | string[]} text - Message text or array of texts.
 * @param {number} timeout - Timeout for message display (ms).
 * @param {number} priority - Priority of the message.
 * @param {boolean} [override=true] - Whether to override existing message.
 */
function showMessage(
  text: string | string[],
  timeout: number,
  priority: number,
  override: boolean = true
) {
  let currentPriority = parseInt(sessionStorage.getItem('waifu-message-priority'), 10);
  if (isNaN(currentPriority)) {
    currentPriority = 0;
  }
  if (
    !text ||
    (override && currentPriority > priority) ||
    (!override && currentPriority >= priority)
  )
    return;
  if (messageTimer) {
    clearTimeout(messageTimer);
    messageTimer = null;
  }
  text = randomSelection(text) as string;
  sessionStorage.setItem('waifu-message-priority', String(priority));
  const tips = document.getElementById('waifu-tips')!;
  tips.innerHTML = text;
  tips.classList.add('waifu-tips-active');
  messageTimer = setTimeout(() => {
    sessionStorage.removeItem('waifu-message-priority');
    tips.classList.remove('waifu-tips-active');
  }, timeout);
}

function detectReferrer(): { type: string; keyword?: string } {
  if (document.referrer === '') return { type: 'none' };
  try {
    const referrer = new URL(document.referrer);
    if (location.hostname === referrer.hostname) return { type: 'localhost' };
    const hostname = referrer.hostname;
    if (/baidu\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('wd');
      return { type: 'baidu', keyword: kw || '' };
    }
    if (/so\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('q');
      return { type: 'so', keyword: kw || '' };
    }
    if (/sogou\.com$/.test(hostname)) {
      const kw = referrer.searchParams.get('query');
      return { type: 'sogou', keyword: kw || '' };
    }
    if (/google\./.test(hostname)) {
      return { type: 'google', keyword: hostname };
    }
    return { type: 'default', keyword: hostname };
  } catch {
    return { type: 'none' };
  }
}

function welcomeMessage(
  time: Time,
  welcomeTemplate?: string,
  referrerTemplates?: Record<string, string>
): string {
  if (location.pathname === '/') {
    for (const { hour, text } of time) {
      const now = new Date(),
        after = hour.split('-')[0],
        before = hour.split('-')[1] || after;
      if (
        Number(after) <= now.getHours() &&
        now.getHours() <= Number(before)
      ) {
        return text;
      }
    }
  }
  if (!welcomeTemplate) return '';
  const referrer = detectReferrer();
  if (referrer.type === 'localhost' || referrer.type === 'none') {
    return i18n(welcomeTemplate, document.title);
  }
  if (referrerTemplates && referrerTemplates[referrer.type]) {
    const template = referrerTemplates[referrer.type];
    if (referrer.type === 'baidu' || referrer.type === 'so' || referrer.type === 'sogou') {
      return i18n(template, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
    }
    if (referrer.type === 'google') {
      return i18n(template, document.title) + '<br>' + i18n(welcomeTemplate, document.title);
    }
    if (referrer.type === 'default') {
      return i18n(template, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
    }
  }
  const referrerTemplate = referrerTemplates?.default;
  if (referrerTemplate) {
    return i18n(referrerTemplate, referrer.keyword || '') + '<br>' + i18n(welcomeTemplate, document.title);
  }
  return i18n(welcomeTemplate, document.title);
}

function i18n(template: string, ...args: string[]) {
  return template.replace(/\$(\d+)/g, (_, idx) => {
    const i = parseInt(idx, 10) - 1;
    return args[i] ?? '';
  });
}

export { showMessage, welcomeMessage, i18n, Time };
