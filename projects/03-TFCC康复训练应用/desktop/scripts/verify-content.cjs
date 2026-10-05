'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const contentDir = path.join(__dirname, '..', 'content');
const html = fs.readFileSync(path.join(contentDir, 'index.html'), 'utf8');
const refs = [...new Set(html.match(/[A-Za-z0-9][A-Za-z0-9-]*\.(?:mp4|png|jpe?g|webp|svg|woff2?)/g) || [])];
const present = fs.readdirSync(contentDir).sort();
const expected = ['index.html', 'desktop.css', 'desktop.js', ...refs].sort();
if (JSON.stringify(present) !== JSON.stringify(expected)) {
  throw new Error(`内容目录与 v6 的实际依赖不一致。\n实际：${present.join(', ')}\n应有：${expected.join(', ')}`);
}
const baseline = fs.readFileSync(path.join(__dirname, '..', 'ui', 'baseline-v6.html'));
const hash = crypto.createHash('sha256').update(baseline).digest('hex');
if (hash !== '22231877f6c1ee17cd69993303e2ed53b4b9060748db18b0b029836859233530') throw new Error('v6 底稿校验失败');
if (html !== require('./desktop-document.cjs')(baseline.toString('utf8'))) throw new Error('内容与已确认底稿和单动作播放适配不同步。');
const originalBody = baseline.toString('utf8').match(/<body>([\s\S]*?)<script>/)[1];
const omitDisclaimer = body => body.replace(/(<p class="intro-line disclaimer">)[\s\S]*?(<\/p>)/, '$1$2');
if (omitDisclaimer(html.match(/<body>([\s\S]*?)<script>/)[1]) !== omitDisclaimer(originalBody)) throw new Error('免责声明之外的原有正文被改动。');
for (const file of ['desktop.css', 'desktop.js']) {
  if (!fs.readFileSync(path.join(contentDir, file)).equals(fs.readFileSync(path.join(__dirname, '..', 'ui', file)))) throw new Error(`布局文件不同步：${file}`);
}
console.log(`核对通过：新免责声明同步，其余 v6 正文和动画保留，单动作播放适配同步；${refs.length} 个素材及桌面布局文件齐全。`);
