import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL_DIR = path.join(__dirname, 'model');

// 禁用 X-Powered-By
app.disable('x-powered-by');

// CORS（开发用）
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// 上传配置：内存存储，限制 200MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// 静态文件：只暴露 dist 和 demo
app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use('/demo', express.static(path.join(__dirname, 'demo')));

// ====== 模型 API ======

// 递归扫描 .model3.json 配置文件
function findModelConfigs(dirPath, basePath = '') {
  const configs = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      configs.push(...findModelConfigs(path.join(dirPath, entry.name), relPath));
    } else if (entry.name.endsWith('.model3.json')) {
      configs.push(relPath);
    }
  }
  return configs;
}

// 获取模型列表
app.get('/api/model/list', (req, res) => {
  try {
    const models = [];
    const modelDirs = fs.readdirSync(MODEL_DIR).filter(f => {
      return fs.statSync(path.join(MODEL_DIR, f)).isDirectory();
    });

    for (const dir of modelDirs) {
      const dirPath = path.join(MODEL_DIR, dir);
      const configFiles = findModelConfigs(dirPath);

      for (const configRelPath of configFiles) {
        models.push({
          id: models.length,
          name: dir,
          path: `/api/model/file/${dir}/${configRelPath}`
        });
      }
    }

    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list models' });
  }
});

// 代理模型文件
app.get('/api/model/file/:dir/:file(*)', (req, res) => {
  const { dir, file } = req.params;

  // 安全检查：防止路径穿越
  const safePath = path.normalize(dir + '/' + file).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(MODEL_DIR, safePath);

  // 确保路径在 MODEL_DIR 内
  if (!filePath.startsWith(MODEL_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // 根据文件类型设置 Content-Type
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.json': 'application/json',
    '.moc3': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.moc': 'application/octet-stream',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  // 流式传输文件
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// ====== 模型上传/导入 ======

// 清洗模型目录名（去掉非法字符）
function sanitizeDirName(name) {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'imported-model';
}

// POST /api/model/upload —— 接收 ZIP 压缩包并解压到 model/ 目录
app.post('/api/model/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未收到文件，请选择 .zip 压缩包' });
    }

    const originalName = req.file.originalname || 'model.zip';
    if (!originalName.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({ error: '仅支持 .zip 格式的模型压缩包' });
    }

    // 确定模型目录名（zip 文件名去 .zip），同名则追加序号
    let modelName = sanitizeDirName(path.basename(originalName, path.extname(originalName)));
    let targetDir = path.join(MODEL_DIR, modelName);
    let finalName = modelName;
    let i = 2;
    while (fs.existsSync(targetDir)) {
      finalName = `${modelName}-${i}`;
      targetDir = path.join(MODEL_DIR, finalName);
      i++;
    }

    // 解压（防御 zip slip：拒绝 ../ 与绝对路径）
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    if (!entries.length) {
      return res.status(400).json({ error: '压缩包为空' });
    }

    fs.mkdirSync(targetDir, { recursive: true });
    let wrote = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryName = entry.entryName.replace(/\\/g, '/');
      // 过滤 macOS 系统文件
      if (entryName.startsWith('__MACOSX/') || entryName.includes('__MACOSX/')) continue;
      // 路径穿越检查
      const norm = path.normalize(entryName);
      if (norm.startsWith('..') || path.isAbsolute(norm)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return res.status(400).json({ error: '压缩包内含非法路径，已拒绝' });
      }
      const dest = path.join(targetDir, norm);
      if (dest !== targetDir && !dest.startsWith(targetDir + path.sep)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return res.status(400).json({ error: '压缩包内含非法路径，已拒绝' });
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.getData());
      wrote++;
    }

    if (!wrote) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return res.status(400).json({ error: '压缩包内没有可解压的文件' });
    }

    // 校验是否包含 .model3.json
    const configs = findModelConfigs(targetDir);
    if (!configs.length) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      return res.status(400).json({ error: '压缩包内未找到 .model3.json，请上传标准 Live2D 模型压缩包' });
    }

    res.json({
      success: true,
      name: finalName,
      config: `/api/model/file/${finalName}/${configs[0]}`,
      message: `模型「${finalName}」导入成功`,
    });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: `导入失败: ${err.message || '未知错误'}` });
  }
});

// 获取已导入模型列表（含导入时间，按目录名排序）
app.get('/api/model/uploaded', (req, res) => {
  try {
    const list = fs
      .readdirSync(MODEL_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const stat = fs.statSync(path.join(MODEL_DIR, d.name));
        const configs = findModelConfigs(path.join(MODEL_DIR, d.name));
        return {
          name: d.name,
          configs: configs.length,
          mtime: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ models: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list uploaded models' });
  }
});

// 阻止直接访问 model 目录
app.use('/model', (req, res) => {
  res.status(403).json({ error: 'Direct model access forbidden' });
});

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'index.html'));
});

// 介绍页
app.get('/intro', (req, res) => {
  res.sendFile(path.join(__dirname, 'demo', 'intro.html'));
});

const server = app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('========================================');
  console.log('  Live2D Widget 启动成功');
  console.log('========================================');
  console.log(`  展示页:  ${base}/`);
  console.log(`  介绍页:  ${base}/intro`);
  console.log(`  模型API: ${base}/api/model/list`);
  console.log('========================================');
});

// 优雅退出：自动释放端口
function shutdown() {
  console.log('\nShutting down...');
  server.close(() => {
    console.log('Port released.');
    process.exit(0);
  });
  // 3 秒后强制退出
  setTimeout(() => process.exit(1), 3000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);