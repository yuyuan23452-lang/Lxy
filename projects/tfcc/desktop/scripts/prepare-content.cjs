'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sourceDir = process.env.TFCC_SOURCE_DIR;
if (!sourceDir) throw new Error('Set TFCC_SOURCE_DIR to your original phase-4 output directory; this historical import step is not required to run the archived app.');
const sourceName = 'tfcc-phases-1-2-3-4-combined-v6.html';
const sourceHash = '22231877f6c1ee17cd69993303e2ed53b4b9060748db18b0b029836859233530';
const targetDir = path.join(__dirname, '..', 'content');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const sourceFile = path.join(sourceDir, sourceName);
if (sha256(sourceFile) !== sourceHash) throw new Error('已确认的 v6 网页源文件发生变化，停止复制。');
const html = fs.readFileSync(sourceFile, 'utf8');
const media = [...new Set(html.match(/[A-Za-z0-9][A-Za-z0-9-]*\.(?:mp4|png|jpe?g|webp|svg|woff2?)/g) || [])];
if (media.length !== 12) throw new Error(`依赖数量异常：${media.length}，停止复制。`);
fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceFile, path.join(targetDir, 'index.html'));
fs.mkdirSync(path.join(__dirname, '..', 'ui'), { recursive: true });
fs.copyFileSync(sourceFile, path.join(__dirname, '..', 'ui', 'baseline-v6.html'));
for (const name of media) {
  const source = path.join(sourceDir, name);
  if (!fs.existsSync(source)) throw new Error(`缺少素材：${name}`);
  fs.copyFileSync(source, path.join(targetDir, name));
}
console.log(`已复制 v6 网页及 ${media.length} 个实际依赖到 ${targetDir}`);
require('./apply-desktop-layout.cjs');
