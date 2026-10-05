(() => {
  'use strict';

  const api = window.petAPI;
  if (!api) throw new Error('豆豆桌宠 IPC 未就绪');

  const petStage = document.querySelector('#pet-stage');
  const petShell = document.querySelector('#pet-shell');
  const petCharacter = document.querySelector('#pet-character');
  const idleImage = document.querySelector('#idle-image');
  const idleVideo = document.querySelector('#idle-video');
  const skillVideo = document.querySelector('#skill-video');
  const sleepEnterVideo = document.querySelector('#sleep-enter-video');
  const sleepLoopVideo = document.querySelector('#sleep-loop-video');
  const wakeVideo = document.querySelector('#wake-video');
  const stateVideos = [sleepEnterVideo, sleepLoopVideo, wakeVideo];
  const sceneLayer = document.querySelector('#scene-layer');
  const sceneVideo = document.querySelector('#scene-video');
  const hideButton = document.querySelector('#hide-button');
  const closeButton = document.querySelector('#close-button');
  const messageBubble = document.querySelector('#message-bubble');
  const announcer = document.querySelector('#announcer');

  const fallbackManifest = {
    roleName: '豆豆',
    standardPose: {
      image: 'assets/dog.png',
      transitionMs: 220,
      holdMs: 160,
    },
    behavior: {
      autoSleepEnabled: true,
      inactivitySleepMs: 30000,
      sleepEnterSkillId: 'sleep-enter',
      sleepLoopSkillId: 'sleep-loop',
      wakeSkillId: 'wake-up',
      wakeOnPointer: true,
      stateAnchor: { mode: 'bottom-center', x: 0.5, y: 1 },
    },
    categories: [
      { id: 'daily', name: '日常动作', order: 10 },
      { id: 'scene', name: '场景动作', order: 20 },
    ],
    skills: [
      {
        id: 'idle-breath',
        name: '标准待机',
        category: 'daily',
        type: 'transparent',
        source: 'assets/media/doudou-idle.webm',
        muted: true,
        transition: 'standard',
        visual: { scale: 0.86, offsetX: 0, offsetY: 1 },
      },
      {
        id: 'spin',
        name: '原地转圈',
        category: 'daily',
        type: 'transparent',
        source: 'assets/media/doudou-spin.webm',
        muted: true,
        transition: 'standard',
        visual: { scale: 1.24, offsetX: 0, offsetY: 0 },
      },
      {
        id: 'sleep-enter',
        name: '进入睡眠',
        category: 'daily',
        type: 'transparent',
        source: 'assets/media/doudou-sleep-enter.webm',
        muted: true,
        transition: 'standard',
        visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
      },
      {
        id: 'sleep-loop',
        name: '睡觉呼吸',
        category: 'daily',
        type: 'transparent',
        source: 'assets/media/doudou-sleep-loop.webm',
        muted: true,
        transition: 'standard',
        visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
      },
      {
        id: 'wake-up',
        name: '醒来',
        category: 'daily',
        type: 'transparent',
        source: 'assets/media/doudou-wake.webm',
        muted: true,
        transition: 'standard',
        visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
      },
      {
        id: 'grass',
        name: '滚草地',
        category: 'scene',
        type: 'scene',
        source: 'assets/media/doudou-grass.mp4',
        muted: false,
        transition: 'scene-fade',
        visual: { scale: 1, offsetX: 0, offsetY: 0 },
      },
    ],
  };

  let manifest = fallbackManifest;
  let skillsById = new Map(fallbackManifest.skills.map((skill) => [skill.id, skill]));
  let mode = 'idle';
  let activeSkill = null;
  let actionToken = 0;
  let sceneWindowActive = false;
  let bubbleTimer = null;
  let lastPassthrough = null;

  function currentRoleName() {
    return manifest?.roleName || '当前角色';
  }
  let lastPointer = null;
  let dragging = false;
  let pressingPet = false;
  let dragPointerId = null;
  let dragPressOrigin = null;
  let idleAlphaMap = null;
  let idleAlphaWidth = 0;
  let idleAlphaHeight = 0;
  let activeStateVideo = null;
  let lastInteractionAt = Date.now();
  let petSuspended = false;
  let wakeAfterSleepEnter = false;
  let wakeSequenceStarting = false;
  let inactivityTimer = null;
  let startupState = 'static';
  let idlePresentationToken = 0;
  let randomBehaviorTimer = null;
  let randomBehaviorActive = false;
  let pendingRandomSkill = null;
  let qaForcedRandomBehavior = false;
  let latestCharacterSwitchId = 0;
  const videoAlphaCaches = new WeakMap();

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function announce(message) {
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  function showMessage(message, duration = 2600) {
    clearTimeout(bubbleTimer);
    messageBubble.textContent = message;
    messageBubble.hidden = false;
    bubbleTimer = setTimeout(() => {
      messageBubble.hidden = true;
    }, duration);
  }

  function setMode(nextMode, skill = activeSkill) {
    if (nextMode !== 'sleep-loop') cancelRandomBehaviorSchedule();
    mode = nextMode;
    activeSkill = skill || null;
    petCharacter.dataset.animationState = nextMode;
    if (activeSkill) petCharacter.dataset.activeSkill = activeSkill.id;
    else delete petCharacter.dataset.activeSkill;
    api.reportAnimationState({
      mode: nextMode,
      skillId: activeSkill?.id || null,
    });
    syncIdlePresentation();
  }

  function isCurrentAction(token) {
    return token === actionToken;
  }

  function getTransitionMs() {
    return Number(manifest?.standardPose?.transitionMs) || 220;
  }

  function getStandardHoldMs() {
    return Number(manifest?.standardPose?.holdMs) || 160;
  }

  function getInactivitySleepMs() {
    return Math.min(
      3600000,
      Math.max(5000, Number(manifest?.behavior?.inactivitySleepMs) || 30000),
    );
  }

  function getSleepSkills() {
    const behavior = manifest?.behavior || {};
    if (behavior.autoSleepEnabled !== true) return null;
    const sleepEnter = behavior.sleepEnterSkillId
      ? skillsById.get(behavior.sleepEnterSkillId)
      : null;
    const sleepLoop = behavior.sleepLoopSkillId
      ? skillsById.get(behavior.sleepLoopSkillId)
      : null;
    const wake = behavior.wakeSkillId ? skillsById.get(behavior.wakeSkillId) : null;
    if (!sleepLoop || sleepLoop.type !== 'transparent') return null;
    if (sleepEnter?.type !== 'transparent' || wake?.type !== 'transparent') return null;
    const rawAnchorX = Number(behavior.stateAnchor?.x);
    const rawAnchorY = Number(behavior.stateAnchor?.y);
    const anchor = {
      mode: 'bottom-center',
      x: Math.min(1, Math.max(0, Number.isFinite(rawAnchorX) ? rawAnchorX : 0.5)),
      y: Math.min(1, Math.max(0, Number.isFinite(rawAnchorY) ? rawAnchorY : 1)),
    };
    return { sleepEnter, sleepLoop, wake, anchor };
  }

  function getRandomBehaviorConfig() {
    const config = manifest?.behavior?.randomBehavior;
    if (!config || config.enabled !== true) return null;
    const intervalMinutes = Math.min(60, Math.max(5, Number(config.intervalMinutes) || 20));
    const sleepSkills = getSleepSkills();
    const reserved = new Set([
      manifest?.behavior?.idleSkillId || 'idle-breath',
      sleepSkills?.sleepEnter?.id,
      sleepSkills?.sleepLoop?.id,
      sleepSkills?.wake?.id,
    ]);
    const skills = (Array.isArray(config.skillIds) ? config.skillIds : [])
      .map((id) => skillsById.get(id))
      .filter((skill) => skill && !reserved.has(skill.id));
    if (skills.length === 0) return null;
    return { intervalMinutes, skills };
  }

  function cancelRandomBehaviorSchedule() {
    clearTimeout(randomBehaviorTimer);
    randomBehaviorTimer = null;
    delete petCharacter.dataset.randomBehaviorDueAt;
  }

  function scheduleRandomBehavior() {
    cancelRandomBehaviorSchedule();
    if (petSuspended || mode !== 'sleep-loop' || randomBehaviorActive) return;
    const config = getRandomBehaviorConfig();
    if (!config) return;
    const randomFactor = 0.7 + Math.random() * 0.6;
    const delayMs = Math.round(config.intervalMinutes * 60_000 * randomFactor);
    petCharacter.dataset.randomBehaviorDueAt = String(Date.now() + delayMs);
    randomBehaviorTimer = setTimeout(() => {
      randomBehaviorTimer = null;
      beginRandomBehavior();
    }, delayMs);
  }

  async function beginRandomBehavior(forcedSkillId = null) {
    if (petSuspended || mode !== 'sleep-loop' || randomBehaviorActive) return false;
    const config = getRandomBehaviorConfig();
    const selected = forcedSkillId
      ? skillsById.get(forcedSkillId)
      : config?.skills[Math.floor(Math.random() * config.skills.length)];
    if (!selected) return false;
    cancelRandomBehaviorSchedule();
    randomBehaviorActive = true;
    pendingRandomSkill = { ...selected, muted: true };
    announce(`${currentRoleName()}准备活动一下：${selected.name}`);
    await beginWakeSequence();
    return true;
  }

  function getOpeningSegments({ force = false } = {}) {
    const opening = manifest?.opening;
    if (!opening || (!force && opening.playOnStartup !== true)) return [];
    const plan = opening.plans?.find((item) => item.id === opening.currentPlanId);
    if (!plan || plan.enabled === false) return [];
    return (plan.segments || []).filter((segment) => segment.enabled !== false);
  }

  function playAndWaitForOpeningSegment(video, token, durationMs) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (completed) => {
        if (settled) return;
        settled = true;
        clearInterval(actionCheck);
        clearTimeout(timeout);
        video.onended = null;
        video.onerror = null;
        resolve(completed);
      };
      const actionCheck = setInterval(() => {
        if (!isCurrentAction(token) || petSuspended || mode !== 'opening') finish(false);
      }, 80);
      const expectedDurationMs = Number(durationMs);
      const timeout = setTimeout(
        () => finish(false),
        Math.min(90_000, Math.max(10_000,
          Number.isFinite(expectedDurationMs) && expectedDurationMs > 0
            ? expectedDurationMs + 5000
            : 20_000)),
      );
      video.onended = () => finish(true);
      video.onerror = () => finish(false);
      video.play().catch(() => finish(false));
    });
  }

  async function playOpeningSequence({ force = false } = {}) {
    const segments = getOpeningSegments({ force });
    if (segments.length === 0 || petSuspended) return false;
    const token = ++actionToken;
    cancelRandomBehaviorSchedule();
    setMode('opening', null);
    refreshPassthrough();
    for (const segment of segments) {
      if (!isCurrentAction(token) || petSuspended) return false;
      try {
        applySkillVisual(skillVideo, segment);
        const ready = await prepareMedia(skillVideo, segment, token);
        if (!ready || !isCurrentAction(token)) return false;
        activeSkill = segment;
        petCharacter.dataset.activeSkill = segment.id;
        petCharacter.classList.remove('is-standardizing');
        petCharacter.classList.add('is-playing-skill');
        api.reportAnimationState({ mode: 'opening', skillId: segment.id });
        announce(`正在播放开场：${segment.name}`);
        const completed = await playAndWaitForOpeningSegment(
          skillVideo,
          token,
          segment.durationMs,
        );
        if (!completed || !isCurrentAction(token)) throw new Error('开场片段播放未完成');
        petCharacter.classList.remove('is-playing-skill');
        petCharacter.classList.add('is-standardizing');
        await delay(getTransitionMs() + getStandardHoldMs());
        stopVideo(skillVideo);
      } catch (error) {
        if (!isCurrentAction(token)) return false;
        console.warn(`开场片段“${segment.name}”播放失败，已跳过`, error);
        petCharacter.classList.remove('is-playing-skill');
        petCharacter.classList.add('is-standardizing');
        await delay(getTransitionMs() + getStandardHoldMs());
        stopVideo(skillVideo);
      }
    }
    if (!isCurrentAction(token)) return false;
    stopVideo(skillVideo);
    petCharacter.classList.remove('is-playing-skill', 'is-standardizing');
    setMode('idle', null);
    lastInteractionAt = Date.now();
    refreshPassthrough();
    return true;
  }

  function applySkillVisual(video, skill) {
    const visual = skill?.visual || {};
    const scale = Math.min(1.8, Math.max(0.4, Number(visual.scale) || 1));
    const offsetX = Math.min(160, Math.max(-160, Number(visual.offsetX) || 0));
    const offsetY = Math.min(160, Math.max(-160, Number(visual.offsetY) || 0));
    video.style.setProperty('--skill-scale', String(scale));
    video.style.setProperty('--skill-offset-x', `${offsetX}px`);
    video.style.setProperty('--skill-offset-y', `${offsetY}px`);
  }

  function applyStateAnchor(video, anchor) {
    const rawX = Number(anchor?.x);
    const rawY = Number(anchor?.y);
    const x = Math.min(1, Math.max(0, Number.isFinite(rawX) ? rawX : 0.5));
    const y = Math.min(1, Math.max(0, Number.isFinite(rawY) ? rawY : 1));
    video.style.setProperty('--state-anchor-x', `${x * 100}%`);
    video.style.setProperty('--state-anchor-y', `${y * 100}%`);
    video.dataset.stateAnchor = 'bottom-center';
  }

  function getStandardIdleSkill() {
    const skill = skillsById.get(manifest?.behavior?.idleSkillId || 'idle-breath');
    return skill?.type === 'transparent' ? skill : null;
  }

  async function syncIdlePresentation() {
    const token = ++idlePresentationToken;
    const skill = getStandardIdleSkill();
    const shouldAnimate = (
      startupState === 'standard-idle' &&
      mode === 'idle' &&
      !petSuspended &&
      Boolean(skill)
    );
    if (!shouldAnimate) {
      petCharacter.classList.remove('is-idle-animated');
      idleVideo.pause();
      refreshPassthrough();
      return;
    }

    applySkillVisual(idleVideo, skill);
    idleVideo.loop = true;
    idleVideo.muted = skill.muted !== false;
    if (idleVideo.getAttribute('src') !== skill.source) {
      videoAlphaCaches.delete(idleVideo);
      idleVideo.src = skill.source;
      idleVideo.load();
    }

    try {
      await idleVideo.play();
      if (
        token !== idlePresentationToken ||
        startupState !== 'standard-idle' ||
        mode !== 'idle' ||
        petSuspended
      ) {
        idleVideo.pause();
        return;
      }
      cacheVideoAlpha(idleVideo);
      petCharacter.classList.add('is-idle-animated');
      refreshPassthrough();
    } catch (error) {
      if (token !== idlePresentationToken) return;
      petCharacter.classList.remove('is-idle-animated');
      console.warn('[豆豆桌宠] 标准待机动画播放失败，已回退到静止状态', error);
      refreshPassthrough();
    }
  }

  function cacheVideoAlpha(video) {
    if (!video?.videoWidth || !video?.videoHeight) return null;
    const cached = videoAlphaCaches.get(video);
    if (cached?.width === video.videoWidth && cached?.height === video.videoHeight) return cached;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const alphaMap = new Uint8Array(canvas.width * canvas.height);
      let visiblePixels = 0;
      for (let source = 3, target = 0; source < pixels.length; source += 4, target += 1) {
        const alpha = pixels[source];
        alphaMap[target] = alpha;
        if (alpha >= 24) visiblePixels += 1;
      }
      if (visiblePixels < 32) return null;
      const result = { map: alphaMap, width: canvas.width, height: canvas.height };
      videoAlphaCaches.set(video, result);
      return result;
    } catch (error) {
      console.warn('无法读取状态动画透明区域，改用动画边界响应鼠标', error);
      return null;
    }
  }

  function pointerHitsVideo(clientX, clientY, video) {
    if (!video) return false;
    const rect = video.getBoundingClientRect();
    const width = video.videoWidth || 1;
    const height = video.videoHeight || 1;
    const scale = Math.min(rect.width / width, rect.height / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const drawLeft = rect.left + (rect.width - drawWidth) / 2;
    const drawTop = rect.bottom - drawHeight;
    if (
      clientX < drawLeft ||
      clientX >= drawLeft + drawWidth ||
      clientY < drawTop ||
      clientY >= drawTop + drawHeight
    ) {
      return false;
    }
    const cache = cacheVideoAlpha(video);
    if (!cache) return true;
    const imageX = Math.min(
      cache.width - 1,
      Math.max(0, Math.floor(((clientX - drawLeft) / drawWidth) * cache.width)),
    );
    const imageY = Math.min(
      cache.height - 1,
      Math.max(0, Math.floor(((clientY - drawTop) / drawHeight) * cache.height)),
    );
    return cache.map[imageY * cache.width + imageX] >= 24;
  }

  function activateStateVideo(video, skill, anchor) {
    activeStateVideo = video;
    stateVideos.forEach((item) => {
      item.classList.toggle('is-active-state-video', item === video);
    });
    applySkillVisual(video, skill);
    applyStateAnchor(video, anchor);
    petCharacter.classList.remove('is-playing-skill', 'is-standardizing');
    petCharacter.classList.add('is-playing-state');
  }

  function clearStateVideos({ deferReset = false } = {}) {
    stateVideos.forEach((video) => {
      video.onended = null;
      video.loop = false;
      if (deferReset) video.pause();
      else stopVideo(video);
      video.classList.remove('is-active-state-video');
    });
    activeStateVideo = null;
    petCharacter.classList.remove('is-playing-state');
    if (deferReset) {
      setTimeout(() => stateVideos.forEach((video) => stopVideo(video)), getTransitionMs() + 40);
    }
  }

  function recordDirectInteraction({ wake = true } = {}) {
    if (petSuspended) return;
    if (qaForcedRandomBehavior) return;
    if (randomBehaviorActive) {
      randomBehaviorActive = false;
      pendingRandomSkill = null;
    }
    cancelRandomBehaviorSchedule();
    lastInteractionAt = Date.now();
    if (!wake || manifest?.behavior?.wakeOnPointer === false) return;
    if (mode === 'sleep-enter') {
      wakeAfterSleepEnter = true;
    } else if (mode === 'sleep-loop') {
      beginWakeSequence();
    }
  }

  function setPassthrough(enabled) {
    const nextValue = Boolean(enabled);
    if (nextValue === lastPassthrough) return;
    lastPassthrough = nextValue;
    api.setMousePassthrough(nextValue);
  }

  function cacheIdleAlpha() {
    if (!idleImage.naturalWidth || !idleImage.naturalHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = idleImage.naturalWidth;
    canvas.height = idleImage.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(idleImage, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    idleAlphaWidth = canvas.width;
    idleAlphaHeight = canvas.height;
    idleAlphaMap = new Uint8Array(idleAlphaWidth * idleAlphaHeight);
    let minimumX = idleAlphaWidth;
    let minimumY = idleAlphaHeight;
    let maximumX = -1;
    let maximumY = -1;

    for (let source = 3, target = 0; source < pixels.length; source += 4, target += 1) {
      const alpha = pixels[source];
      idleAlphaMap[target] = alpha;
      if (alpha >= 24) {
        const x = target % idleAlphaWidth;
        const y = Math.floor(target / idleAlphaWidth);
        minimumX = Math.min(minimumX, x);
        minimumY = Math.min(minimumY, y);
        maximumX = Math.max(maximumX, x);
        maximumY = Math.max(maximumY, y);
      }
    }

    if (maximumX >= minimumX && maximumY >= minimumY) {
      const rect = petCharacter.getBoundingClientRect();
      const stageRect = petStage.getBoundingClientRect();
      const scale = Math.min(rect.width / idleAlphaWidth, rect.height / idleAlphaHeight);
      const drawWidth = idleAlphaWidth * scale;
      const drawHeight = idleAlphaHeight * scale;
      const drawLeft = rect.left + (rect.width - drawWidth) / 2;
      const drawTop = rect.bottom - drawHeight;
      api.setPetVisualBounds({
        left: drawLeft + minimumX * scale - stageRect.left,
        top: drawTop + minimumY * scale - stageRect.top,
        right: drawLeft + (maximumX + 1) * scale - stageRect.left,
        bottom: drawTop + (maximumY + 1) * scale - stageRect.top,
      });
    }
  }

  function pointerHitsDog(clientX, clientY) {
    const rect = petCharacter.getBoundingClientRect();
    // During the first image decode there is no alpha map yet. Never depend
    // on :hover here: a click-through native window cannot acquire :hover,
    // which was the exact deadlock reported by the user. Use the character
    // rectangle briefly, then switch to pixel-accurate alpha as soon as the
    // image has been decoded.
    if (!idleAlphaMap) {
      return (
        clientX >= rect.left &&
        clientX < rect.right &&
        clientY >= rect.top &&
        clientY < rect.bottom
      );
    }
    const scale = Math.min(rect.width / idleAlphaWidth, rect.height / idleAlphaHeight);
    const drawWidth = idleAlphaWidth * scale;
    const drawHeight = idleAlphaHeight * scale;
    const drawLeft = rect.left + (rect.width - drawWidth) / 2;
    const drawTop = rect.bottom - drawHeight;
    if (
      clientX < drawLeft ||
      clientX >= drawLeft + drawWidth ||
      clientY < drawTop ||
      clientY >= drawTop + drawHeight
    ) {
      return false;
    }
    const imageX = Math.min(
      idleAlphaWidth - 1,
      Math.max(0, Math.floor(((clientX - drawLeft) / drawWidth) * idleAlphaWidth)),
    );
    const imageY = Math.min(
      idleAlphaHeight - 1,
      Math.max(0, Math.floor(((clientY - drawTop) / drawHeight) * idleAlphaHeight)),
    );
    return idleAlphaMap[imageY * idleAlphaWidth + imageX] >= 24;
  }

  function pointerIsInteractive(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    const overControls = Boolean(target?.closest('.hover-controls'));
    const visibleVideo = activeStateVideo || (
      petCharacter.classList.contains('is-idle-animated') ? idleVideo : null
    );
    const overDog = visibleVideo
      ? pointerHitsVideo(clientX, clientY, visibleVideo)
      : pointerHitsDog(clientX, clientY);
    petShell.classList.toggle('is-hovering-dog', overDog || overControls);
    return overDog || overControls;
  }

  function modeAllowsPetInteraction() {
    return [
      'idle',
      'standard-in',
      'standard-out',
      'transparent',
      'sleep-loading',
      'sleep-enter',
      'sleep-loop',
      'waking',
    ].includes(mode);
  }

  function refreshPassthrough() {
    if (!modeAllowsPetInteraction()) {
      petShell.classList.remove('is-hovering-dog');
      setPassthrough(true);
      return;
    }
    if (dragging) {
      setPassthrough(false);
      return;
    }
    if (!lastPointer) {
      setPassthrough(false);
      return;
    }
    setPassthrough(!pointerIsInteractive(lastPointer.x, lastPointer.y));
  }

  function stopVideo(video) {
    video.pause();
    try {
      video.currentTime = 0;
    } catch (_error) {
      // The source may not have loaded yet; pausing is sufficient.
    }
  }

  function unloadRoleMedia() {
    idlePresentationToken += 1;
    const videos = [idleVideo, skillVideo, sceneVideo, ...stateVideos];
    videos.forEach((video) => {
      video.onended = null;
      video.loop = false;
      video.pause();
      video.removeAttribute('src');
      video.load();
      videoAlphaCaches.delete(video);
    });
    idleImage.removeAttribute('src');
    idleAlphaMap = null;
    idleAlphaWidth = 0;
    idleAlphaHeight = 0;
    activeStateVideo = null;
    petCharacter.classList.remove(
      'is-idle-animated',
      'is-playing-skill',
      'is-standardizing',
      'is-playing-state',
    );
  }

  function waitForImageReady(image, timeoutMs = 6000) {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('角色主图加载超时')), timeoutMs);
      const finish = (error = null) => {
        clearTimeout(timeout);
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
        if (error) reject(error);
        else resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error('角色主图读取失败'));
      image.addEventListener('load', onLoad, { once: true });
      image.addEventListener('error', onError, { once: true });
    });
  }

  function waitForMediaReady(video, timeoutMs = 6000) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('视频加载超时')), timeoutMs);
      const finish = (error = null) => {
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('error', onError);
        if (error) reject(error);
        else resolve();
      };
      const onReady = () => finish();
      const onError = () => finish(video.error || new Error('视频读取失败'));
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }

  async function prepareMedia(video, skill, token) {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!isCurrentAction(token)) return false;
      try {
        if (video.getAttribute('src') !== skill.source || attempt > 0) {
          stopVideo(video);
          video.src = skill.source;
          video.load();
        }
        video.muted = skill.muted !== false;
        await waitForMediaReady(video);
        if (!isCurrentAction(token)) return false;
        video.currentTime = 0;
        return true;
      } catch (error) {
        lastError = error;
        console.warn(`视频读取第 ${attempt + 1} 次尝试失败`, error);
      }
    }
    throw lastError || new Error('视频读取失败');
  }

  async function recoverFromStateFailure(token, error) {
    if (!isCurrentAction(token)) return;
    console.error('自动睡眠动画播放失败', error);
    clearStateVideos();
    wakeAfterSleepEnter = false;
    wakeSequenceStarting = false;
    randomBehaviorActive = false;
    pendingRandomSkill = null;
    qaForcedRandomBehavior = false;
    setMode('idle', null);
    lastInteractionAt = Date.now();
      showMessage('无互动状态动画没有播放成功，请在技能库检查素材。');
    refreshPassthrough();
  }

  async function finishWakeSequence(token) {
    if (!isCurrentAction(token) || mode !== 'waking') return;
    const randomSkill = randomBehaviorActive ? pendingRandomSkill : null;
    clearStateVideos({ deferReset: true });
    wakeAfterSleepEnter = false;
    wakeSequenceStarting = false;
    setMode('idle', null);
    if (randomSkill) {
      pendingRandomSkill = null;
      refreshPassthrough();
      await delay(getTransitionMs() + getStandardHoldMs());
      if (!randomBehaviorActive || petSuspended || mode !== 'idle') return;
      if (randomSkill.type === 'scene') await playSceneSkill(randomSkill);
      else await playTransparentSkill(randomSkill);
      return;
    }
    randomBehaviorActive = false;
    pendingRandomSkill = null;
    lastInteractionAt = Date.now();
    announce(`${currentRoleName()}已恢复待机`);
    refreshPassthrough();
  }

  async function beginWakeSequence() {
    if (petSuspended) return;
    if (mode === 'sleep-enter') {
      wakeAfterSleepEnter = true;
      return;
    }
    if (mode !== 'sleep-loop' || wakeSequenceStarting) return;
    const sleepSkills = getSleepSkills();
    if (!sleepSkills) return;

    wakeSequenceStarting = true;
    const token = ++actionToken;
    wakeAfterSleepEnter = false;
    stateVideos.forEach((video) => { video.onended = null; });
    sleepLoopVideo.pause();
    if (!sleepSkills.wake) {
      setMode('waking', null);
      clearStateVideos({ deferReset: true });
      refreshPassthrough();
      await delay(getTransitionMs());
      await finishWakeSequence(token);
      return;
    }
    try {
      const ready = await prepareMedia(wakeVideo, sleepSkills.wake, token);
      if (!ready || !isCurrentAction(token) || petSuspended) return;
      cacheVideoAlpha(wakeVideo);
      activateStateVideo(wakeVideo, sleepSkills.wake, sleepSkills.anchor);
      setMode('waking', sleepSkills.wake);
      refreshPassthrough();
      wakeVideo.onended = () => finishWakeSequence(token);
      await wakeVideo.play();
    } catch (error) {
      await recoverFromStateFailure(token, error);
    }
  }

  async function beginSleepLoop(token, sleepSkills) {
    if (!isCurrentAction(token) || petSuspended || mode !== 'sleep-enter') return;
    sleepEnterVideo.onended = null;
    sleepEnterVideo.pause();
    if (wakeAfterSleepEnter) {
      setMode('sleep-loop', sleepSkills.sleepLoop);
      await beginWakeSequence();
      return;
    }

    try {
      activateStateVideo(sleepLoopVideo, sleepSkills.sleepLoop, sleepSkills.anchor);
      setMode('sleep-loop', sleepSkills.sleepLoop);
      qaForcedRandomBehavior = false;
      sleepLoopVideo.loop = true;
      sleepLoopVideo.currentTime = 0;
      refreshPassthrough();
      await sleepLoopVideo.play();
      if (isCurrentAction(token) && mode === 'sleep-loop') scheduleRandomBehavior();
      if (wakeAfterSleepEnter && isCurrentAction(token)) await beginWakeSequence();
    } catch (error) {
      await recoverFromStateFailure(token, error);
    }
  }

  async function beginSleepSequence() {
    if (petSuspended || mode !== 'idle' || dragging || pressingPet) return;
    const sleepSkills = getSleepSkills();
    if (!sleepSkills) return;

    const interactionSnapshot = lastInteractionAt;
    const token = ++actionToken;
    wakeAfterSleepEnter = false;
    setMode('sleep-loading', sleepSkills.sleepEnter || sleepSkills.sleepLoop);
    refreshPassthrough();
    try {
      const mediaAssignments = [
        [sleepEnterVideo, sleepSkills.sleepEnter],
        [sleepLoopVideo, sleepSkills.sleepLoop],
        [wakeVideo, sleepSkills.wake],
      ].filter(([, skill]) => skill);
      const results = await Promise.all(
        mediaAssignments.map(([video, skill]) => prepareMedia(video, skill, token)),
      );
      if (results.some((ready) => !ready) || !isCurrentAction(token) || petSuspended) return;
      if (lastInteractionAt !== interactionSnapshot) {
        clearStateVideos();
        setMode('idle', null);
        refreshPassthrough();
        return;
      }

      if (sleepSkills.sleepEnter) cacheVideoAlpha(sleepEnterVideo);
      cacheVideoAlpha(sleepLoopVideo);
      if (sleepSkills.wake) cacheVideoAlpha(wakeVideo);
      setMode('sleep-enter', sleepSkills.sleepEnter || sleepSkills.sleepLoop);
      if (sleepSkills.sleepEnter) {
        activateStateVideo(sleepEnterVideo, sleepSkills.sleepEnter, sleepSkills.anchor);
        refreshPassthrough();
        announce('角色进入无互动状态');
        sleepEnterVideo.onended = () => beginSleepLoop(token, sleepSkills);
        await sleepEnterVideo.play();
      } else {
        await beginSleepLoop(token, sleepSkills);
      }
    } catch (error) {
      await recoverFromStateFailure(token, error);
    }
  }

  function checkInactivity() {
    if (petSuspended || mode !== 'idle' || dragging || pressingPet || randomBehaviorActive) return;
    if (!getSleepSkills()) return;
    if (Date.now() - lastInteractionAt < getInactivitySleepMs()) return;
    beginSleepSequence();
  }

  function startInactivityTimer() {
    clearInterval(inactivityTimer);
    inactivityTimer = setInterval(checkInactivity, 500);
  }

  async function interruptAction() {
    actionToken += 1;
    cancelRandomBehaviorSchedule();
    randomBehaviorActive = false;
    pendingRandomSkill = null;
    qaForcedRandomBehavior = false;
    const shouldRestoreScene = sceneWindowActive;
    setMode('interrupting', null);
    stopVideo(skillVideo);
    stopVideo(sceneVideo);
    clearStateVideos();
    wakeAfterSleepEnter = false;
    wakeSequenceStarting = false;
    petCharacter.classList.remove('is-playing-skill', 'is-standardizing', 'is-playing-state');
    sceneLayer.classList.remove('is-visible');
    sceneLayer.hidden = true;
    petStage.classList.remove('is-hidden');
    if (shouldRestoreScene) {
      sceneWindowActive = false;
      await api.exitScene();
    }
    setMode('idle', null);
    lastInteractionAt = Date.now();
    refreshPassthrough();
  }

  async function holdStandardPose(token, phase, skill) {
    setMode(phase, skill);
    petCharacter.classList.remove('is-playing-skill');
    petCharacter.classList.add('is-standardizing');
    refreshPassthrough();
    await delay(getStandardHoldMs());
    return isCurrentAction(token);
  }

  async function finishTransparentSkill(token, skill, { failed = false } = {}) {
    if (!isCurrentAction(token) || mode !== 'transparent') return;
    setMode('standard-out', skill);
    petCharacter.classList.remove('is-playing-skill');
    petCharacter.classList.add('is-standardizing');
    refreshPassthrough();
    await delay(getTransitionMs() + getStandardHoldMs());
    if (!isCurrentAction(token)) return;
    stopVideo(skillVideo);
    petCharacter.classList.remove('is-standardizing');
    setMode('idle', null);
    announce(failed ? `${skill.name}播放失败` : `${skill.name}完成`);
    refreshPassthrough();
    if (randomBehaviorActive) {
      await returnToSleepAfterRandomBehavior();
    } else {
      lastInteractionAt = Date.now();
    }
  }

  async function playTransparentSkill(skill) {
    const token = ++actionToken;
    if (!(await holdStandardPose(token, 'standard-in', skill))) return;

    try {
      applySkillVisual(skillVideo, skill);
      const ready = await prepareMedia(skillVideo, skill, token);
      if (!ready || !isCurrentAction(token)) return;
      setMode('transparent', skill);
      petCharacter.classList.remove('is-standardizing');
      petCharacter.classList.add('is-playing-skill');
      refreshPassthrough();
      announce(`${currentRoleName()}开始${skill.name}`);
      await skillVideo.play();
    } catch (error) {
      if (!isCurrentAction(token)) return;
      console.error(`透明技能“${skill.name}”播放失败`, error);
      showMessage(`${skill.name}没有播放成功，请检查素材。`);
      if (mode !== 'transparent') setMode('transparent', skill);
      await finishTransparentSkill(token, skill, { failed: true });
    }
  }

  async function finishSceneSkill(token, skill, { failed = false } = {}) {
    if (!isCurrentAction(token) || !['scene', 'scene-loading'].includes(mode)) return;
    setMode('scene-ending', skill);
    sceneLayer.classList.remove('is-visible');
    await delay(260);
    if (!isCurrentAction(token)) return;
    stopVideo(sceneVideo);
    sceneLayer.hidden = true;
    if (sceneWindowActive) {
      sceneWindowActive = false;
      await api.exitScene();
    }
    if (!isCurrentAction(token)) return;
    petStage.classList.remove('is-hidden');
    petCharacter.classList.add('is-standardizing');
    setMode('standard-out', skill);
    await delay(getTransitionMs() + getStandardHoldMs());
    if (!isCurrentAction(token)) return;
    petCharacter.classList.remove('is-standardizing');
    setMode('idle', null);
    announce(failed ? `${skill.name}播放失败` : `${skill.name}完成`);
    refreshPassthrough();
    if (randomBehaviorActive) {
      await returnToSleepAfterRandomBehavior();
    } else {
      lastInteractionAt = Date.now();
    }
  }

  async function returnToSleepAfterRandomBehavior() {
    if (!randomBehaviorActive || petSuspended || mode !== 'idle') return;
    randomBehaviorActive = false;
    pendingRandomSkill = null;
    lastInteractionAt = Date.now() - getInactivitySleepMs() - 1;
    announce(`${currentRoleName()}完成活动，返回无互动状态`);
    await beginSleepSequence();
  }

  async function playSceneSkill(skill) {
    const token = ++actionToken;
    if (!(await holdStandardPose(token, 'standard-in', skill))) return;

    setMode('scene-loading', skill);
    petCharacter.classList.remove('is-standardizing');
    petStage.classList.add('is-hidden');
    refreshPassthrough();
    await delay(getTransitionMs());
    if (!isCurrentAction(token)) return;

    const entered = await api.enterScene();
    if (!entered || !isCurrentAction(token)) {
      petStage.classList.remove('is-hidden');
      setMode('idle', null);
      refreshPassthrough();
      if (randomBehaviorActive && isCurrentAction(token)) {
        await returnToSleepAfterRandomBehavior();
      }
      return;
    }
    sceneWindowActive = true;

    try {
      applySkillVisual(sceneVideo, skill);
      const ready = await prepareMedia(sceneVideo, skill, token);
      if (!ready || !isCurrentAction(token)) return;
      setMode('scene', skill);
      sceneLayer.hidden = false;
      requestAnimationFrame(() => sceneLayer.classList.add('is-visible'));
      announce(`${currentRoleName()}开始${skill.name}`);
      await sceneVideo.play();
    } catch (error) {
      if (!isCurrentAction(token)) return;
      console.error(`场景技能“${skill.name}”播放失败`, error);
      showMessage(`${skill.name}没有播放成功，请检查素材。`);
      if (mode !== 'scene') setMode('scene', skill);
      await finishSceneSkill(token, skill, { failed: true });
    }
  }

  function normalizeCommand(command) {
    if (typeof command === 'string') return { skillId: command, source: 'legacy' };
    if (!command || typeof command.skillId !== 'string') return null;
    return {
      skillId: command.skillId,
      source: typeof command.source === 'string' ? command.source : 'unknown',
    };
  }

  async function runCommand(command) {
    const normalized = normalizeCommand(command);
    if (!normalized) return;
    recordDirectInteraction();
    const skill = skillsById.get(normalized.skillId);
    if (!skill) {
      showMessage('没有找到这个技能，请检查技能清单。');
      return;
    }

    if (mode !== 'idle') {
      // Explicit menu/tray actions may replace the current skill. Future
      // gesture and voice commands are ignored while a skill is playing.
      if (!['menu', 'tray', 'qa', 'legacy'].includes(normalized.source)) return;
      await interruptAction();
    }

    if (skill.type === 'scene') await playSceneSkill(skill);
    else await playTransparentSkill(skill);
  }

  skillVideo.addEventListener('ended', () => {
    if (mode === 'transparent' && activeSkill) {
      finishTransparentSkill(actionToken, activeSkill);
    }
  });

  sceneVideo.addEventListener('ended', () => {
    if (mode === 'scene' && activeSkill) {
      finishSceneSkill(actionToken, activeSkill);
    }
  });

  petCharacter.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    recordDirectInteraction({ wake: false });
    if (!dragging && !mode.startsWith('scene') && mode !== 'interrupting') {
      api.showContextMenu();
    }
  });

  petCharacter.addEventListener('keydown', (event) => {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault();
      recordDirectInteraction({ wake: false });
      if (!dragging && !mode.startsWith('scene') && mode !== 'interrupting') {
        api.showContextMenu();
      }
    }
  });

  petCharacter.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    recordDirectInteraction();
    if (mode !== 'idle') return;
    if (event.target.closest('button')) return;
    event.preventDefault();
    pressingPet = true;
    dragging = false;
    dragPointerId = event.pointerId;
    dragPressOrigin = { x: event.clientX, y: event.clientY };
    petCharacter.setPointerCapture(event.pointerId);
  });

  petCharacter.addEventListener('pointermove', (event) => {
    if (!pressingPet || event.pointerId !== dragPointerId) return;
    recordDirectInteraction({ wake: false });
    if ((event.buttons & 1) === 0) {
      completeDrag();
      return;
    }
    if (!dragging) {
      const deltaX = event.clientX - dragPressOrigin.x;
      const deltaY = event.clientY - dragPressOrigin.y;
      if (deltaX * deltaX + deltaY * deltaY < 64) return;
      dragging = true;
      petCharacter.classList.add('is-held');
      setPassthrough(false);
      api.beginDrag();
    }
    api.dragTo();
  });

  function completeDrag() {
    if (!pressingPet) return;
    const wasDragging = dragging;
    const pointerId = dragPointerId;
    pressingPet = false;
    dragging = false;
    dragPointerId = null;
    dragPressOrigin = null;
    if (pointerId !== null && petCharacter.hasPointerCapture(pointerId)) {
      petCharacter.releasePointerCapture(pointerId);
    }
    petCharacter.classList.remove('is-held');
    lastPointer = null;
    if (wasDragging) api.endDrag();
    setPassthrough(false);
  }

  function finishDrag(event) {
    if (!pressingPet || event.pointerId !== dragPointerId) return;
    completeDrag();
  }

  petCharacter.addEventListener('pointerup', finishDrag);
  petCharacter.addEventListener('pointercancel', finishDrag);
  // Resizing the native window into the fixed drag overlay can make Chromium
  // briefly report lost pointer capture even though the mouse button is still
  // held. Do not end the drag for that synthetic transition; the full-screen
  // overlay receives the real pointerup/pointercancel event, while the main
  // process continues following the system cursor independently.
  window.addEventListener('pointerup', finishDrag, true);
  window.addEventListener('pointercancel', finishDrag, true);

  hideButton.addEventListener('click', (event) => {
    event.stopPropagation();
    api.requestLifecycle('hide');
  });

  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    api.requestLifecycle('close-to-tray');
  });

  window.addEventListener('mousemove', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    refreshPassthrough();
  });

  window.addEventListener('mouseleave', () => {
    petShell.classList.remove('is-hovering-dog');
  });

  window.addEventListener('blur', () => {
    if (pressingPet) completeDrag();
  });

  document.addEventListener('dragstart', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pet-qa-force-sleep', () => {
    lastInteractionAt = 0;
    checkInactivity();
  });
  document.addEventListener('pet-qa-force-random', () => {
    qaForcedRandomBehavior = true;
    beginRandomBehavior().then((started) => {
      if (!started) qaForcedRandomBehavior = false;
    });
  });
  document.addEventListener('pet-qa-force-random-scene', () => {
    qaForcedRandomBehavior = true;
    beginRandomBehavior('grass').then((started) => {
      if (!started) qaForcedRandomBehavior = false;
    });
  });
  document.addEventListener('pet-qa-play-opening', () => {
    if (mode !== 'idle') return;
    playOpeningSequence({ force: true });
  });

  api.onSuspended(async (state) => {
    petSuspended = state?.reason !== 'appearance-change';
    await interruptAction();
    clearTimeout(bubbleTimer);
    messageBubble.hidden = true;
  });

  api.onPrepareLifecycle(async () => {
    petSuspended = true;
    await interruptAction();
    petStage.classList.remove('is-arriving');
    petStage.classList.add('is-leaving');
    setPassthrough(true);
  });

  api.onResumed(async () => {
    petSuspended = false;
    await interruptAction();
    petStage.classList.remove('is-leaving', 'is-hidden');
    petStage.classList.add('is-arriving');
    setTimeout(() => petStage.classList.remove('is-arriving'), 500);
    lastPointer = null;
    setPassthrough(false);
  });

  petShell.addEventListener('mouseenter', () => {
    if (modeAllowsPetInteraction()) setPassthrough(false);
  });

  // The main process probes the global cursor position even while this
  // transparent window is ignoring mouse input. This breaks the deadlock
  // where Windows stops forwarding mousemove events and the pet would
  // otherwise remain permanently click-through.
  api.onPointerProbe((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    lastPointer = { x: point.x, y: point.y };
    const interactive = dragging || (
      modeAllowsPetInteraction() && pointerIsInteractive(point.x, point.y)
    );
    if (interactive) recordDirectInteraction();
    api.reportPointerProbe({
      x: point.x,
      y: point.y,
      interactive,
      mode,
    });
    // Bypass the renderer-side cache: the native window may have changed
    // state while this page was blurred, suspended, or showing a scene.
    api.setMousePassthrough(!interactive);
  });

  api.onDragOverlay((state) => {
    if (state?.active) {
      const x = Number.isFinite(state.x) ? state.x : 0;
      const y = Number.isFinite(state.y) ? state.y : 0;
      const size = Number.isFinite(state.size) ? state.size : 440;
      petStage.style.setProperty('--drag-pet-x', `${x}px`);
      petStage.style.setProperty('--drag-pet-y', `${y}px`);
      petStage.style.setProperty('--drag-pet-size', `${size}px`);
      petStage.classList.add('is-drag-overlay');
      petStage.classList.toggle('is-being-dragged', state.dragging === true);
      if (!state.dragging) requestAnimationFrame(cacheIdleAlpha);
    } else {
      petStage.classList.remove('is-drag-overlay', 'is-being-dragged');
      petStage.style.removeProperty('--drag-pet-x');
      petStage.style.removeProperty('--drag-pet-y');
      petStage.style.removeProperty('--drag-pet-size');
    }
  });

  api.onSceneLayout((state) => {
    if (state?.active) {
      sceneLayer.style.setProperty('--scene-x', `${Number(state.x) || 0}px`);
      sceneLayer.style.setProperty('--scene-y', `${Number(state.y) || 0}px`);
      sceneLayer.style.setProperty('--scene-size', `${Number(state.size) || 460}px`);
      sceneLayer.classList.add('is-local-scene');
    } else {
      sceneLayer.classList.remove('is-local-scene');
      sceneLayer.style.removeProperty('--scene-x');
      sceneLayer.style.removeProperty('--scene-y');
      sceneLayer.style.removeProperty('--scene-size');
    }
  });

  function applyAppearance(appearance) {
    const scale = Math.min(1.4, Math.max(0.6, Number(appearance?.scale) || 1));
    startupState = appearance?.startupState === 'standard-idle' ? 'standard-idle' : 'static';
    petShell.style.setProperty('--pet-scale', String(scale));
    requestAnimationFrame(cacheIdleAlpha);
    syncIdlePresentation();
  }

  function configureStateMedia() {
    const sleepSkills = getSleepSkills();
    const assignments = [
      [sleepEnterVideo, sleepSkills?.sleepEnter || null],
      [sleepLoopVideo, sleepSkills?.sleepLoop || null],
      [wakeVideo, sleepSkills?.wake || null],
    ];
    assignments.forEach(([video, skill]) => {
      if (!skill) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        videoAlphaCaches.delete(video);
        return;
      }
      applySkillVisual(video, skill);
      applyStateAnchor(video, sleepSkills.anchor);
      if (video.getAttribute('src') !== skill.source) {
        videoAlphaCaches.delete(video);
        video.src = skill.source;
        video.load();
      }
    });
  }

  function applyManifest(nextManifest) {
    if (!nextManifest?.skills || !Array.isArray(nextManifest.skills)) return;
    manifest = nextManifest;
    skillsById = new Map(manifest.skills.map((skill) => [skill.id, skill]));
    petCharacter.style.setProperty('--pose-transition-ms', `${getTransitionMs()}ms`);
    const standardImage = manifest.standardPose?.image || 'assets/dog.png';
    if (idleImage.getAttribute('src') !== standardImage) {
      idleImage.src = standardImage;
      idleImage.addEventListener('load', cacheIdleAlpha, { once: true });
    } else if (idleImage.complete) {
      cacheIdleAlpha();
    }
    configureStateMedia();
    syncIdlePresentation();
    if (mode === 'sleep-loop') scheduleRandomBehavior();
  }

  async function performCharacterSwitch(payload) {
    const switchId = Number(payload?.switchId);
    if (
      !Number.isFinite(switchId) ||
      switchId <= latestCharacterSwitchId ||
      !payload?.manifest?.standardPose?.image ||
      !Array.isArray(payload?.manifest?.skills)
    ) {
      if (Number.isFinite(switchId)) {
        api.reportCharacterSwitch({
          switchId,
          ok: false,
          error: '角色切换数据无效或已经过期。',
        });
      }
      return;
    }
    latestCharacterSwitchId = switchId;
    petStage.classList.add('is-hidden');
    setPassthrough(true);
    try {
      await delay(190);
      await interruptAction();
      petStage.classList.add('is-hidden');
      unloadRoleMedia();
      applyManifest(payload.manifest);
      applyAppearance(payload.appearance);
      await waitForImageReady(idleImage);
      cacheIdleAlpha();
      setMode('idle', null);
      petSuspended = false;
      lastInteractionAt = Date.now();
      await syncIdlePresentation();
      petCharacter.setAttribute(
        'aria-label',
        `${payload.manifest.roleName || '当前角色'}。右键打开菜单，拖动可以移动角色。`,
      );
      petStage.classList.remove('is-leaving');
      petStage.classList.remove('is-hidden');
      setPassthrough(false);
      api.reportCharacterSwitch({ switchId, ok: true });
    } catch (error) {
      console.error('[豆豆桌宠] 角色切换渲染失败', error);
      petStage.classList.remove('is-hidden', 'is-leaving');
      setMode('idle', null);
      setPassthrough(false);
      api.reportCharacterSwitch({
        switchId,
        ok: false,
        error: error?.message || '角色素材加载失败。',
      });
    }
  }

  async function initialize() {
    const [loadedManifest, appearance] = await Promise.all([
      api.getSkillManifest(),
      api.getAppearance(),
    ]);
    if (loadedManifest?.skills) applyManifest(loadedManifest);
    else applyManifest(fallbackManifest);
    applyAppearance(appearance);

    const firstTransparent = manifest.skills.find((skill) => skill.type === 'transparent');
    const firstScene = manifest.skills.find((skill) => skill.type === 'scene');
    if (firstTransparent) {
      skillVideo.src = firstTransparent.source;
      skillVideo.load();
    }
    if (firstScene) {
      sceneVideo.src = firstScene.source;
      sceneVideo.load();
    }
    setMode('idle', null);
    petSuspended = false;
    await playOpeningSequence();
    lastInteractionAt = Date.now();
    startInactivityTimer();
    setPassthrough(false);
  }

  const initialization = initialize().catch((error) => {
    console.error('动画框架初始化失败', error);
    showMessage('技能清单加载失败，已使用内置素材。');
    manifest = fallbackManifest;
    skillsById = new Map(fallbackManifest.skills.map((skill) => [skill.id, skill]));
    configureStateMedia();
    petSuspended = false;
    lastInteractionAt = Date.now();
    startInactivityTimer();
    setMode('idle', null);
    setPassthrough(false);
  });

  api.onCommand((command) => {
    initialization.then(() => runCommand(command));
  });

  api.onSkillManifestUpdated((nextManifest) => {
    initialization.then(async () => {
      await interruptAction();
      applyManifest(nextManifest);
    });
  });

  api.onAppearanceChanged((appearance) => {
    initialization.then(() => applyAppearance(appearance));
  });

  api.onTestInactivityFlow(() => {
    initialization.then(async () => {
      await interruptAction();
      lastInteractionAt = Date.now() - getInactivitySleepMs() - 1;
      await beginSleepSequence();
    });
  });

  api.onCharacterSwitch((payload) => {
    initialization.then(() => performCharacterSwitch(payload));
  });
})();
