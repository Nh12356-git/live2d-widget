# Live2D Widget

网页看板娘小部件，基于 Live2D Cubism 5 SDK，通过 API 代理模型文件，防止资源直接暴露。

## 快速开始

```bash
npm install
npm run build
npm start
```

启动后打开浏览器访问：

| 页面 | URL | 说明 |
|------|-----|------|
| **展示页** | http://localhost:3000/ | 主入口，演示看板娘功能 |
| **介绍页** | http://localhost:3000/intro | 项目介绍 |
| **API** | http://localhost:3000/api/model/list | 模型列表 JSON |

## 架构

```
浏览器 → Express Server → model/
          ↓
      /api/model/list     模型列表（递归扫描）
      /api/model/file/*   模型资源代理
      /api/model/upload   ZIP 模型导入
      /api/model/uploaded 已导入模型列表
```

| 层级 | 说明 |
|------|------|
| 前端 | 静态资源（HTML/CSS/JS），通过 API 获取模型数据 |
| 后端 | Express 服务器，递归扫描模型目录，代理模型文件，隐藏真实路径 |

## 配置

### 服务端 `server.js`

```javascript
const PORT = process.env.PORT || 3000;
const MODEL_DIR = path.join(__dirname, 'model');
```

### 前端 `dist/autoload.js`

```javascript
const live2d_path = '../dist/';   // 静态资源路径
const live2d_api = '/api';         // 后端 API 地址

const live2d_settings = {
  modelId: 0,
  modelTexturesId: 0,
  tools: ['home', 'hitokoto', 'asteroids', 'photo', 'settings', 'quit'],
  hitokotoApi: 'hitokoto',   // 'hitokoto' 或 'jinrishici'
  logLevel: 'warn',
  drag: true,
};
```

### 工具栏

| 名称 | 图标 | 说明 |
|------|------|------|
| `home` | 🏠 | 回到首页 |
| `hitokoto` | 💬 | 一言 |
| `asteroids` | ✈️ | 小行星游戏 |
| `photo` | 📷 | 截图 |
| `settings` | ⚙️ | 设置（包含切换模型、换装、关于、拖拽） |
| `quit` | ✖️ | 关闭看板娘 |

## API

### `GET /api/model/list`

返回模型列表，包含配置路径和贴图路径。支持嵌套目录递归扫描。

```json
{
  "models": [
    {
      "id": 0,
      "name": "Haru",
      "path": "/api/model/file/Haru/Haru.model3.json"
    }
  ]
}
```

### `GET /api/model/file/:dir/:file(*)`

代理模型文件，支持 `.json`、`.moc3`、`.png`、`.moc` 等。

安全特性：路径穿越防护、禁止直接访问 `/model/`、文件类型白名单。

### `POST /api/model/upload`

接收 ZIP 压缩包并解压到 `model/` 目录。限制 200MB，自动校验 `.model3.json`。

### `GET /api/model/uploaded`

获取已导入模型列表（含导入时间，按时间倒序排序）。

## 项目结构

```
├── build/                         # 前端源码（TypeScript 编译产物）
│   ├── widget.js                  # 初始化、布局、自动缩放
│   ├── model.js                   # 模型管理
│   ├── message.js                 # 消息系统
│   ├── tools.js                   # 工具栏
│   ├── drag.js                    # 拖拽
│   ├── icons.js                   # SVG 图标
│   ├── localmodel.js              # 本地模型加载
│   ├── logger.js                  # 日志
│   ├── utils.js                   # 工具函数
│   ├── cubism5/                   # Cubism 5 适配
│   ├── cubism2/                   # Cubism 2 兼容层
│   └── CubismSdkForWeb-5-r.5/     # Cubism 5 SDK
│       ├── Core/                  # 核心运行时
│       ├── Framework/             # 框架源码
│       └── Samples/
│           └── TypeScript/Demo/src/
│               ├── lappview.js        # 视图矩阵
│               ├── lappmodel.js       # 模型渲染（含视口与偏移）
│               ├── lappsubdelegate.js  # 画布管理
│               └── ...
├── dist/                          # 构建产物（部署用）
│   ├── autoload.js               # 一键加载
│   ├── waifu.css                 # 样式
│   ├── waifu-tips.js             # 主模块
│   ├── waifu-tips.json           # 消息配置
│   ├── live2dcubismcore.min.js   # Cubism 核心
│   └── chunk/index.js            # 代码分割块
├── model/                         # 模型资源（不直接暴露）
├── demo/                          # 测试页面
├── server.js                      # Express 服务器
├── rollup.config.js               # Rollup 构建配置
├── eslint.config.js               # ESLint 配置
└── package.json
```

