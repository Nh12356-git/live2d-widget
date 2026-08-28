/**
 * @file 模型管理器，负责 Cubism 5 模型的加载和切换
 * @module model
 */

import { showMessage } from './message.js';
import { loadExternalResource, randomOtherOption } from './utils.js';
import type { AppDelegate as Cubism5Model } from './cubism5/index.js';
import logger, { LogLevel } from './logger.js';

/**
 * 模型列表项接口
 */
interface ModelListItem {
  name: string;      // 模型名称
  paths: string[];   // 模型配置文件路径数组（支持多套贴图）
  message: string;   // 模型加载完成时显示的消息
}

/**
 * 用户配置接口
 */
interface ModelConfig {
  waifuPath: string;         // waifu-tips.json 路径
  cubism5Path?: string;      // Cubism 5 Core 路径
  modelId?: number;          // 默认模型索引
  tools?: string[];          // 工具栏配置
  hitokotoApi?: string;      // 一言 API 数据源
  drag?: boolean;            // 是否启用拖拽
  logLevel?: LogLevel;       // 日志级别
}

/**
 * 模型管理器类
 * 管理模型加载、切换、贴图更换等功能
 */
class ModelManager {
  /** Cubism 5 Core 路径 */
  private readonly cubism5Path: string;
  /** 当前模型索引 */
  private _modelId: number;
  /** 当前贴图索引 */
  private _modelTexturesId: number;
  /** Cubism 5 模型实例 */
  private cubism5model: Cubism5Model | undefined;
  /** 加载状态锁 */
  private loading: boolean;
  /** 模型 JSON 配置缓存 */
  private modelJSONCache: Record<string, any>;
  /** 模型列表 */
  private models: ModelListItem[];

  /**
   * 私有构造函数（通过 initCheck 创建实例）
   * @param config - 用户配置
   * @param models - 模型列表
   */
  private constructor(config: ModelConfig, models: ModelListItem[]) {
    const { cubism5Path } = config;

    // 从 localStorage 恢复上次选择的模型和贴图
    let modelId = parseInt(localStorage.getItem('modelId') as string, 10);
    let modelTexturesId = parseInt(localStorage.getItem('modelTexturesId') as string, 10);
    if (isNaN(modelId) || isNaN(modelTexturesId)) {
      modelTexturesId = 0;
    }
    if (isNaN(modelId)) {
      modelId = config.modelId ?? 0;
    }

    this.cubism5Path = cubism5Path || '';
    this._modelId = modelId;
    this._modelTexturesId = modelTexturesId;
    this.loading = false;
    this.modelJSONCache = {};
    this.models = models;
  }

  /**
   * 初始化并验证模型管理器
   * @param config - 用户配置
   * @param models - 模型列表
   * @returns 验证通过的模型管理器实例
   */
  static async initCheck(config: ModelConfig, models: ModelListItem[]) {
    if (!models.length) {
      throw new Error('No models provided!');
    }
    const manager = new ModelManager(config, models);

    // 验证模型索引有效性
    if (manager._modelId >= manager.models.length) {
      manager._modelId = 0;
    }
    if (manager._modelTexturesId >= manager.models[manager._modelId].paths.length) {
      manager._modelTexturesId = 0;
    }
    return manager;
  }

  /** 设置当前模型索引（同时保存到 localStorage） */
  set modelId(modelId: number) {
    this._modelId = modelId;
    localStorage.setItem('modelId', modelId.toString());
  }

  /** 获取当前模型索引 */
  get modelId() {
    return this._modelId;
  }

  /** 设置当前贴图索引（同时保存到 localStorage） */
  set modelTexturesId(modelTexturesId: number) {
    this._modelTexturesId = modelTexturesId;
    localStorage.setItem('modelTexturesId', modelTexturesId.toString());
  }

  /** 获取当前贴图索引 */
  get modelTexturesId() {
    return this._modelTexturesId;
  }

  /** 重置 canvas 元素（用于重新初始化） */
  resetCanvas() {
    document.getElementById('waifu-canvas').innerHTML =
      '<canvas id="live2d" width="800" height="800"></canvas>';
  }

  /**
   * 带缓存的 JSON 配置获取
   * @param url - 配置文件 URL
   * @returns 解析后的 JSON 对象
   */
  private async fetchWithCache(url: string) {
    let result;
    if (url in this.modelJSONCache) {
      result = this.modelJSONCache[url];
    } else {
      try {
        const response = await fetch(url);
        result = await response.json();
      } catch {
        result = null;
      }
      this.modelJSONCache[url] = result;
    }
    return result;
  }

  /**
   * 加载 Cubism 5 模型
   * @param modelSettingPath - 模型配置文件路径（.model3.json）
   */
  private async loadLive2D(modelSettingPath: string) {
    // 加载锁：防止重复加载
    if (this.loading) {
      logger.warn('Still loading. Abort.');
      return;
    }
    this.loading = true;

    try {
      // 加载 Cubism 5 Core
      if (!this.cubism5Path) {
        logger.error('No cubism5Path set, cannot load Cubism 5 Core.');
        return;
      }
      await loadExternalResource(this.cubism5Path, 'js');

      // 动态导入 Cubism 5 模块
      const { AppDelegate: Cubism5Model } = await import('./cubism5/index.js');

      // 复用已有实例，避免重复创建导致渲染循环泄漏
      if (!this.cubism5model) {
        this.cubism5model = new (Cubism5Model as any)();
        this.cubism5model.initialize();
        this.cubism5model.changeModel(modelSettingPath);
        this.cubism5model.run();
      } else {
        // 已初始化：直接切换模型
        this.cubism5model.changeModel(modelSettingPath);
      }
      logger.info(`Model ${modelSettingPath} (Cubism 5) loaded`);
    } catch (err) {
      logger.error('loadLive2D failed', err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * 加载当前模型
   * @param message - 加载完成后显示的消息
   */
  async loadModel(message: string | string[]) {
    const modelSettingPath = this.models[this.modelId].paths[this.modelTexturesId];
    await this.loadLive2D(modelSettingPath);
    showMessage(message, 4000, 10);
  }

  /**
   * 随机切换贴图
   * @param successMessage - 切换成功消息
   * @param failMessage - 切换失败消息（只有一套贴图时）
   */
  async loadRandTexture(successMessage: string | string[] = '', failMessage: string | string[] = '') {
    if (this.models[this.modelId].paths.length === 1) {
      // 只有一套贴图，无法切换
      showMessage(failMessage, 4000, 10);
    } else {
      // 随机选择另一套贴图
      this.modelTexturesId = randomOtherOption(
        this.models[this.modelId].paths.length,
        this.modelTexturesId
      );
      await this.loadModel(successMessage);
    }
  }

  /**
   * 切换到下一个模型
   * 循环遍历模型列表，贴图索引重置为 0
   */
  async loadNextModel() {
    this.modelTexturesId = 0;
    this.modelId = (this.modelId + 1) % this.models.length;
    await this.loadModel(this.models[this.modelId].message);
  }
}

export { ModelManager, ModelConfig, ModelListItem };
