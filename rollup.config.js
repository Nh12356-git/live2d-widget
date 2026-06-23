import terser from '@rollup/plugin-terser';
import alias from '@rollup/plugin-alias';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findCubismDir() {
  const buildDir = path.join(__dirname, 'build');
  let candidates = fs.readdirSync(buildDir)
    .filter(f => f.startsWith('CubismSdkForWeb-') && fs.statSync(path.join(buildDir, f)).isDirectory());
  if (candidates.length === 0) {
    candidates = ['CubismSdkForWeb-5-r.5'];
  }
  return path.join(buildDir, candidates[0]);
}

const cubismDir = findCubismDir();

const srcShaderDir = path.resolve(__dirname, 'src/CubismSdkForWeb-5-r.5/Framework/Shaders/WebGL');

const shaderFileNames = [
  'vertshadersrc.vert',
  'vertshadersrcmasked.vert',
  'vertshadersrcsetupmask.vert',
  'fragshadersrcsetupmask.frag',
  'fragshadersrcpremultipliedalpha.frag',
  'fragshadersrcmaskpremultipliedalpha.frag',
  'fragshadersrcmaskinvertedpremultipliedalpha.frag',
  'vertshadersrccopy.vert',
  'fragshadersrccopy.frag',
  'fragshadersrccolorblend.frag',
  'fragshadersrcalphablend.frag',
  'vertshadersrcblend.vert',
  'fragshadersrcpremultipliedalphablend.frag',
];

function inlineShadersPlugin() {
  const shaderMap = {};
  for (const name of shaderFileNames) {
    shaderMap[name] = fs.readFileSync(path.join(srcShaderDir, name), 'utf-8');
  }
  const shaderMapStr = JSON.stringify(shaderMap);

  return {
    name: 'inline-shaders',
    transform(code, id) {
      if (!id.endsWith('cubismshader_webgl.js')) return null;

      const replacement = `loadShaders() {
        var _a;
        const shaderDir = (_a = this._shaderPath) !== null && _a !== void 0 ? _a : this._defaultShaderPath;
        const S = ${shaderMapStr};
        const get = (n) => S[n] || '';
        this._vertShaderSrc = get('vertshadersrc.vert');
        this._vertShaderSrcMasked = get('vertshadersrcmasked.vert');
        this._vertShaderSrcSetupMask = get('vertshadersrcsetupmask.vert');
        this._fragShaderSrcSetupMask = get('fragshadersrcsetupmask.frag');
        this._fragShaderSrcPremultipliedAlpha = get('fragshadersrcpremultipliedalpha.frag');
        this._fragShaderSrcMaskPremultipliedAlpha = get('fragshadersrcmaskpremultipliedalpha.frag');
        this._fragShaderSrcMaskInvertedPremultipliedAlpha = get('fragshadersrcmaskinvertedpremultipliedalpha.frag');
        this._vertShaderSrcCopy = get('vertshadersrccopy.vert');
        this._fragShaderSrcCopy = get('fragshadersrccopy.frag');
        this._fragShaderSrcColorBlend = get('fragshadersrccolorblend.frag');
        this._fragShaderSrcAlphaBlend = get('fragshadersrcalphablend.frag');
        this._vertShaderSrcBlend = get('vertshadersrcblend.vert');
        this._fragShaderSrcBlend = get('fragshadersrcpremultipliedalphablend.frag');
      }`;

      const pattern = /loadShaders\(\)\s*\{[\s\S]*?results\.forEach\(result => \{\s*this\[result\.prop\] = result\.data;\s*\}\);\s*\}/;
      code = code.replace(pattern, replacement);

      return { code, map: null };
    }
  };
}

export default {
  input: 'build/waifu-tips.js',
  output: {
    dir: 'dist/',
    format: 'esm',
    chunkFileNames: 'chunk/[name].js',
    sourcemap: true,
    banner: `/*!
 * Live2D Widget
 * https://github.com/stevenjoezhang/live2d-widget
 */
`
  },
  plugins: [
    alias({
      entries: [
        {
          find: '@demo',
          replacement: path.resolve(cubismDir, 'Samples/TypeScript/Demo/src/')
        },
        {
          find: '@framework',
          replacement: path.resolve(cubismDir, 'Framework/src/')
        }
      ]
    }),
    inlineShadersPlugin(),
    terser(),
  ],
  context: 'this',
};