## 模型渲染系统

### 画布与布局

| 属性 | 值 | 说明 |
|------|------|------|
| 画布宽度 | 165px × scale | 基准宽度 |
| 画布高度 | 280px × scale | 基准高度 |
| 渲染逻辑尺寸 | 800 × 800 | WebGL 画布实际尺寸 |
| 设备像素比 | devicePixelRatio | 自动适配高分屏 |

### 模型偏移

模型在渲染管线内通过矩阵变换偏移，避免 CSS transform 裁剪：

- `window.__live2dModelOffset` 控制模型位移（单位：CSS 像素）
- 在 `setupLayout` 中通过 `unitsPerPx = 2.0 / cssH` 转换为 logical 单位
- 默认偏移：`{ x: 0, y: -20 }`（模型下移 20px，展示更自然）

### 视口

渲染视口设置为 `[0, 0, canvas.width, canvas.height]`，确保模型完整显示，不被裁剪。

## 开发

### 启动

```bash
npm install
npm run build
npm start          # 后端服务（API 代理）
# 或
npm run dev        # 静态服务器（无 API）
```

### 自定义端口

| 环境 | 命令 |
|------|------|
| PowerShell | `$env:PORT=8080; node server.js` |
| CMD | `set PORT=8080 && node server.js` |
| Linux/macOS | `PORT=8080 node server.js` |

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建（TypeScript + Rollup） |
| `npm run build-dev` | 监听文件变化，自动构建 |
| `npm run eslint` | 代码检查 |
| `npm run clean` | 清理构建产物 |

### 测试页面

访问 http://localhost:3000/demo/，可测试欢迎语、消息显示、模型切换、事件触发等功能。

## 添加模型

### 方式一：手动放置

1. 将模型文件放入 `model/` 目录：

```
model/mymodel/
├── mymodel.model3.json
├── mymodel.moc3
├── mymodel.physics3.json
└── texture_low/
    ├── texture_00.png
    └── texture_01.png
```

2. 重启服务器，模型自动被识别（支持嵌套目录结构）

3. 通过 `GET /api/model/list` 查看模型列表

### 方式二：ZIP 导入

通过 POST `/api/model/upload` 上传 `.zip` 压缩包，服务端自动解压并校验 `.model3.json`。

支持前端拖拽导入，工具栏「设置 → 模型导入」。

## 部署

### 生产环境

```bash
npm run build

# 启动
$env:PORT=8080; node server.js      # PowerShell
set PORT=8080 && node server.js      # CMD
PORT=8080 node server.js             # Linux/macOS
```

### PM2 守护进程

```bash
pm2 start server.js --name live2d
pm2 save
pm2 startup    # Linux/macOS 开机自启
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /model {
        return 403;
    }
}
```

## FAQ

**模型加载失败？**
检查控制台是否有 403 错误，确认模型文件在 `model/` 目录下，确认服务器正在运行。

**如何添加多个模型？**
在 `model/` 下创建多个子目录，每个目录放一个模型，服务器自动递归扫描。支持嵌套目录结构。

**模型显示不完整？**
检查浏览器缩放是否正常，尝试刷新页面。画布基准尺寸为 165×280px，已通过模型矩阵偏移确保完整显示。

**如何自定义消息？**
编辑 `dist/waifu-tips.json` 的 `message` 节点。

**如何禁用工具？**
在 `dist/autoload.js` 的 `tools` 数组中移除对应名称。

**如何调整模型大小/位置？**
修改 `build/widget.js` 中 `applyAutoScale` 的 `baseW` / `baseH`，或调整 `window.__live2dModelOffset` 的偏移值。

## 许可证

[GPL-3.0](LICENSE)