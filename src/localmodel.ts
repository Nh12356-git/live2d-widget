/**
 * @file Local model manager, simplified from model.ts for local-first usage.
 * @module localmodel
 */

import { showMessage } from './message.js';
import { loadExternalResource, randomOtherOption } from './utils.js';
import type { AppDelegate as Cubism5Model } from './cubism5/index.js';
import logger, { LogLevel } from './logger.js';

interface LocalModelList {
  name: string;
  paths: string[];
  message: string;
}

interface LocalConfig {
  waifuPath: string;
  cubism5Path?: string;
  modelId?: number;
  tools?: string[];
  hitokotoApi?: string;
  drag?: boolean;
  logLevel?: LogLevel;
}

class LocalModelManager {
  private readonly cubism5Path: string;
  private _modelId: number;
  private _modelTexturesId: number;
  private cubism5model: Cubism5Model | undefined;
  private loading: boolean;
  private modelJSONCache: Record<string, any>;
  private models: LocalModelList[];

  private constructor(config: LocalConfig, models: LocalModelList[]) {
    const { cubism5Path } = config;
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

  static async initCheck(config: LocalConfig, models: LocalModelList[]) {
    if (!models.length) {
      throw 'No models provided!';
    }
    const manager = new LocalModelManager(config, models);
    if (manager._modelId >= manager.models.length) {
      manager._modelId = 0;
    }
    if (manager._modelTexturesId >= manager.models[manager._modelId].paths.length) {
      manager._modelTexturesId = 0;
    }
    return manager;
  }

  set modelId(modelId: number) {
    this._modelId = modelId;
    localStorage.setItem('modelId', modelId.toString());
  }

  get modelId() {
    return this._modelId;
  }

  set modelTexturesId(modelTexturesId: number) {
    this._modelTexturesId = modelTexturesId;
    localStorage.setItem('modelTexturesId', modelTexturesId.toString());
  }

  get modelTexturesId() {
    return this._modelTexturesId;
  }

  resetCanvas() {
    document.getElementById('waifu-canvas').innerHTML =
      '<canvas id="live2d" width="800" height="800"></canvas>';
  }

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

  private async loadLive2D(modelSettingPath: string) {
    if (this.loading) {
      logger.warn('Still loading. Abort.');
      return;
    }
    this.loading = true;
    try {
      if (!this.cubism5Path) {
        logger.error('No cubism5Path set, cannot load Cubism 5 Core.');
        return;
      }
      await loadExternalResource(this.cubism5Path, 'js');
      const { AppDelegate: Cubism5Model } = await import('./cubism5/index.js');
      const cubism5model = new (Cubism5Model as any)();
      this.cubism5model = cubism5model;
      if (!cubism5model.subdelegates[0]) {
        cubism5model.initialize();
        cubism5model.changeModel(modelSettingPath);
        cubism5model.run();
      } else {
        cubism5model.changeModel(modelSettingPath);
      }
      logger.info(`Model ${modelSettingPath} (Cubism 5) loaded`);
    } catch (err) {
      console.error('loadLive2D failed', err);
    }
    this.loading = false;
  }

  async loadModel(message: string | string[]) {
    const modelSettingPath = this.models[this.modelId].paths[this.modelTexturesId];
    await this.loadLive2D(modelSettingPath);
    showMessage(message, 4000, 10);
  }

  async loadRandTexture(successMessage: string | string[] = '', failMessage: string | string[] = '') {
    if (this.models[this.modelId].paths.length === 1) {
      showMessage(failMessage, 4000, 10);
    } else {
      this.modelTexturesId = randomOtherOption(
        this.models[this.modelId].paths.length,
        this.modelTexturesId
      );
      await this.loadModel(successMessage);
    }
  }

  async loadNextModel() {
    this.modelTexturesId = 0;
    this.modelId = (this.modelId + 1) % this.models.length;
    await this.loadModel(this.models[this.modelId].message);
  }
}

export { LocalModelManager, LocalConfig, LocalModelList };