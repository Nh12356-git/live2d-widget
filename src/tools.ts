/**
 * @file 工具栏配置和功能函数
 * @module tools
 */

import {
  fa_comment,        // 一言图标
  fa_paper_plane,    // 小行星游戏图标
  fa_street_view,    // 切换模型图标
  fa_shirt,          // 切换贴图图标
  fa_camera_retro,   // 截图图标
  fa_info_circle,    // 信息图标
  fa_xmark,          // 退出图标
  fa_pan,            // 平移图标
  fa_home,           // 首页图标
  fa_settings        // 设置图标
} from './icons.js';
import { showMessage, i18n, escapeHtml } from './message.js';
import { computeAutoScale } from './utils.js';
import type { ModelConfig, ModelManager } from './model.js';
import type { Tips } from './widget.js';

/**
 * 工具接口定义
 * 每个工具包含图标和点击回调函数
 */
interface Tools {
  [key: string]: {
    icon: string;                        // SVG 图标字符串
    callback: (message: any) => void;    // 点击回调函数
  };
}

/**
 * 一言 API 配置
 * 支持 hitokoto.cn 和 jinrishici.com 两个数据源
 */
const hitokotoApis: Record<string, (template: string) => Promise<void>> = {
  /**
   * hitokoto.cn API
   * 获取随机一言，显示内容后显示来源信息
   */
  async hitokoto(template) {
    const response = await fetch('https://v1.hitokoto.cn');
    const result = await response.json();
    const text = i18n(template, result.from, result.creator);
    showMessage(escapeHtml(result.hitokoto), 6000, 9);
    setTimeout(() => showMessage(text, 4000, 9), 6000);
  },

  /**
   * jinrishici.com API
   * 获取随机古诗词，显示内容后显示出处信息
   */
  async jinrishici(template) {
    const response = await fetch('https://v2.jinrishici.com/one.json');
    const result = await response.json();
    const { title, dynasty, author } = result.data.origin;
    const text = i18n(template, title, `${dynasty} · ${author}`);
    showMessage(escapeHtml(result.data.content), 6000, 9);
    setTimeout(() => showMessage(text, 4000, 9), 6000);
  },
};

/**
 * 工具栏管理器
 * 负责初始化工具按钮和绑定事件
 */
class ToolsManager {
  tools: Tools;
  config: ModelConfig;
  private model: ModelManager;
  private tips: Tips;

