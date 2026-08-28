/**
 * @file 小部件初始化模块，负责看板娘的整体初始化和事件注册
 * @module widget
 */

import { ModelManager, ModelConfig, ModelListItem } from './model.js';
import { showMessage, welcomeMessage, Time } from './message.js';
import { randomSelection, computeAutoScale } from './utils.js';
import { ToolsManager } from './tools.js';
import logger from './logger.js';
import registerDrag from './drag.js';
import { fa_child } from './icons.js';

/**
 * 提示消息配置接口
 * 包含各种场景下的消息模板
 */
interface Tips {
  message: {
    default: string[];           // 默认消息列表（空闲时随机显示）
    console: string;             // 打开控制台时显示
    copy: string;                // 复制页面内容时显示
    visibilitychange: string;    // 页面重新可见时显示
    changeSuccess: string;       // 换装成功
    changeFail: string;          // 换装失败（只有一套衣服）
    photo: string;               // 截图成功
    goodbye: string;             // 退出时显示
    hitokoto: string;            // 一言来源模板
    welcome: string;             // 欢迎模板
    referrer: string;            // 来源模板
    referrerTemplates?: Record<string, string>; // 各搜索引擎来源模板
    hoverBody: string | string[];   // 鼠标悬停身体时显示
    tapBody: string | string[];     // 点击身体时显示
  };
  time: Time;                    // 时间段配置
  mouseover: {                   // 鼠标悬停配置
    selector: string;            // CSS 选择器
    text: string | string[];     // 显示的消息
  }[];
  click: {                       // 点击配置
    selector: string;            // CSS 选择器
    text: string | string[];     // 显示的消息
  }[];
  seasons: {                     // 节日/季节配置
    date: string;                // 日期范围 MM/DD-MM/DD
    text: string | string[];     // 显示的消息
  }[];
  models: ModelListItem[];      // 模型列表
}

/**
 * 检测视口空间，自动定位模型和工具栏
 * 默认左下角，左侧空间不足时切换到右下角
 * 工具栏始终在模型外侧（有空间的一侧）
 */
function positionWidget() {
  const waifu = document.getElementById('waifu');
  if (!waifu) return;

  // 需要的最小空间：模型(165px) + 工具栏(40px) + 间距(20px)
  const minSpace = 225;
  const vw = window.innerWidth;

  if (vw >= minSpace) {
    // 左侧有空间：模型靠左，工具栏靠右
    waifu.classList.remove('waifu-right');
    waifu.classList.remove('waifu-tool-left');
  } else {
    // 左侧空间不足：模型靠右，工具栏靠左
    waifu.classList.add('waifu-right');
    waifu.classList.add('waifu-tool-left');
  }

  // 动态调整气泡位置：画布靠近底部时气泡在上方，靠近顶部时在下方
  positionTips();
}

/** 气泡当前位置：'top' | 'bottom' | null */
let tipsPosition: 'top' | 'bottom' | null = null;

/** 上次定位时的气泡高度，用于检测文本高度变化后重新定位 */
let lastTipsHeight = 0;

/**
 * 更新 box 尺寸和位置
 * box 宽度 = 画布宽度 + 工具栏偏移，确保不超出屏幕
 */
/**
 * 确保 #waifu 不超出屏幕范围（只约束 left/right）
 */
function clampToScreen() {
  const box = document.getElementById('waifu');
  if (!box) return;

  const vw = window.innerWidth;
  const rect = box.getBoundingClientRect();

  // 右侧不超出
  if (rect.right > vw) {
    box.style.left = `${vw - rect.width}px`;
    box.style.right = 'auto';
  }
  // 左侧不超出
  if (rect.left < 0) {
    box.style.left = '0px';
    box.style.right = 'auto';
  }
}

/**
 * 根据网页视口大小自动设置看板娘默认画布大小
 * 仅当用户未手动设置过缩放（localStorage 无 waifu-scale）时生效；
 * 一旦用户通过设置面板手动调整大小，则不再自动覆盖，保证放大/缩小功能不受影响。
 */
