/*!
 * Live2D Widget - Autoload
 * https://github.com/Nh12356-git/live2d-widget
 *
 * 使用方法：在页面 body 末尾添加以下一行即可
 * <script type="module" src="dist/autoload.js"></script>
 */

// ========== 资源路径配置 ==========
// 修改为你的实际部署路径（相对于 HTML 文件）
const live2d_path = '../dist/';

// 后端 API 地址（模型文件通过 API 代理，不直接暴露）
const live2d_api = '/api';

// ========== 看板娘参数设置 ==========
const live2d_settings = {
  // 模型配置
  modelId: 0,                    // 默认模型 ID
  modelTexturesId: 0,            // 默认材质 ID

  // 工具栏按钮（不需要的可以删除）
  tools: [
    'home',            // 首页
    'hitokoto',        // 一言
    'asteroids',       // 小行星游戏
    'photo',           // 截图
    'settings',        // 设置（包含切换模型、换装、关于、拖拽）
    'quit'             // 关闭
  ],

  // 功能开关
  hitokotoApi: 'hitokoto',       // 一言 API：'hitokoto' 或 'jinrishici'
  logLevel: 'warn',              // 日志级别：'error', 'warn', 'info', 'trace'
  drag: true,                    // 是否允许拖拽
};

// ========== 内部实现 ==========
(function () {
  'use strict';

  // 加载外部资源（CSS 或 JS）
  function loadResource(url, type) {
    return new Promise(function (resolve, reject) {
      var tag;
      if (type === 'css') {
        tag = document.createElement('link');
        tag.rel = 'stylesheet';
        tag.href = url;
      } else if (type === 'js') {
        tag = document.createElement('script');
        tag.type = 'module';
        tag.src = url;
      }
      if (tag) {
        tag.onload = function () { resolve(url); };
        tag.onerror = function () { reject(url); };
        document.head.appendChild(tag);
      }
    });
  }

  // 主初始化流程
  async function main() {
    // 1. 修复跨域图片（Canvas 截图需要）
    var OriginalImage = window.Image;
    window.Image = function () {
      var img = new (Function.prototype.bind.apply(OriginalImage, [null].concat(Array.prototype.slice.call(arguments))))();
      img.crossOrigin = 'anonymous';
      return img;
    };
    window.Image.prototype = OriginalImage.prototype;

    // 2. 加载样式表
    await loadResource(live2d_path + 'waifu.css', 'css');

    // 3. 加载配置文件
    var response = await fetch(live2d_path + 'waifu-tips.json');
    var tips = await response.json();

    // 4. 从 API 获取模型列表，覆盖本地配置
    try {
      var modelRes = await fetch(live2d_api + '/model/list');
      var modelData = await modelRes.json();
      if (modelData.models && modelData.models.length > 0) {
        tips.models = modelData.models.map(function (m) {
          return {
            name: m.name,
            paths: [m.path],
            message: '加载模型: ' + m.name
          };
        });
      }
    } catch (e) {
      console.warn('[Live2D] 模型 API 请求失败，使用本地配置', e);
    }

    // 5. 动态导入主模块并初始化
    var module = await import(live2d_path + 'waifu-tips.js');
    module.initWidget({
      waifuPath: live2d_path + 'waifu-tips.json',
      cubism5Path: live2d_path + 'live2dcubismcore.min.js',
      tools: live2d_settings.tools,
      hitokotoApi: live2d_settings.hitokotoApi,
      logLevel: live2d_settings.logLevel,
      drag: live2d_settings.drag,
      _tipsOverride: tips,
    });
  }

  main();
})();
