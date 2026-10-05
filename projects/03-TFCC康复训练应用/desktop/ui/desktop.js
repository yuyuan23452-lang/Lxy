(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const main = document.querySelector('main');
  document.title = 'TFCC 康复训练 · 桌面版 1.3.1';
  main.dataset.layout = 'desktop-1.3.1';
  const stages = [
    ['免责声明', '', '00'],
    ['第一阶段', '第0天—第4周末', '01'],
    ['第二阶段', '第5–6周', '02'],
    ['第三阶段', '第7–9周', '03'],
    ['第四阶段', '第10–12周', '04']
  ];
  $('stageSelect').options[0].textContent = '免责声明';
  $('intro1').setAttribute('aria-label', '免责声明');
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = '<div class="brand"><span class="brand-mark" aria-hidden="true">T</span><div><strong>TFCC</strong><span>康复训练</span></div></div><div class="nav-caption">训练日程</div><nav class="stage-nav" aria-label="训练阶段与动作导航"></nav><div class="sidebar-foot"><span class="offline-dot"></span> 本机离线使用<span class="edition">桌面版 1.3.1</span></div>';
  const nav = sidebar.querySelector('nav');
  stages.forEach(([label, duration, number], index) => {
    const group = document.createElement('div');
    group.className = 'stage-nav-group';
    group.dataset.stage = index;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage-nav-button';
    button.dataset.stage = index;
    button.innerHTML = '<span class="stage-number">'+number+'</span><span class="stage-name">'+label+(duration?'<span class="stage-period">（'+duration+'）</span>':'')+'</span><span class="nav-chevron" aria-hidden="true">›</span>';
    const chapters = document.createElement('div');
    chapters.className = 'chapter-nav';
    chapters.id = 'stageChapters'+index;
    chapters.hidden = true;
    chapters.setAttribute('aria-label', label+'内容');
    if (index > 0) { button.setAttribute('aria-controls', chapters.id); button.setAttribute('aria-expanded', 'false'); }
    button.addEventListener('click', () => {
      $('stageSelect').value = String(index);
      $('stageSelect').dispatchEvent(new Event('change', { bubbles: true }));
      syncNavigation();
    });
    group.append(button, chapters);
    nav.append(group);
  });
  const header = document.createElement('header');
  header.className = 'workspace-header';
  header.innerHTML = '<div class="workspace-location"><span>训练工作台</span><span class="breadcrumb-divider">/</span><strong id="workspaceStage">免责声明</strong></div><div class="workspace-meta"><span class="silent-badge">静音训练</span><span class="playback-status" id="playbackStatus">已暂停</span></div>';
  main.prepend(sidebar, header);

  const action = $('action');
  const training = document.createElement('div');
  training.className = 'training-main';
  training.append($('title'), action.querySelector('.row'), action.querySelector('.visual'));
  const guide = document.createElement('aside');
  guide.className = 'guide-panel';
  guide.setAttribute('aria-label', '动作说明');
  const guideHeader = document.createElement('div');
  guideHeader.className = 'guide-header';
  guideHeader.innerHTML = '<strong>动作说明</strong><span>跟随画面，逐步完成</span>';
  const guideBody = document.createElement('div');
  guideBody.className = 'guide-body';
  function block(name, element, cls) {
    const section = document.createElement('section');
    section.className = 'guide-section '+cls;
    const label = document.createElement('h2');
    label.className = 'section-label';
    label.textContent = name;
    section.append(label, element);
    return section;
  }
  guideBody.append(block('准备姿势', $('prep'), 'preparation-block'), block('动作步骤', $('instructions'), 'instructions-block'));
  const guideFooter = document.createElement('div');
  guideFooter.className = 'guide-footer';
  guideFooter.append(block('训练数量', $('quantity'), 'quantity-block'), block('注意事项', $('warning'), 'warning-block'));
  guide.append(guideHeader, guideBody, guideFooter);
  action.append(training, guide);

  const controls = main.querySelector('.controls');
  controls.setAttribute('aria-label', '播放控制');
  // Keep the approved playback engine's controls as an internal bridge.
  // Their only visible replacements are the stage and chapter buttons in the sidebar.
  const playbackBridge = document.createElement('div');
  playbackBridge.hidden = true;
  playbackBridge.append($('stageSelect'), $('chapter'));
  main.append(playbackBridge);
  const seek = $('seek');
  const timeline = document.createElement('label');
  timeline.className = 'control-field timeline';
  const caption = document.createElement('span');
  caption.textContent = '播放进度';
  seek.before(timeline);
  timeline.append(caption, seek);
  let lastStage = '', lastNavSignature = '', lastChapterKey = '';
  function syncNavigation() {
    const stage = main.dataset.stage;
    const options = Array.from($('chapter').options);
    const signature = stage + ':' + options.map(option => option.value+'='+option.textContent).join('|');
    if (signature === lastNavSignature) { syncChapterSelection(); return; }
    lastNavSignature = signature;
    $('workspaceStage').textContent = stages[Number(stage)][0];
    nav.querySelectorAll('.stage-nav-button').forEach(button => {
      const active = button.dataset.stage === stage;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      if (button.dataset.stage !== '0') button.setAttribute('aria-expanded', String(active));
      const chapterList = $('stageChapters'+button.dataset.stage);
      chapterList.replaceChildren();
      chapterList.hidden = !active || stage === '0';
      if (!active || stage === '0') return;
      options.forEach(option => {
        const chapterButton = document.createElement('button');
        chapterButton.type = 'button';
        chapterButton.className = 'chapter-nav-button';
        chapterButton.dataset.value = option.value;
        const label = document.createElement('span');
        label.className = 'chapter-label';
        label.textContent = option.textContent;
        const text = document.createElement('span');
        text.className = 'chapter-text';
        text.append(label);
        const actionInfo = window.tfccActions[Number(stage)].find(action => action.start === Number(option.value));
        if (actionInfo) {
          const name = document.createElement('span');
          name.className = 'chapter-name';
          name.textContent = actionInfo.name;
          text.append(name);
        }
        chapterButton.append(text);
        chapterButton.addEventListener('click', () => {
          $('chapter').value = option.value;
          $('chapter').dispatchEvent(new Event('change', { bubbles: true }));
          syncChapterSelection();
        });
        chapterList.append(chapterButton);
      });
    });
    if (stage !== lastStage) guideBody.scrollTop = 0;
    lastStage = stage;
    lastChapterKey = '';
    syncChapterSelection();
  }
  function syncChapterSelection() {
    const stage = main.dataset.stage;
    const value = $('chapter').value;
    const key = stage+':'+value;
    if (key === lastChapterKey) return;
    lastChapterKey = key;
    nav.querySelectorAll('.chapter-nav-button').forEach(button => {
      const active = button.dataset.value === value;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }
  function syncPlayback() {
    const playing = $('toggle').textContent === '暂停';
    $('toggle').dataset.state = playing ? 'playing' : 'paused';
    $('playbackStatus').textContent = main.dataset.completed === 'true' ? '已完成' : playing ? '正在播放' : '已暂停';
    $('playbackStatus').classList.toggle('playing', playing);
  }
  new MutationObserver(syncNavigation).observe(main, { attributes: true, attributeFilter: ['data-stage'] });
  new MutationObserver(syncNavigation).observe($('chapter'), { childList: true });
  new MutationObserver(syncChapterSelection).observe($('time'), { childList: true, characterData: true, subtree: true });
  new MutationObserver(syncPlayback).observe($('toggle'), { childList: true, characterData: true, subtree: true });
  let lastTitle = '';
  new MutationObserver(() => {
    const title = $('title').textContent;
    if (title !== lastTitle) { guideBody.scrollTop = 0; lastTitle = title; }
  }).observe($('title'), { childList: true, characterData: true, subtree: true });
  $('chapter').addEventListener('change', () => { guideBody.scrollTop = 0; });
  syncNavigation();
  syncPlayback();
})();
