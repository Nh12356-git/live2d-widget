/* global document, window, Event, setTimeout, clearTimeout */

/**
 * @file Cubism 5 集成模块，封装 Live2D 渲染逻辑
 * @module cubism5/index
 */

import { LAppDelegate } from '@demo/lappdelegate.js';
import { LAppSubdelegate } from '@demo/lappsubdelegate.js';
import * as LAppDefine from '@demo/lappdefine.js';
import { LAppModel } from '@demo/lappmodel.js';
import { LAppPal } from '@demo/lapppal';
import logger from '../logger.js';

// 禁用 Cubism SDK 的控制台输出
LAppPal.printMessage = () => {};

/**
 * 自定义子委托类
 * 负责 Canvas 相关的初始化和渲染管理
 */
class AppSubdelegate extends LAppSubdelegate {
  /**
   * 初始化应用所需的资源
   * @param {HTMLCanvasElement} canvas - Canvas 元素
   * @returns {boolean} 初始化是否成功
   */
  initialize(canvas) {
    // 初始化 WebGL 管理器
    if (!this._glManager.initialize(canvas)) {
      return false;
    }

    this._canvas = canvas;

    // 设置 Canvas 尺寸：自动适应或指定大小
    if (LAppDefine.CanvasSize === 'auto') {
      this.resizeCanvas();
    } else {
      canvas.width = LAppDefine.CanvasSize.width;
      canvas.height = LAppDefine.CanvasSize.height;
    }

    // 设置纹理管理器的 GL 管理器
    this._textureManager.setGlManager(this._glManager);

    const gl = this._glManager.getGl();

    // 获取当前帧缓冲绑定（如果未初始化）
    if (!this._frameBuffer) {
      this._frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    }

    // 启用混合模式（支持透明度）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 初始化视图
    this._view.initialize(this);
    // 禁用默认的 gear 和 back 渲染（不需要背景和齿轮）
    this._view._gear = {
      render: () => {},
      isHit: () => {},
      release: () => {}
    };
    this._view._back = {
      render: () => {},
      release: () => {}
    };

    // 关联 Live2D 管理器
    this._live2dManager._subdelegate = this;

    // 监听 Canvas 尺寸变化（响应式适配）
    this._resizeObserver = new window.ResizeObserver(
      (entries, observer) =>
        this.resizeObserverCallback.call(this, entries, observer)
    );
    this._resizeObserver.observe(this._canvas);

    return true;
  }

  /**
   * Canvas 尺寸变化时重新初始化视图
   */
  onResize() {
    this.resizeCanvas();
    this._view.initialize(this);
  }

  /**
   * 主渲染循环，每帧调用更新画面
   */
  update() {
    // 检查 WebGL 上下文是否丢失
    if (this._glManager.getGl().isContextLost()) {
      return;
    }

    // 需要调整尺寸时执行
    if (this._needResize) {
      this.onResize();
      this._needResize = false;
    }

    const gl = this._glManager.getGl();

    // 设置清除颜色为全透明
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 启用深度测试（确保模型正确遮挡）
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // 清除颜色和深度缓冲
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearDepth(1.0);

    // 重新启用混合模式
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 渲染视图内容
    this._view.render();
  }
}

/**
 * 主应用委托类
 * 负责管理主循环、Canvas、模型切换和全局逻辑
 */
export class AppDelegate extends LAppDelegate {
  /** hoverbody 事件防抖：上次触发时间 */
  _lastHoverTime = 0;

  /** 模型相对画布渲染偏移（CSS 像素）：x 负=左移，y 正=下移 */
  _modelOffsetX = -20;
  _modelOffsetY = 30;

  constructor() {
    super();
    // 注入模型渲染偏移，供渲染层（LAppModel.doDraw）读取
    window.__live2dModelOffset = {
      x: this._modelOffsetX,
      y: this._modelOffsetY
    };
  }

  // ====== 拖拽平滑相关 ======
  /** 目标位置（鼠标移动时更新） */
  _targetX = 0;
  _targetY = 0;
  /** 当前插值位置 */
  _currentX = 0;
  _currentY = 0;
  /** 是否正在拖拽（鼠标按下移动中） */
  _isDragging = false;
  /** 鼠标静止定时器 */
  _idleTimer = null;

