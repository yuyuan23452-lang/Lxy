'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 760, show: true, focusable: false, webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  win.webContents.on('console-message', (_event, ...details) => console.log('renderer', ...details));
  try {
    await win.loadFile(path.join(__dirname, '..', 'content', 'index.html'));
    const report = await win.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const assert = (value, message) => { if (!value) throw new Error(message); };
      const $ = id => document.getElementById(id);
      const chooseStage = stage => document.querySelector('.stage-nav-button[data-stage="'+stage+'"]').click();
      const chooseAction = value => document.querySelector('.chapter-nav-button[data-value="'+value+'"]').click();
      const report = { viewport: [innerWidth, innerHeight], reading: [], actions: [], endings: [] };
      await wait(800);
      for (let stage = 0; stage <= 4; stage++) {
        chooseStage(stage); await wait(30);
        const intro = [...document.querySelectorAll('.intro')].find(el => el.getClientRects().length);
        const card = intro.getBoundingClientRect(), content = $('content').getBoundingClientRect();
        assert(document.querySelector('.controls').hidden, 'Reading transport visible');
        assert([...intro.children].every(el => getComputedStyle(el).visibility === 'visible'), 'Reading text hidden');
        assert(card.top >= content.top && card.bottom <= content.bottom + 1, 'Reading card overflow stage '+stage);
        assert([...intro.children].every(el => { const r=el.getBoundingClientRect(); return r.top >= card.top && r.bottom <= card.bottom && r.right <= card.right; }), 'Reading text overflow stage '+stage);
        report.reading.push(stage);
        for (const action of window.tfccActions[stage]) {
          chooseAction(action.start); await wait(30);
          assert($('toggle').textContent === '播放', 'Action must start paused');
          assert(Number($('seek').value) === 0, 'Action must start at zero');
          assert(Number($('seek').max) === action.end-action.start, 'Wrong duration');
          assert(document.querySelector('.chapter-nav-button.active .chapter-name').textContent === action.name, 'Missing action name');
          report.actions.push([stage, action.number, Number($('seek').max)]);
        }
      }
      for (const [stage, start] of [[1,10],[2,10],[3,874],[3,1279],[4,920]]) {
        chooseStage(stage); await wait(30); chooseAction(start); await wait(120);
        $('seek').value = Number($('seek').max)-.2; $('seek').dispatchEvent(new Event('input'));
        for(let n=0;n<40 && [...document.querySelectorAll('video')].some(v => !v.hidden && v.seeking);n++) await wait(50);
        $('toggle').click(); await wait(1100);
        assert(document.querySelector('main').dataset.completed === 'true', 'Did not stop at end: '+stage+'/'+start+' '+JSON.stringify({time:$('time').textContent, value:$('seek').value, max:$('seek').max, toggle:$('toggle').textContent, visibility:document.visibilityState}));
        assert($('chapter').value === String(start), 'Advanced into another action');
        assert($('toggle').textContent === '重新播放', 'Replay missing');
        assert(Number($('seek').value) === Number($('seek').max), 'End progress wrong');
        $('toggle').click(); await wait(150);
        assert($('toggle').textContent === '暂停' && Number($('seek').value) < 1, 'Replay failed');
        chooseAction(start); await wait(50);
        assert($('toggle').textContent === '播放' && Number($('seek').value) === 0, 'Reentry failed');
        report.endings.push([stage,start]);
      }
      assert($('error').hidden, $('error').textContent);
      return report;
    })()`, true);
    fs.writeFileSync(path.join(__dirname, '..', '..', 'smoke-1.3.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    app.exit(0);
  } catch (error) {
    fs.writeFileSync(path.join(__dirname, '..', '..', 'smoke-1.3-error.txt'), String(error.stack || error));
    console.error(error); app.exit(1);
  }
});
