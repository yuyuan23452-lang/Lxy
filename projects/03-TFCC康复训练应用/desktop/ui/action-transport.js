// Runs inside the approved renderer's scope. Only navigation and transport change;
// the existing copy, animation renderers and source-media offsets remain intact.
const actionStarts = [[], starts.map(value => value - 4), phase2Starts.slice(1), phase3Starts.slice(1), phase4Starts.slice(1)];
const actionTitles = [[], titles, phase2Titles.slice(1), phase3Copy.slice(1).map(copy => copy.title), phase4Copy.slice(1).map(copy => copy.title)];
const stageEnds = [0, 822, 328, 1399, phase4Total];
const actionCatalog = actionStarts.map((values, index) => values.map((start, offset) => ({
  start, end: values[offset + 1] ?? stageEnds[index], number: offset + 1,
  name: actionTitles[index][offset].replace(/^【动作\s*\d+(?:：|】)\s*/, '').replace(/】$/, '')
})));
window.tfccActions = actionCatalog;
let selectedAction = null, elapsed = 0, completed = false, seekGeneration = 0;
const originalRender = render;
render = function () {
  originalRender();
  const reading = selectedAction === null;
  const main = document.querySelector('main');
  main.dataset.view = reading ? 'reading' : 'action';
  main.dataset.completed = String(completed);
  main.querySelector('.controls').hidden = reading;
  if (reading) return;
  const duration = selectedAction.end - selectedAction.start;
  $('chapter').value = String(selectedAction.start);
  $('seek').max = duration;
  $('seek').value = elapsed;
  $('seek').setAttribute('aria-label', '当前动作播放进度');
  $('seek').setAttribute('aria-valuetext', fmt(elapsed) + ' / ' + fmt(duration));
  $('time').textContent = fmt(elapsed) + ' / ' + fmt(duration);
  if (!$('toggle').disabled) $('toggle').textContent = completed ? '重新播放' : playing ? '暂停' : '播放';
  if (completed) {
    $('phase').textContent = '当前动作已完成';
    $('countdown').textContent = '';
    $('phase').dataset.mode = 'complete';
  }
};
function stopMedia() { allVideos.forEach(video => video.pause()); last = null; }
function updateRendererTime() {
  // Stay inside the selected section even at 100%; render its final pose and copy.
  t = selectedAction ? selectedAction.start + Math.min(elapsed, selectedAction.end - selectedAction.start - .001) : 0;
}
jump = function (value) {
  stopMedia();
  if (selectedAction) {
    elapsed = Math.max(0, Math.min(selectedAction.end - selectedAction.start, value - selectedAction.start));
    completed = elapsed >= selectedAction.end - selectedAction.start;
    if (completed) playing = false;
  } else { elapsed = 0; completed = false; playing = false; }
  updateRendererTime();
  active = stage === 1 && selectedAction ? selectedAction.number - 1 : -1;
  vs.forEach((video, index) => video.hidden = stage !== 1 || index !== active);
  const section = selectedAction?.number ?? 0;
  $('c').hidden = stage !== 2 || (section !== 1 && section !== 2);
  p2v.hidden = stage !== 2 || section !== 3;
  $('p3canvas').hidden = stage !== 3 || section !== 1;
  p3v.hidden = stage !== 3 || section !== 2;
  $('p3reference').hidden = stage !== 3 || section !== 3;
  $('effortOverlay').toggleAttribute('hidden', stage !== 3 || section !== 3);
  p4v.hidden = stage !== 4 || !section;
  lastKey = '';
  $('content').scrollTop = 0;
  const generation = ++seekGeneration, video = currentVideo();
  if (video) {
    const local = t - videoStart();
    const position = () => {
      if (generation !== seekGeneration || currentVideo() !== video) return;
      video.currentTime = local;
      if (playing) playVideo();
    };
    if (video.readyState) position();
    else video.addEventListener('loadedmetadata', position, { once: true });
  }
  render();
};
selectStage = function (value) {
  playing = false;
  selectedAction = null;
  stage = Number(value);
  $('error').hidden = true;
  setOptions();
  jump(0);
};
function selectEntry(value) {
  playing = false;
  selectedAction = actionCatalog[stage].find(action => action.start === Number(value)) ?? null;
  $('error').hidden = true;
  jump(selectedAction?.start ?? 0);
}
function finishAction() {
  if (!selectedAction) return;
  playing = false;
  jump(selectedAction.end);
}
allVideos.forEach(video => {
  video.muted = true;
  video.volume = 0;
  video.addEventListener('ended', () => {
    if (currentVideo() === video && selectedAction && playing) finishAction();
  });
  video.addEventListener('error', () => fail('视频加载失败，请保留网页同目录下的配套视频。'));
});
p4v.addEventListener('loadedmetadata', () => {
  if (Math.abs(p4v.duration - 2676) > .05) fail('第四阶段视频时长不符，请保留配套44分36秒版本。');
});
$('stageSelect').onchange = () => selectStage($('stageSelect').value);
$('chapter').onchange = () => selectEntry($('chapter').value);
$('seek').oninput = () => { if (selectedAction) jump(selectedAction.start + Number($('seek').value)); };
$('toggle').onclick = () => {
  if (!selectedAction) return;
  if (completed) { playing = false; jump(selectedAction.start); }
  playing = !playing;
  last = null;
  if (playing) playVideo(); else stopMedia();
  render();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { playing = false; stopMedia(); render(); }
});
function tick(now) {
  if (playing && selectedAction) {
    const video = currentVideo();
    if (video) {
      if (!video.seeking && video.readyState >= 2) elapsed = Math.max(0, videoStart() + video.currentTime - selectedAction.start);
    } else if (last !== null) elapsed += (now - last) / 1000;
    if (elapsed >= selectedAction.end - selectedAction.start) finishAction();
    else { updateRendererTime(); render(); }
  }
  last = now;
  requestAnimationFrame(tick);
}
