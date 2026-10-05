'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = function desktopDocument(baseline) {
  const transport = fs.readFileSync(path.join(__dirname, '..', 'ui', 'action-transport.js'), 'utf8');
  const disclaimer = fs.readFileSync(path.join(__dirname, '..', 'ui', 'disclaimer.txt'), 'utf8').trim()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const begin = baseline.indexOf('allVideos.forEach((v,i)=>{');
  const end = baseline.indexOf('images.forEach(image=>{', begin);
  if (begin < 0 || end < 0) throw new Error('找不到原版播放控制边界');
  return (baseline.slice(0, begin) + transport + '\n' + baseline.slice(end))
    .replace(/(<p class="intro-line disclaimer">)[\s\S]*?(<\/p>)/, (_, start, end) => start + disclaimer + end)
    .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="desktop.css">')
    .replace('</body>', '<script src="desktop.js"></script></body>');
};