function applyAutoScale() {
  // 用户已通过设置面板手动调整过大小：跳过自动适配
  if (localStorage.getItem('waifu-scale-manual') !== null) return;

  const scale = computeAutoScale();
  const canvas = document.getElementById('live2d');
  const container = document.getElementById('waifu-canvas');
  if (!canvas || !container) return;

  const baseW = 165;
  const baseH = 240;
  const w = baseW * scale;
  const h = baseH * scale;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;

  // 气泡大小随模型缩放：通过 CSS 变量 --ws 驱动基础尺寸（宽度/字号/内边距等）
  const tips = document.getElementById('waifu-tips');
  if (tips) {
    tips.style.setProperty('--ws', String(scale));
  }
  const tool = document.getElementById('waifu-tool');
  if (tool) {
    const toolScale = Math.max(0.4, Math.min(1.0, scale));
    tool.style.transform = `scale(${toolScale})`;
    tool.style.transformOrigin = 'bottom left';
  }
}

/**
 * 根据画布在视口中的位置，决定气泡在画布上方还是下方
 * 仅在位置实际变化时才更新
 */
/** 气泡相对画布的垂直偏移（px）：正值向下平移 */
const TIPS_OFFSET_Y = 40;

function positionTips() {
  const box = document.getElementById('waifu');
  const canvas = document.getElementById('waifu-canvas');
  const tips = document.getElementById('waifu-tips');
  if (!box || !canvas || !tips) return;

  const boxRect = box.getBoundingClientRect();
  const tipsHeight = tips.innerHTML.trim() ? tips.offsetHeight : 40;
  const gap = 10;

  // 判断应该放在上方还是下方
  const newPos: 'top' | 'bottom' = boxRect.top >= tipsHeight + gap ? 'top' : 'bottom';

  // 位置或气泡高度变化时才更新定位（高度随文本内容变化）
  if (newPos === tipsPosition && tipsHeight === lastTipsHeight) return;
  tipsPosition = newPos;
  lastTipsHeight = tipsHeight;

  if (newPos === 'top') {
    tips.style.bottom = 'auto';
    tips.style.top = `${-(tipsHeight + gap) + TIPS_OFFSET_Y}px`;
  } else {
    tips.style.top = 'auto';
    tips.style.bottom = `${-(tipsHeight + gap) + TIPS_OFFSET_Y}px`;
  }
}

/** ResizeObserver：窗口大小变化时重新定位 */
let resizeObserver: ResizeObserver | null = null;

/** 空闲检测定时器（退出时需要清除） */
let idleCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 注册页面事件监听器
 * 包括：空闲检测、悬停/点击事件、控制台检测、复制检测等
 * @param tips - 提示消息配置
 */
/** 事件监听器是否已注册（防止重复注册） */
let eventListenerRegistered = false;

