# Live2D Widget

一个轻量级的网页 Live2D 看板娘组件，基于 Cubism 5 SDK，使用本地模型加载。

## 特性

- 本地模型加载，无需后端 API
- Cubism 5 SDK 支持
- 内联 Shader，无需额外网络请求
- 一言 API 多源支持（hitokoto.cn、jinrishici.com）
- 来路检测，识别百度、360、搜狗、谷歌等搜索引擎
- 自动压缩贴图，首次加载快速
- Service Worker 缓存，二次加载秒开

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/(yourusername)/live2d-widget.git ----仓库位置
cd live2d-widget ----本地项目位置

tips:不懂的话可以直接下载zip包，解压到目标目录就行，或者去原作者仓库，有更简单的使用方法
```

### 2. 添加模型

将 Cubism 5 模型放到 `model/` 目录下：

```
model/
  your-model/
    your-model.model3.json
    your-model.moc3
    textures/
      texture_00.png
      texture_01.png
```

### 3. 配置模型

编辑 `dist/waifu-tips.json`，修改 `models` 数组：

```json
{
  "models": [{
    "name": "your-model",
    "paths": ["../model/your-model/your-model.model3.json"],
    "message": "模型加载完成！"
  }]
}
```

### 4. 启动开发服务器

```bash
npx http-server -p 8080
```

访问 `http://localhost:8080/demo/demo.html`
例图：
![Live2D Widget 演示](demo/screenshots/screenshot-1.png)

![交互效果展示](demo/screenshots/screenshot-2.png)

![多模型切换](demo/screenshots/screenshot-3.png)

tips:自己添加或替换Cubism 5 模型文件于model目录下

## 项目结构

```
├── src/                    # 源代码
│   ├── cubism5/           # Cubism 5 集成
│   ├── localmodel.ts      # 本地模型管理器
│   ├── widget.ts          # 组件初始化
│   ├── tools.ts           # 工具栏
│   ├── message.ts         # 消息系统
│   └── ...
├── dist/                  # 构建产物
│   ├── autoload.js        # 自动加载脚本
│   ├── waifu-tips.js      # 打包后的脚本
│   ├── waifu-tips.json    # 提示消息配置
│   ├── waifu.css          # 样式表
│   └── live2dcubismcore.min.js
├── model/                 # 模型文件
├── demo/                  # 演示页面
└── scripts/               # 构建脚本
```

## 配置

### autoload.js 配置

编辑 `dist/autoload.js` 中的配置：

```javascript
initWidget({
  waifuPath: 'path/to/waifu-tips.json',
  cubism5Path: 'path/to/live2dcubismcore.min.js',
  tools: ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'info', 'quit'],
  hitokotoApi: 'hitokoto',  // 可选: 'hitokoto' 或 'jinrishici'
  logLevel: 'warn',
  drag: false,
});
```

### waifu-tips.json 配置

编辑 `dist/waifu-tips.json` 配置模型和提示消息：

```json
{
  "models": [{
    "name": "your-model",
    "paths": ["path/to/your-model.model3.json"],
    "message": "模型加载完成！"
  }],
  "message": {
    "welcome": "欢迎阅读「$1」",
    "hitokoto": "这句一言来自「$1」"
  }
}
```

### 贴图压缩

可使用内置脚本压缩贴图(选用功能)：

```bash
node scripts/compress-textures.mjs
```

这会将 8192px 的贴图压缩到 4096px，减少约 80% 的文件大小。

## 开发

### 构建

```bash
npm install
npm run build
```

### 本地测试

```bash
npx http-server -p 8080
```

访问 `http://localhost:8080/demo/demo.html`

## 项目结构

| 目录 | 说明 |
|------|------|
| `src/` | TypeScript 源代码 |
| `src/cubism5/` | Cubism 5 集成代码 |
| `src/CubismSdkForWeb-5-r.5/` | Cubism SDK 源码 |
| `dist/` | 构建产物 |
| `model/` | 模型文件 |
| `demo/` | 演示页面 |
| `scripts/` | 构建脚本 |

## 许可证

本项目基于 GNU General Public License v3 协议开源。

Live2D 相关代码的使用请遵守对应的许可：
- Live2D Cubism SDK 5: [Live2D Proprietary Software License](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_cn.html)
- Live2D Cubism Components: [Live2D Open Software License](https://www.live2d.com/eula/live2d-open-software-license-agreement_cn.html)

## 致谢

- [Live2D](https://www.live2d.com/) - Cubism SDK
- [stevenjoezhang/live2d-widget](https://github.com/stevenjoezhang/live2d-widget) - 原始项目，再次感谢
- [FGHRSH](https://www.fghrsh.net/post/123.html) - 看板娘教程
- [一言](https://hitokoto.cn) - 一言 API