  /**
   * 构造函数
   * @param model - 模型管理器实例
   * @param config - 用户配置
   * @param tips - 提示消息配置
   */
  constructor(model: ModelManager, config: ModelConfig, tips: Tips) {
    this.config = config;
    this.model = model;
    this.tips = tips;
    this.tools = {
      // 首页工具：返回首页
      home: {
        icon: fa_home,
        callback: () => {
          window.location.href = '/';
        }
      },

      // 一言工具：获取随机句子
      hitokoto: {
        icon: fa_comment,
        callback: async () => {
          // 根据配置选择 API 数据源
          const apiName = (config as any).hitokotoApi || 'hitokoto';
          const apiFn = hitokotoApis[apiName] || hitokotoApis.hitokoto;
          const template = tips.message.hitokoto;
          await apiFn(template);
        }
      },

      // 小行星游戏工具：加载并启动 Asteroids 小游戏
      asteroids: {
        icon: fa_paper_plane,
        callback: () => {
          if (window.Asteroids) {
            // 游戏已加载，直接创建新实例
            if (!window.ASTEROIDSPLAYERS) window.ASTEROIDSPLAYERS = [];
            window.ASTEROIDSPLAYERS.push(new window.Asteroids());
          } else {
            // 首次使用，动态加载本地游戏脚本
            const script = document.createElement('script');
            script.src = '../dist/asteroids.js';
            document.head.appendChild(script);
          }
        }
      },

      // 截图工具：与 Ctrl+Shift+S 效果相同
      photo: {
        icon: fa_camera_retro,
        callback: async () => {
          try {
            // 请求屏幕共享（用户选择屏幕/窗口/标签页）
            const stream = await navigator.mediaDevices.getDisplayMedia({
              video: true as any,
            });

            // 用 video 元素捕获帧
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // 等待视频就绪
            await new Promise<void>((resolve) => {
              if (video.readyState >= 2) resolve();
              else video.onloadeddata = () => resolve();
            });

            // 绘制到 canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0);

            // 停止屏幕共享
            stream.getTracks().forEach(t => t.stop());

            // 复制到剪贴板
            canvas.toBlob(async (blob) => {
              if (!blob) return;
              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
                ]);
                showMessage('截图已复制到剪贴板', 3000, 9);
              } catch {
                // 剪贴板权限失败，回退为下载
                const link = document.createElement('a');
                link.download = 'live2d-screenshot.png';
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 100);
                showMessage('截图已下载', 3000, 9);
              }
            }, 'image/png');
          } catch (err) {
            if ((err as Error).name !== 'AbortError') {
              showMessage('截图取消或失败', 4000, 9);
            }
          }
        }
      },

      // 信息工具：打开项目 GitHub 页面
      info: {
        icon: fa_info_circle,
        callback: () => {
          open('https://github.com/Nh12356-git/live2d-widget');
        }
      },

      // 设置工具：弹出设置面板
      settings: {
        icon: fa_settings,
        callback: (e: Event) => {
          const panel = document.getElementById('waifu-settings');
          if (!panel) return;

          // 切换显示
          const isActive = panel.classList.contains('waifu-settings-active');
          panel.classList.toggle('waifu-settings-active');

          // 点击外部关闭
          if (!isActive) {
            const close = (ev: Event) => {
              if (!panel.contains(ev.target as Node) && ev.target !== e.target) {
                panel.classList.remove('waifu-settings-active');
                document.removeEventListener('click', close);
              }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
          }
        }
      },

      // 退出工具：隐藏看板娘并记录退出时间
      quit: {
        icon: fa_xmark,
        callback: () => {
          // 停止空闲检测定时器
          if (typeof (window as any).__stopIdleCheck === 'function') {
            (window as any).__stopIdleCheck();
          }
          // 记录退出时间，24小时内不再自动显示
          localStorage.setItem('waifu-display', Date.now().toString());
          const message = tips.message.goodbye;
          showMessage(message, 2000, 11);

          const waifu = document.getElementById('waifu');
          if (!waifu) return;

          // 移除激活状态，3秒后完全隐藏并显示切换按钮
          waifu.classList.remove('waifu-active');
          setTimeout(() => {
            waifu.classList.add('waifu-hidden');
            const waifuToggle = document.getElementById('waifu-toggle');
            waifuToggle?.classList.add('waifu-toggle-active');
          }, 3000);
        }
      }
    };
  }

  /**
   * 注册工具按钮到 DOM
   * 根据配置创建工具按钮并绑定点击事件
   */
  registerTools() {
    // 如果未配置工具列表，默认显示所有工具
    if (!Array.isArray(this.config.tools)) {
      this.config.tools = Object.keys(this.tools);
    }

    // 创建设置面板
    this.createSettingsPanel();

    // 遍历配置的工具列表，创建对应的按钮元素
    for (const toolName of this.config.tools) {
      if (this.tools[toolName]) {
        const { icon, callback } = this.tools[toolName];

        // 创建工具按钮元素
        const element = document.createElement('span');
        element.id = `waifu-tool-${toolName}`;
        element.innerHTML = icon;

        // 添加到工具栏容器
        document
          .getElementById('waifu-tool')
          ?.insertAdjacentElement(
            'beforeend',
            element,
          );

        // 绑定点击事件
        element.addEventListener('click', callback);
      }
    }
  }

  /**
   * 创建设置面板
   * 包含切换模型、换装、信息等功能
   */
  private createSettingsPanel() {
    const waifuTool = document.getElementById('waifu-tool');
    if (!waifuTool) return;

    // 创建设置面板容器
    const panel = document.createElement('div');
    panel.id = 'waifu-settings';

    // 设置项配置
    const items = [
      {
        icon: fa_street_view,
        text: '切换模型',
        callback: () => this.model.loadNextModel()
      },
      {
        icon: fa_shirt,
        text: '换装',
        callback: () => {
          let successMessage = '', failMessage = '';
          if (this.tips) {
            successMessage = this.tips.message.changeSuccess;
            failMessage = this.tips.message.changeFail;
          }
          this.model.loadRandTexture(successMessage, failMessage);
        }
      },
      {
        icon: fa_info_circle,
        text: '关于',
        callback: () => {
          open('https://github.com/Nh12356-git/live2d-widget');
        }
      },
      {
        icon: fa_pan,
        text: '拖拽模型',
        callback: () => {
          const waifu = document.getElementById('waifu');
          if (!waifu) return;
          waifu.classList.toggle('waifu-drag-active');
          const isActive = waifu.classList.contains('waifu-drag-active');
          waifu.style.cursor = isActive ? 'grab' : '';
          localStorage.setItem('waifu-drag', isActive ? '1' : '0');
          showMessage(
            isActive
              ? '已启用拖拽模式<br>长按模型头部区域可拖动位置'
              : '已关闭拖拽模式',
            3000, 9
          );
        }
      }
    ];

    // 创建设置项
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'waifu-settings-item';
      div.innerHTML = item.icon + `<span>${item.text}</span>`;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        item.callback();
        panel.classList.remove('waifu-settings-active');
      });
      panel.appendChild(div);
    }

    // 模型大小输入
    const sizeDiv = document.createElement('div');
    sizeDiv.className = 'waifu-settings-item';
    sizeDiv.style.cursor = 'default';

    // 用户手动调整过大小则使用手动值，否则默认大小根据网页视口自动计算
    const isManual = localStorage.getItem('waifu-scale-manual') !== null;
    const savedScale = isManual
      ? parseFloat(localStorage.getItem('waifu-scale') || '1.5')
      : computeAutoScale();
    sizeDiv.innerHTML = fa_settings + '<span>大小</span>';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0.5';
    input.max = '5';
    input.step = '0.1';
    input.value = String(parseFloat(savedScale.toFixed(1)));
    input.style.cssText = 'width: 50px; margin-left: 4px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 13px;';

    const applyScale = (scale: number) => {
      const canvas = document.getElementById('live2d');
      const canvasContainer = document.getElementById('waifu-canvas');
      const tips = document.getElementById('waifu-tips');
      if (!canvas) return;

      // 直接修改 canvas CSS 尺寸（而非 transform），触发 ResizeObserver 更新 buffer
      const baseW = 165;
      const baseH = 240;
      const w = baseW * scale;
      const h = baseH * scale;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // 同步更新容器尺寸，让工具栏和气泡的定位跟随缩放
      if (canvasContainer) {
        canvasContainer.style.width = `${w}px`;
        canvasContainer.style.height = `${h}px`;
      }

      // 气泡大小随模型缩放：通过 CSS 变量 --ws 驱动基础尺寸（宽度/字号/内边距等）
      if (tips) {
        tips.style.setProperty('--ws', String(scale));
      }

      // 工具栏跟随模型缩放，范围 0.4 ~ 1.0
      const tool = document.getElementById('waifu-tool');
      if (tool) {
        const toolScale = Math.max(0.4, Math.min(1.0, scale));
        tool.style.transform = `scale(${toolScale})`;
        tool.style.transformOrigin = 'bottom left';
      }

      localStorage.setItem('waifu-scale', scale.toFixed(1));

      // 重新定位气泡和约束屏幕范围
      if (typeof (window as any).__repositionTips === 'function') {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            (window as any).__repositionTips();
            if (typeof (window as any).__clampToScreen === 'function') {
              (window as any).__clampToScreen();
            }
          });
        });
      }
    };

    applyScale(savedScale);

    // 输入时在气泡提示当前倍数
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val) && val >= 0.5 && val <= 5) {
        // 用户主动调整大小，标记为手动模式（此后不再自动适配）
        localStorage.setItem('waifu-scale-manual', '1');
        applyScale(val);
        showMessage(`模型大小: ${val.toFixed(1)}x`, 1500, 5, false);
      }
    });

    // 确认时提示
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      let val = parseFloat((e.target as HTMLInputElement).value);
      if (isNaN(val)) val = 1;
      val = Math.max(0.5, Math.min(5, val));
      (e.target as HTMLInputElement).value = String(val);
      // 用户主动调整大小，标记为手动模式（此后不再自动适配）
      localStorage.setItem('waifu-scale-manual', '1');
      applyScale(val);
      showMessage(`模型大小已设为 ${val.toFixed(1)}x`, 2000, 9);
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    sizeDiv.appendChild(input);
    panel.appendChild(sizeDiv);

    // 将设置面板插入到工具栏前面
    waifuTool.parentNode?.insertBefore(panel, waifuTool);
  }
}

export { ToolsManager, Tools };