function registerEventListener(tips: Tips) {
  if (eventListenerRegistered) return;
  eventListenerRegistered = true;

  // 用户活动检测：空闲 20 秒后显示随机消息
  let userAction = false;
  let userActionTimer: any;
  const messageArray = tips.message.default;

  // 将节日消息加入默认消息列表
  tips.seasons.forEach(({ date, text }) => {
    const now = new Date();
    const [startStr, endStr] = date.split('-');
    const [startM, startD] = startStr.split('/').map(Number);
    const [endM, endD] = (endStr || startStr).split('/').map(Number);

    // 构造当年的起止日期进行比较
    const start = new Date(now.getFullYear(), startM - 1, startD);
    const end = new Date(now.getFullYear(), endM - 1, endD);
    // 处理跨年情况（如 end < start）
    if (end < start) {
      end.setFullYear(end.getFullYear() + 1);
    }
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (current >= start && current <= end) {
      text = randomSelection(text);
      text = (text as string).replace('{year}', String(now.getFullYear()));
      messageArray.push(text);
    }
  });

  let lastHoverElement: string | undefined;

  // 监听鼠标和键盘活动
  window.addEventListener('mousemove', () => (userAction = true));
  window.addEventListener('keydown', () => (userAction = true));

  // 每秒检测用户是否活跃，空闲 20 秒后开始显示消息
  idleCheckInterval = setInterval(() => {
    if (userAction) {
      userAction = false;
      clearInterval(userActionTimer);
      userActionTimer = null;
    } else if (!userActionTimer) {
      userActionTimer = setInterval(() => {
        showMessage(messageArray, 6000, 9);
      }, 20000);
    }
  }, 1000);

  // 鼠标悬停事件：匹配选择器时显示对应消息
  window.addEventListener('mouseover', (event) => {
    // eslint-disable-next-line prefer-const
    for (let { selector, text } of tips.mouseover) {
      if (!(event.target as HTMLElement)?.closest(selector)) continue;
      if (lastHoverElement === selector) return;
      lastHoverElement = selector;
      text = randomSelection(text);
      text = (text as string).replace(
        '{text}',
        (event.target as HTMLElement).innerText,
      );
      showMessage(text, 4000, 8);
      return;
    }
  });

  // 点击事件：匹配选择器时显示对应消息
  window.addEventListener('click', (event) => {
    // eslint-disable-next-line prefer-const
    for (let { selector, text } of tips.click) {
      if (!(event.target as HTMLElement)?.closest(selector)) continue;
      text = randomSelection(text);
      text = (text as string).replace(
        '{text}',
        (event.target as HTMLElement).innerText,
      );
      showMessage(text, 4000, 8);
      return;
    }
  });

  // Live2D 模型交互事件
  window.addEventListener('live2d:hoverbody', () => {
    const text = randomSelection(tips.message.hoverBody);
    showMessage(text, 4000, 8, false);  // 不覆盖当前消息
  });
  window.addEventListener('live2d:tapbody', () => {
    const text = randomSelection(tips.message.tapBody);
    showMessage(text, 4000, 9);
  });

  // 控制台检测：打开 DevTools 时显示消息
  const devtools = () => {};
  console.log('%c', devtools);
  devtools.toString = () => {
    showMessage(tips.message.console, 6000, 9);
  };

  // 复制检测：复制页面内容时显示消息
  window.addEventListener('copy', () => {
    showMessage(tips.message.copy, 6000, 9);
  });

  // 页面可见性检测：从后台切回时显示消息
  window.addEventListener('visibilitychange', () => {
    if (!document.hidden)
      showMessage(tips.message.visibilitychange, 6000, 9);
  });
}

/**
 * 加载看板娘小部件
 * 创建 DOM 结构、加载配置、初始化模型和工具栏
 * @param config - 用户配置
 */