  /**
   * 启动主渲染循环
   * 每帧执行拖拽插值 + 模型更新
   */
  run() {
    // 防止重复创建动画循环
    if (this._drawFrameId) {
      return;
    }
    const loop = () => {
      LAppPal.updateTime();

      // 拖拽平滑插值：每帧向目标位置靠近
      const lerpFactor = 0.15;  // 插值系数，越大跟随越快
      this._currentX += (this._targetX - this._currentX) * lerpFactor;
      this._currentY += (this._targetY - this._currentY) * lerpFactor;

      // 到达目标附近时直接对齐，避免永远在小数点附近抖动
      if (Math.abs(this._targetX - this._currentX) < 0.001) this._currentX = this._targetX;
      if (Math.abs(this._targetY - this._currentY) < 0.001) this._currentY = this._targetY;

      // 将平滑后的位置传递给模型
      const manager = this._subdelegates?.[0]?.getLive2DManager();
      manager?.onDrag(this._currentX, this._currentY);

      // 渲染
      for (let i = 0; i < this._subdelegates.length; i++) {
        this._subdelegates[i].update();
      }

      this._drawFrameId = window.requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * 停止渲染循环
   */
  stop() {
    if (this._drawFrameId) {
      window.cancelAnimationFrame(this._drawFrameId);
      this._drawFrameId = null;
    }
  }

  /**
   * 释放所有资源
   */
  release() {
    this.stop();
    this.releaseEventListener();
    this._subdelegates = [];
    this._cubismOption = null;
  }

  /**
   * 将页面坐标转换为 Live2D 视图坐标
   * @param {MouseEvent} e - 鼠标/指针事件
   * @returns {{x: number, y: number}} 转换后的坐标
   */
  transformOffset(e) {
    const subdelegate = this._subdelegates[0];
    const rect = subdelegate.getCanvas().getBoundingClientRect();
    // clientX/clientY 是视口坐标，与 getBoundingClientRect 一致
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const posX = localX * window.devicePixelRatio;
    const posY = localY * window.devicePixelRatio;
    const x = subdelegate._view.transformViewX(posX);
    const y = subdelegate._view.transformViewY(posY);
    return { x, y };
  }

  /**
   * 鼠标/触摸移动事件处理
   * 更新拖拽目标位置 + 悬停检测
   */
  onMouseMove(e) {
    if (!this._subdelegates?.[0]) return;
    const lapplive2dmanager = this._subdelegates[0].getLive2DManager();
    const { x, y } = this.transformOffset(e);
    const model = lapplive2dmanager?._models?.[0];

    // 只更新目标位置，由 render loop 平滑插值
    this._targetX = x;
    this._targetY = y;

    // 检测是否悬停在模型像素上（防抖：2秒内不重复触发）
    const now = Date.now();
    if (now - this._lastHoverTime > 2000) {
      let isHovering = false;

      if (model && model._modelSetting && model._modelSetting.getHitAreasCount() > 0) {
        try {
          isHovering = model.hitTest(LAppDefine.HitAreaNameBody, x, y);
        } catch {
          // ignore
        }
      }

      if (!isHovering) {
        isHovering = this.isHitModel(e);
      }

      if (isHovering) {
        this._lastHoverTime = now;
        window.dispatchEvent(new Event('live2d:hoverbody'));
      }
    }

    // 重置空闲计时器
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
    }
    this._idleTimer = setTimeout(() => {
      // 鼠标静止，回归默认姿势
      this._targetX = 0;
      this._targetY = 0;
    }, 1000);
  }

  /**
   * 鼠标离开事件处理
   * 回归默认姿势 + 触发点击
   */
  onMouseEnd(e) {
    if (!this._subdelegates?.[0]) return;

    // 回归默认姿势
    this._targetX = 0;
    this._targetY = 0;

    // 使用自定义 onTap（带空值检查），不调用 SDK 的 onTap
    this.onTap(e);
  }

  /**
   * 检测点击位置是否有模型像素（alpha > 0）
   * 通过读取 WebGL canvas 的像素数据判断是否触碰到模型
   */
  isHitModel(e) {
    const subdelegate = this._subdelegates?.[0];
    if (!subdelegate) return false;
    const canvas = subdelegate.getCanvas();
    const gl = subdelegate._glManager?.getGl();
    if (!canvas || !gl) return false;

    // 将页面坐标转换为 canvas 内部像素坐标
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // 读取该位置的像素数据（需要先渲染一帧确保缓冲区有效）
    const pixel = new Uint8Array(4);
    gl.readPixels(
      Math.floor(x),
      canvas.height - Math.floor(y) - 1,  // WebGL y 轴翻转
      1, 1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel
    );

    // alpha > 0 说明该位置有模型像素
    return pixel[3] > 0;
  }

  /**
   * 点击/触摸事件处理
   * 检测是否点击模型身体区域
   */
  onTap(e) {
    if (!this._subdelegates?.[0]) return;

    // 检测是否点击在模型像素上
    let isTapping = false;

    // 优先使用 hitTest（如果模型定义了 HitAreas）
    const lapplive2dmanager = this._subdelegates[0].getLive2DManager();
    const model = lapplive2dmanager?._models?.[0];
    if (model && model._modelSetting && model._modelSetting.getHitAreasCount() > 0) {
      try {
        const { x, y } = this.transformOffset(e);
        isTapping = model.hitTest(LAppDefine.HitAreaNameBody, x, y);
      } catch {
        // ignore
      }
    }

    // 回退：读取 WebGL 像素判断是否触碰到模型
    if (!isTapping) {
      isTapping = this.isHitModel(e);
    }

    if (isTapping) {
      window.dispatchEvent(new Event('live2d:tapbody'));
    }
  }

  /**
   * 注册鼠标和触摸事件监听器
   */
  initializeEventListener() {
    this.mouseMoveEventListener = this.onMouseMove.bind(this);
    this.mouseEndedEventListener = this.onMouseEnd.bind(this);
    this.tapEventListener = this.onTap.bind(this);

    // 表情切换事件（支持指定表情名或随机）
    this.expressionListener = (e) => {
      const manager = this._subdelegates?.[0]?.getLive2DManager();
      const model = manager?._models?.[0];
      if (!model || !model._modelSetting) return;
      const count = model._modelSetting.getExpressionCount();
      if (count <= 0) return;

      const name = e.detail?.name;
      if (name) {
        model.setExpression(name);
      } else {
        model.setRandomExpression();
      }
    };
    window.addEventListener('live2d:expression', this.expressionListener);

    // 鼠标离开事件
    document.addEventListener('mouseout', this.mouseEndedEventListener, {
      passive: true
    });

    // 指针事件（同时覆盖鼠标和触摸）
    document.addEventListener('pointerdown', this.tapEventListener, {
      passive: true
    });
    document.addEventListener('pointermove', this.mouseMoveEventListener, {
      passive: true
    });
  }

  /**
   * 移除鼠标和触摸事件监听器
   */
  releaseEventListener() {
    window.removeEventListener('live2d:expression', this.expressionListener);
    document.removeEventListener('mouseout', this.mouseEndedEventListener, {
      passive: true
    });
    document.removeEventListener('pointerdown', this.tapEventListener, {
      passive: true
    });
    document.removeEventListener('pointermove', this.mouseMoveEventListener, {
      passive: true
    });
    this.mouseMoveEventListener = null;
    this.mouseEndedEventListener = null;
    this.tapEventListener = null;
  }

  /**
   * 创建 Canvas 并初始化所有子委托
   */
  initializeSubdelegates() {
    const canvas = document.getElementById('live2d');
    this._canvases = [canvas];

    // 设置 Canvas CSS 尺寸（不覆盖 CSS 响应式规则）
    // canvas.style.width 和 style.height 已在 CSS 中定义

    // 初始化每个子委托
    for (let i = 0; i < this._canvases.length; i++) {
      const subdelegate = new AppSubdelegate();
      const result = subdelegate.initialize(this._canvases[i]);
      if (!result) {
        logger.error('Failed to initialize AppSubdelegate');
        return;
      }
      this._subdelegates.push(subdelegate);
    }

    // 检查 WebGL 上下文是否丢失
    for (let i = 0; i < this._subdelegates.length; i++) {
      if (this._subdelegates[i].isContextLost()) {
        logger.error(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`
        );
      }
    }
  }

  /**
   * 切换模型
   * @param {string} modelSettingPath - 模型配置文件路径（.model3.json）
   */
  changeModel(modelSettingPath) {
    // 解析路径获取模型目录和文件名
    const segments = modelSettingPath.split('/');
    const modelJsonName = segments.pop();
    const modelPath = segments.join('/') + '/';

    // 获取 Live2D 管理器
    const live2dManager = this._subdelegates[0].getLive2DManager();

    // 释放旧模型
    live2dManager.releaseAllModel();

    // 创建新模型实例并加载资源
    const instance = new LAppModel();
    instance.setSubdelegate(live2dManager._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);

    // 将新模型添加到模型列表
    live2dManager._models.push(instance);
  }

  /** 获取子委托列表 */
  get subdelegates() {
    return this._subdelegates;
  }
}
