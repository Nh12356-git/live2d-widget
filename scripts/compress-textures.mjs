import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'model/yachiyo/八千代辉夜姬.8192');
const outDir = path.join(rootDir, 'model/yachiyo/texture_low');

const MAX_SIZE = 4096;

async function compressTexture(srcName) {
  const srcPath = path.join(srcDir, srcName);
  const outPath = path.join(outDir, srcName);
  const meta = await sharp(srcPath).metadata();
  const scale = Math.min(1, MAX_SIZE / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  console.log(`  ${srcName}: ${meta.width}x${meta.height} → ${w}x${h}`);
  await sharp(srcPath)
    .resize(w, h, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const origSize = fs.statSync(srcPath).length;
  const newSize = fs.statSync(outPath).length;
  console.log(`    ${Math.round(origSize/1024/1024)}MB → ${Math.round(newSize/1024/1024)}MB (${Math.round(newSize/origSize*100)}%)`);
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
  console.log('Compressing textures...');
  for (const f of files) {
    await compressTexture(f);
  }
  console.log('Done!');
}

main().catch(console.error);