async function loadWidget(config: ModelConfig) {
  // 清除之前的显示状态
  localStorage.removeItem('waifu-display');
  sessionStorage.removeItem('waifu-message-priority');

  // 防止重复创建 DOM 元素
  if (!document.getElementById('waifu')) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="waifu">
         <div id="waifu-canvas">
           <canvas id="live2d" width="800" height="800"></canvas>
           <div id="waifu-head"></div>
         </div>
         <div id="waifu-tips"></div>
         <div id="waifu-tool"></div>
       </div>`,
    );
  }

  // 自动检测可用空间，决定模型和工具栏的位置
  positionWidget();

  // 注册全局回调
  (window as any).__repositionTips = positionTips;
  (window as any).__stopIdleCheck = stopIdleCheck;
  (window as any).__clampToScreen = clampToScreen;
  (window as any).__applyAutoScale = applyAutoScale;

  // 根据网页大小设置默认画布尺寸（用户未手动设置时生效）
  applyAutoScale();

  // 延迟初始定位，等 DOM 渲染完成
  requestAnimationFrame(() => positionTips());

  // 监听窗口和画布尺寸变化，实时刷新位置
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      // 自动模式下：跟随视口调整默认画布大小（含气泡/工具栏缩放）
      applyAutoScale();
      clampToScreen();
      positionWidget();
      requestAnimationFrame(() => positionTips());
    });
    resizeObserver.observe(document.body);
    // 画布尺寸变化时也刷新（缩放触发）
    const canvas = document.getElementById('waifu-canvas');
    if (canvas) resizeObserver.observe(canvas);
  }

  let models: ModelListItem[] = [];
  let tips: Tips | null;

  // 加载配置：优先使用传入的配置，否则从 URL 获取
  const tipsData = (config as any)._tipsOverride;
  if (tipsData) {
    tips = tipsData;
    models = tips.models;
  } else if (config.waifuPath) {
    try {
      const response = await fetch(config.waifuPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      tips = await response.json();
      models = tips.models;
    } catch (err) {
      logger.error('Failed to load waifu-tips config:', err);
      return;
    }
  }

  // 注册事件监听和显示欢迎消息
  if (tips) {
    registerEventListener(tips);
    showMessage(welcomeMessage(tips.time, tips.message.welcome, tips.message.referrerTemplates), 7000, 11);
  }

  // 初始化模型管理器并加载模型
  let model: ModelManager;
  try {
    model = await ModelManager.initCheck(config, models);
    await model.loadModel('');
  } catch (err) {
    logger.error('Failed to initialize model:', err);
    return;
  }

  // 初始化工具栏
  new ToolsManager(model, config, tips!).registerTools();

  // 启用拖拽功能
  if (config.drag) registerDrag();

  // 显示看板娘
  document.getElementById('waifu')?.classList.add('waifu-active');

  // 初始化位置和气泡
  requestAnimationFrame(() => {
    clampToScreen();
    positionTips();
  });

  // 恢复拖拽模式状态
  if (localStorage.getItem('waifu-drag') === '1') {
    const waifu = document.getElementById('waifu');
    if (waifu) {
      waifu.classList.add('waifu-drag-active');
      waifu.style.cursor = 'grab';
    }
  }
}

/**
 * 初始化看板娘小部件（入口函数）
 * 检查配置、创建切换按钮、决定是否立即加载
 * @param config - 配置对象（不支持旧版字符串路径）
 */
function initWidget(config: string | ModelConfig) {
  // 兼容旧版配置格式
  if (typeof config === 'string') {
    logger.error('Your config for Live2D initWidget is outdated. Please refer to https://github.com/Nh12356-git/live2d-widget/blob/master/dist/autoload.js');
    return;
  }

  // 设置日志级别
  logger.setLevel(config.logLevel);

  // 创建切换按钮（用于显示/隐藏看板娘）
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="waifu-toggle">
       ${fa_child}
     </div>`,
  );

  // 用 JS 变量跟踪是否首次点击，避免依赖 HTML 属性
  let isFirstClick = false;

  // 切换按钮点击事件
  const toggle = document.getElementById('waifu-toggle');
  toggle?.addEventListener('click', () => {
    toggle?.classList.remove('waifu-toggle-active');
    if (isFirstClick) {
      // 首次点击：加载看板娘
      loadWidget(config as ModelConfig);
      isFirstClick = false;
    } else {
      // 非首次点击：显示已隐藏的看板娘
      localStorage.removeItem('waifu-display');
      document.getElementById('waifu')?.classList.remove('waifu-hidden');
      setTimeout(() => {
        document.getElementById('waifu')?.classList.add('waifu-active');
      }, 0);
    }
  });

  // 检查 24 小时内是否退出过，如果是则隐藏看板娘
  if (
    localStorage.getItem('waifu-display') &&
    Date.now() - Number(localStorage.getItem('waifu-display')) <= 86400000
  ) {
    // 24 小时内退出过，显示切换按钮
    isFirstClick = true;
    setTimeout(() => {
      toggle?.classList.add('waifu-toggle-active');
    }, 0);
  } else {
    // 未退出过或已过 24 小时，直接加载
    loadWidget(config as ModelConfig);
  }
}

/** 停止空闲检测（退出看板娘时调用） */
function stopIdleCheck() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval);
    idleCheckInterval = null;
  }
}

export { initWidget, Tips };
