(() => {
  'use strict';

  const api = window.settingsAPI;
  if (!api) throw new Error('设置窗口 IPC 未就绪');

  const panelTitles = {
    roles: '角色管理', appearance: '外观与大小', skills: '技能库', opening: '开场方案',
    gestures: '手势绑定', voice: '语音与声音', camera: '摄像头和麦克风',
    rules: '固定规则', random: '随机行为', general: '通用设置',
  };

  const roleName = document.querySelector('#role-name');
  const roleAvatar = document.querySelector('#role-avatar');
  const createCharacterButton = document.querySelector('#create-character-button');
  const importCharacterPackageButton = document.querySelector('#import-character-package-button');
  const characterCount = document.querySelector('#character-count');
  const characterGroups = document.querySelector('#character-groups');
  const characterDialog = document.querySelector('#character-dialog');
  const characterForm = document.querySelector('#character-form');
  const characterDialogKicker = document.querySelector('#character-dialog-kicker');
  const characterDialogTitle = document.querySelector('#character-dialog-title');
  const characterCategory = document.querySelector('#character-category');
  const characterName = document.querySelector('#character-name');
  const chooseCharacterImageButton = document.querySelector('#choose-character-image');
  const characterImageStatus = document.querySelector('#character-image-status');
  const characterIdleModeInputs = [...document.querySelectorAll('input[name="character-idle-mode"]')];
  const characterIdleMaterial = document.querySelector('#character-idle-material');
  const chooseCharacterIdleButton = document.querySelector('#choose-character-idle');
  const characterIdleStatus = document.querySelector('#character-idle-status');
  const characterScale = document.querySelector('#character-scale');
  const characterScaleOutput = document.querySelector('#character-scale-output');
  const characterImagePreview = document.querySelector('#character-image-preview');
  const characterIdlePreview = document.querySelector('#character-idle-preview');
  const characterPreviewEmpty = document.querySelector('#character-preview-empty');
  const characterDialogError = document.querySelector('#character-dialog-error');
  const saveCharacterButton = document.querySelector('#save-character-button');
  const panelTitle = document.querySelector('#panel-title');
  const saveStatus = document.querySelector('#save-status');
  const nav = document.querySelector('#settings-nav');
  const skillList = document.querySelector('#skill-list');
  const skillSummary = document.querySelector('#skill-summary');
  const importButton = document.querySelector('#import-skill-button');
  const restoreSkillsButton = document.querySelector('#restore-skills-button');
  const scaleSlider = document.querySelector('#scale-slider');
  const scaleOutput = document.querySelector('#scale-output');
  const appearanceSizeTitle = document.querySelector('#appearance-size-title');
  const appearanceSizeDescription = document.querySelector('#appearance-size-description');
  const startupStateTitle = document.querySelector('#startup-state-title');
  const voicePlaceholderDescription = document.querySelector('#voice-placeholder-description');
  const startupStateInputs = [...document.querySelectorAll('input[name="startup-state"]')];
  const dialog = document.querySelector('#skill-dialog');
  const form = document.querySelector('#skill-form');
  const dialogKicker = document.querySelector('#dialog-kicker');
  const dialogTitle = document.querySelector('#dialog-title');
  const preview = document.querySelector('#skill-preview');
  const previewEmpty = document.querySelector('#preview-empty');
  const skillName = document.querySelector('#skill-name');
  const skillCategory = document.querySelector('#skill-category');
  const skillType = document.querySelector('#skill-type');
  const skillPinned = document.querySelector('#skill-pinned');
  const skillMuted = document.querySelector('#skill-muted');
  const saveSkillButton = document.querySelector('#save-skill-button');
  const dialogError = document.querySelector('#dialog-error');
  const calibrationStage = document.querySelector('#calibration-stage');
  const previewSeek = document.querySelector('#preview-seek');
  const previewTime = document.querySelector('#preview-time');
  const formGrid = document.querySelector('.form-grid');
  const visualCalibration = document.querySelector('#visual-calibration');
  const skillReference = document.querySelector('#skill-reference');
  const previewLegend = document.querySelector('.preview-legend');
  const skillScale = document.querySelector('#skill-scale');
  const skillScaleNumber = document.querySelector('#skill-scale-number');
  const skillOffsetX = document.querySelector('#skill-offset-x');
  const skillOffsetXNumber = document.querySelector('#skill-offset-x-number');
  const skillOffsetY = document.querySelector('#skill-offset-y');
  const skillOffsetYNumber = document.querySelector('#skill-offset-y-number');
  const pausePreviewButton = document.querySelector('#pause-preview-button');
  const autoMatchButton = document.querySelector('#auto-match-button');
  const resetVisualButton = document.querySelector('#reset-visual-button');
  const calibrationHelp = document.querySelector('#calibration-help');
  const calibrationStatus = document.querySelector('#calibration-status');
  const autoSleepEnabled = document.querySelector('#auto-sleep-enabled');
  const autoSleepFields = document.querySelector('#auto-sleep-fields');
  const autoSleepSeconds = document.querySelector('#auto-sleep-seconds');
  const autoSleepSecondsOutput = document.querySelector('#auto-sleep-seconds-output');
  const autoSleepEnterSkill = document.querySelector('#auto-sleep-enter-skill');
  const autoSleepLoopSkill = document.querySelector('#auto-sleep-loop-skill');
  const autoSleepWakeSkill = document.querySelector('#auto-sleep-wake-skill');
  const autoSleepWakePointer = document.querySelector('#auto-sleep-wake-pointer');
  const autoSleepRuleStatus = document.querySelector('#auto-sleep-rule-status');
  const inactivityRuleRole = document.querySelector('#inactivity-rule-role');
  const testInactivityFlowButton = document.querySelector('#test-inactivity-flow');
  const ruleFlowDelay = document.querySelector('#rule-flow-delay');
  const ruleFlowEnter = document.querySelector('#rule-flow-enter');
  const ruleFlowLoop = document.querySelector('#rule-flow-loop');
  const ruleFlowWake = document.querySelector('#rule-flow-wake');
  const randomRuleCard = document.querySelector('#random-rule-card');
  const randomRuleEmpty = document.querySelector('#random-rule-empty');
  const randomEnabled = document.querySelector('#random-enabled');
  const randomFields = document.querySelector('#random-fields');
  const randomInterval = document.querySelector('#random-interval');
  const randomIntervalOutput = document.querySelector('#random-interval-output');
  const randomWindowText = document.querySelector('#random-window-text');
  const randomSkillList = document.querySelector('#random-skill-list');
  const randomFlowDelay = document.querySelector('#random-flow-delay');
  const randomFlowSkill = document.querySelector('#random-flow-skill');
  const randomRuleStatus = document.querySelector('#random-rule-status');
  const randomRuleRole = document.querySelector('#random-rule-role');
  const randomRuleDescription = document.querySelector('#random-rule-description');
  const deleteRandomRule = document.querySelector('#delete-random-rule');
  const restoreRandomRule = document.querySelector('#restore-random-rule');
  const openingPlayOnStartup = document.querySelector('#opening-play-on-startup');
  const createOpeningPlanButton = document.querySelector('#create-opening-plan');
  const openingEmptyCreate = document.querySelector('#opening-empty-create');
  const openingPlanList = document.querySelector('#opening-plan-list');
  const openingEmpty = document.querySelector('#opening-empty');
  const openingDetail = document.querySelector('#opening-detail');
  const openingPlanName = document.querySelector('#opening-plan-name');
  const openingPlanSummary = document.querySelector('#opening-plan-summary');
  const openingCurrentPlan = document.querySelector('#opening-current-plan');
  const openingPlanEnabled = document.querySelector('#opening-plan-enabled');
  const renameOpeningPlanButton = document.querySelector('#rename-opening-plan');
  const duplicateOpeningPlanButton = document.querySelector('#duplicate-opening-plan');
  const deleteOpeningPlanButton = document.querySelector('#delete-opening-plan');
  const openingPreview = document.querySelector('#opening-preview');
  const openingPreviewCanvas = document.querySelector('#opening-preview-canvas');
  const openingPlanReference = document.querySelector('#opening-plan-reference');
  const openingPreviewEmpty = document.querySelector('#opening-preview-empty');
  const openingPreviewSeek = document.querySelector('#opening-preview-seek');
  const openingPreviewTime = document.querySelector('#opening-preview-time');
  const previewOpeningPlanButton = document.querySelector('#preview-opening-plan');
  const toggleOpeningPreviewButton = document.querySelector('#toggle-opening-preview');
  const stopOpeningPreviewButton = document.querySelector('#stop-opening-preview');
  const openingPreviewStatus = document.querySelector('#opening-preview-status');
  const addOpeningSegmentButton = document.querySelector('#add-opening-segment');
  const openingSegmentList = document.querySelector('#opening-segment-list');
  const openingSegmentDialog = document.querySelector('#opening-segment-dialog');
  const openingSegmentForm = document.querySelector('#opening-segment-form');
  const openingSegmentDialogTitle = document.querySelector('#opening-segment-dialog-title');
  const openingSegmentName = document.querySelector('#opening-segment-name');
  const openingSegmentEnabled = document.querySelector('#opening-segment-enabled');
  const openingSegmentMuted = document.querySelector('#opening-segment-muted');
  const openingCalibrationCanvas = document.querySelector('#opening-calibration-canvas');
  const openingReference = document.querySelector('#opening-reference');
  const openingEditPreview = document.querySelector('#opening-edit-preview');
  const openingEditSeek = document.querySelector('#opening-edit-seek');
  const openingEditTime = document.querySelector('#opening-edit-time');
  const openingScale = document.querySelector('#opening-scale');
  const openingScaleOutput = document.querySelector('#opening-scale-output');
  const openingOffsetX = document.querySelector('#opening-offset-x');
  const openingOffsetXOutput = document.querySelector('#opening-offset-x-output');
  const openingOffsetY = document.querySelector('#opening-offset-y');
  const openingOffsetYOutput = document.querySelector('#opening-offset-y-output');
  const toggleOpeningEditPreview = document.querySelector('#toggle-opening-edit-preview');
  const matchOpeningEndButton = document.querySelector('#match-opening-end');
  const resetOpeningVisualButton = document.querySelector('#reset-opening-visual');
  const openingCalibrationStatus = document.querySelector('#opening-calibration-status');
  const openingSegmentDialogError = document.querySelector('#opening-segment-dialog-error');
  const saveOpeningSegmentButton = document.querySelector('#save-opening-segment');
  const textPromptDialog = document.querySelector('#text-prompt-dialog');
  const textPromptForm = document.querySelector('#text-prompt-form');
  const textPromptTitle = document.querySelector('#text-prompt-title');
  const textPromptLabel = document.querySelector('#text-prompt-label');
  const textPromptInput = document.querySelector('#text-prompt-input');
  const textPromptError = document.querySelector('#text-prompt-error');
  const textPromptCancel = document.querySelector('#text-prompt-cancel');
  const textPromptConfirm = document.querySelector('#text-prompt-confirm');
  const confirmDialog = document.querySelector('#confirm-dialog');
  const confirmForm = document.querySelector('#confirm-form');
  const confirmTitle = document.querySelector('#confirm-title');
  const confirmMessage = document.querySelector('#confirm-message');
  const confirmCancel = document.querySelector('#confirm-cancel');
  const confirmSubmit = document.querySelector('#confirm-submit');

  let data = null;
  let dialogMode = 'import';
  let selectedMedia = null;
  let editingSkillId = null;
  let scaleSaveTimer = null;
  let autoMatchOnLoad = false;
  let seekingPreview = false;
  let autoSleepSaveTimer = null;
  let randomBehaviorSaveTimer = null;
  let selectedOpeningPlanId = null;
  let openingPreviewQueue = [];
  let openingPreviewIndex = -1;
  let openingPreviewSeeking = false;
  let editingOpeningPlanId = null;
  let editingOpeningSegmentId = null;
  let openingEditSeeking = false;
  let draggedOpeningSegmentId = null;
  let textPromptResolver = null;
  let confirmResolver = null;
  let characterDialogMode = 'create';
  let editingCharacterId = null;
  let selectedCharacterImage = null;
  let selectedCharacterIdle = null;
  let existingCharacterImageSource = null;
  let existingCharacterIdleSource = null;

  function setStatus(text, kind = 'saved') {
    saveStatus.textContent = text;
    saveStatus.classList.toggle('is-busy', kind === 'busy');
    saveStatus.classList.toggle('is-error', kind === 'error');
  }

  function clamp(value, minimum, maximum, fallback = minimum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function finishTextPrompt(value) {
    const resolve = textPromptResolver;
    textPromptResolver = null;
    if (textPromptDialog.open) textPromptDialog.close();
    resolve?.(value);
  }

  function requestTextInput({
    title,
    label = '名称',
    value = '',
    confirmText = '确定',
  }) {
    if (textPromptResolver) finishTextPrompt(null);
    textPromptTitle.textContent = title;
    textPromptLabel.textContent = label;
    textPromptInput.value = String(value || '').slice(0, 40);
    textPromptConfirm.textContent = confirmText;
    textPromptError.hidden = true;
    textPromptError.textContent = '';
    textPromptDialog.showModal();
    requestAnimationFrame(() => {
      textPromptInput.focus();
      textPromptInput.select();
    });
    return new Promise((resolve) => {
      textPromptResolver = resolve;
    });
  }

  textPromptForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = textPromptInput.value.trim();
    if (!value) {
      textPromptError.textContent = '请输入名称。';
      textPromptError.hidden = false;
      textPromptInput.focus();
      return;
    }
    finishTextPrompt(value);
  });
  textPromptInput.addEventListener('input', () => {
    textPromptError.hidden = true;
  });
  textPromptCancel.addEventListener('click', () => finishTextPrompt(null));
  textPromptDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finishTextPrompt(null);
  });
  textPromptDialog.addEventListener('close', () => {
    if (textPromptResolver) finishTextPrompt(null);
  });

  function finishConfirmation(confirmed) {
    const resolve = confirmResolver;
    confirmResolver = null;
    if (confirmDialog.open) confirmDialog.close();
    resolve?.(confirmed);
  }

  function requestConfirmation({
    title = '确认操作',
    message,
    confirmText = '确定',
  }) {
    if (confirmResolver) finishConfirmation(false);
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmSubmit.textContent = confirmText;
    confirmDialog.showModal();
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  confirmForm.addEventListener('submit', (event) => {
    event.preventDefault();
    finishConfirmation(true);
  });
  confirmCancel.addEventListener('click', () => finishConfirmation(false));
  confirmDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finishConfirmation(false);
  });
  confirmDialog.addEventListener('close', () => {
    if (confirmResolver) finishConfirmation(false);
  });

  function getVisual() {
    return {
      scale: clamp(Number(skillScale.value) / 100, 0.4, 1.8, 1),
      offsetX: clamp(skillOffsetX.value, -160, 160, 0),
      offsetY: clamp(skillOffsetY.value, -160, 160, 0),
    };
  }

  function setVisual(visual = {}) {
    skillScale.value = String(Math.round(clamp(visual.scale, 0.4, 1.8, 1) * 100));
    skillOffsetX.value = String(Math.round(clamp(visual.offsetX, -160, 160, 0)));
    skillOffsetY.value = String(Math.round(clamp(visual.offsetY, -160, 160, 0)));
    updatePreviewVisual();
  }

  function updatePreviewVisual() {
    const visual = getVisual();
    const previewScaleX = Math.max(0.1, calibrationStage.clientWidth / 368);
    const previewScaleY = Math.max(0.1, calibrationStage.clientHeight / 350);
    preview.style.setProperty('--preview-scale', String(visual.scale));
    preview.style.setProperty('--preview-offset-x', `${visual.offsetX * previewScaleX}px`);
    preview.style.setProperty('--preview-offset-y', `${visual.offsetY * previewScaleY}px`);
    skillScaleNumber.value = String(Math.round(visual.scale * 100));
    skillOffsetXNumber.value = String(Math.round(visual.offsetX));
    skillOffsetYNumber.value = String(Math.round(visual.offsetY));
  }

  function updateCalibrationMode() {
    const isScene = skillType.value === 'scene';
    calibrationStage.classList.toggle('is-scene', isScene);
    autoMatchButton.disabled = isScene;
    calibrationHelp.textContent = isScene
      ? '场景素材会整体缩放和移动；调整到角色在局部窗口中的大小看起来自然。'
      : '半透明角色是标准大小；拖动滑块，让技能中的角色与它接近。';
    if (previewLegend) previewLegend.hidden = isScene;
  }

  function getAlphaBounds(element, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, width, height);
    context.drawImage(element, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    for (let index = 3, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
      if (pixels[index] < 24) continue;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
    if (right < left || bottom < top) return null;
    return { left, top, right: right + 1, bottom: bottom + 1 };
  }

  function renderBounds(bounds, mediaWidth, mediaHeight) {
    const viewportWidth = 368;
    const viewportHeight = 350;
    const fit = Math.min(viewportWidth / mediaWidth, viewportHeight / mediaHeight);
    const drawWidth = mediaWidth * fit;
    const drawHeight = mediaHeight * fit;
    const drawLeft = (viewportWidth - drawWidth) / 2;
    const drawTop = viewportHeight - drawHeight;
    return {
      left: drawLeft + bounds.left * fit,
      top: drawTop + bounds.top * fit,
      right: drawLeft + bounds.right * fit,
      bottom: drawTop + bounds.bottom * fit,
    };
  }

  async function autoMatchVisual() {
    if (skillType.value !== 'transparent') return;
    if (!preview.videoWidth || !preview.videoHeight) {
      calibrationStatus.textContent = '视频还没有读取完成，请稍后再试。';
      return;
    }
    try {
      if (!skillReference.complete || !skillReference.naturalWidth) await skillReference.decode();
      const referenceAlpha = getAlphaBounds(
        skillReference,
        skillReference.naturalWidth,
        skillReference.naturalHeight,
      );
      const skillAlpha = getAlphaBounds(preview, preview.videoWidth, preview.videoHeight);
      if (!referenceAlpha || !skillAlpha) throw new Error('没有识别到透明角色边缘');
      const reference = renderBounds(
        referenceAlpha,
        skillReference.naturalWidth,
        skillReference.naturalHeight,
      );
      const current = renderBounds(skillAlpha, preview.videoWidth, preview.videoHeight);
      const referenceWidth = reference.right - reference.left;
      const referenceHeight = reference.bottom - reference.top;
      const currentWidth = current.right - current.left;
      const currentHeight = current.bottom - current.top;
      const scale = clamp(
        Math.sqrt((referenceWidth / currentWidth) * (referenceHeight / currentHeight)),
        0.4,
        1.8,
        1,
      );
      const originX = 368 / 2;
      const originY = 350;
      const referenceCenterX = (reference.left + reference.right) / 2;
      const currentCenterX = originX + ((current.left + current.right) / 2 - originX) * scale;
      const currentBottom = originY + (current.bottom - originY) * scale;
      setVisual({
        scale,
        offsetX: Math.round(referenceCenterX - currentCenterX),
        offsetY: Math.round(reference.bottom - currentBottom),
      });
      calibrationStatus.textContent = `已自动匹配为 ${Math.round(scale * 100)}%，仍可手动微调。`;
    } catch (error) {
      console.warn('自动匹配技能大小失败', error);
      calibrationStatus.textContent = '未能自动识别透明边缘，请使用三个滑块手动调整。';
    }
  }

  function selectPanel(panelId) {
    nav.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.panel === panelId);
    });
    document.querySelectorAll('[data-panel-content]').forEach((panel) => {
      const active = panel.dataset.panelContent === panelId;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    panelTitle.textContent = panelTitles[panelId] || '设置';
  }

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('.nav-item');
    if (button) selectPanel(button.dataset.panel);
  });

  function categoryName(categoryId) {
    return data?.manifest?.categories?.find((item) => item.id === categoryId)?.name || categoryId;
  }

  function sourceLabel(skill) {
    return skill.origin === 'user' ? '本地导入' : '内置素材';
  }

  function renderSkills() {
    const skills = data?.manifest?.skills || [];
    const transparentCount = skills.filter((skill) => skill.type === 'transparent').length;
    const sceneCount = skills.filter((skill) => skill.type === 'scene').length;
    skillSummary.innerHTML = '';
    [`共 ${skills.length} 个技能`, `透明动画 ${transparentCount}`, `场景视频 ${sceneCount}`].forEach((text) => {
      const chip = document.createElement('span');
      chip.className = 'summary-chip';
      chip.textContent = text;
      skillSummary.append(chip);
    });

    skillList.innerHTML = '';
    if (!skills.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = '当前角色还没有技能，点击右上角导入第一个素材。';
      skillList.append(empty);
      return;
    }

    for (const skill of skills) {
      const card = document.createElement('article');
      card.className = 'skill-card';
      card.dataset.skillId = skill.id;

      const name = document.createElement('div');
      name.className = 'skill-name';
      const strong = document.createElement('strong');
      strong.textContent = `${skill.pinned ? '★ ' : ''}${skill.name}`;
      const origin = document.createElement('span');
      origin.textContent = sourceLabel(skill);
      name.append(strong, origin);

      const category = document.createElement('div');
      category.textContent = `${categoryName(skill.category)} · ${Math.round((skill.visual?.scale || 1) * 100)}%`;
      category.className = 'skill-meta';

      const type = document.createElement('span');
      type.className = `skill-type ${skill.type === 'scene' ? 'scene' : ''}`;
      type.textContent = skill.type === 'scene' ? '场景视频' : '透明动画';

      const actions = document.createElement('div');
      actions.className = 'skill-actions';
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.dataset.action = 'preview';
      previewButton.textContent = '预览';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.dataset.action = 'edit';
      editButton.textContent = '编辑';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete';
      deleteButton.className = 'danger';
      deleteButton.textContent = '删除';
      actions.append(previewButton, editButton, deleteButton);

      card.append(name, category, type, actions);
      skillList.append(card);
    }
  }

  function setSkillOptions(select, skills, selectedId, {
    optional = false,
    placeholder = '不使用动画（淡入淡出）',
  } = {}) {
    select.innerHTML = '';
    if (optional) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = placeholder;
      select.append(emptyOption);
    }
    for (const skill of skills) {
      const option = document.createElement('option');
      option.value = skill.id;
      option.textContent = skill.name;
      select.append(option);
    }
    select.value = skills.some((skill) => skill.id === selectedId)
      ? selectedId
      : '';
  }

  function selectedSkillName(select, fallback) {
    return select.selectedOptions[0]?.textContent || fallback;
  }

  function formatInactivityDuration(seconds) {
    if (seconds < 60) return `${seconds} 秒`;
    if (seconds % 60 === 0) return `${seconds / 60} 分钟`;
    return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  }

  function updateAutoSleepRuleSummary() {
    const seconds = Math.round(clamp(autoSleepSeconds.value, 5, 3600, 30));
    const duration = formatInactivityDuration(seconds);
    autoSleepSecondsOutput.textContent = duration;
    ruleFlowDelay.textContent = `${duration}无互动`;
    ruleFlowEnter.textContent = autoSleepEnterSkill.value
      ? selectedSkillName(autoSleepEnterSkill, '进入动画')
      : '淡入循环状态';
    ruleFlowLoop.textContent = autoSleepLoopSkill.value
      ? `循环：${selectedSkillName(autoSleepLoopSkill, '循环状态')}`
      : '尚未选择循环动画';
    ruleFlowWake.textContent = autoSleepWakePointer.checked
      ? (autoSleepWakeSkill.value
        ? `鼠标碰到：${selectedSkillName(autoSleepWakeSkill, '恢复动画')}`
        : '鼠标碰到：淡入待机')
      : '等待手动唤醒';
    autoSleepFields.classList.toggle('is-disabled', !autoSleepEnabled.checked);
    for (const control of autoSleepFields.querySelectorAll('input, select, button')) {
      control.disabled = !autoSleepEnabled.checked;
    }
  }

  function getAutoSleepRuleDraft() {
    return {
      enabled: autoSleepEnabled.checked,
      inactivitySeconds: Math.round(clamp(autoSleepSeconds.value, 5, 3600, 30)),
      sleepEnterSkillId: autoSleepEnterSkill.value,
      sleepLoopSkillId: autoSleepLoopSkill.value,
      wakeSkillId: autoSleepWakeSkill.value,
      wakeOnPointer: autoSleepWakePointer.checked,
    };
  }

  async function saveAutoSleepRule() {
    clearTimeout(autoSleepSaveTimer);
    autoSleepRuleStatus.textContent = '正在保存无互动规则…';
    setStatus('正在保存固定规则…', 'busy');
    const result = await api.updateAutoSleepRule(getAutoSleepRuleDraft());
    if (!result?.ok) {
      const message = result?.error || '无互动规则保存失败';
      autoSleepRuleStatus.textContent = message;
      setStatus(message, 'error');
      renderAutoSleepRule();
      return false;
    }
    renderData(result.data);
    autoSleepRuleStatus.textContent = `已保存到“${data.manifest.roleName || '当前角色'}”的角色档案。`;
    setStatus('固定规则已保存');
    return true;
  }

  function scheduleAutoSleepSave(delay = 80) {
    clearTimeout(autoSleepSaveTimer);
    autoSleepRuleStatus.textContent = '等待保存…';
    autoSleepSaveTimer = setTimeout(saveAutoSleepRule, delay);
  }

  function renderAutoSleepRule() {
    const behavior = data?.manifest?.behavior || {};
    const rule = data?.fixedRules?.autoSleep || {
      enabled: behavior.autoSleepEnabled === true,
      inactivitySeconds: Math.round((behavior.inactivitySleepMs || 30000) / 1000),
      sleepEnterSkillId: behavior.sleepEnterSkillId || '',
      sleepLoopSkillId: behavior.sleepLoopSkillId || '',
      wakeSkillId: behavior.wakeSkillId || '',
      wakeOnPointer: behavior.wakeOnPointer !== false,
    };
    const transparentSkills = (data?.manifest?.skills || []).filter((skill) => skill.type === 'transparent');
    inactivityRuleRole.textContent = `当前角色 · ${data?.manifest?.roleName || '未命名角色'}`;
    autoSleepEnabled.checked = rule.enabled === true;
    autoSleepSeconds.value = String(Math.round(clamp(rule.inactivitySeconds, 5, 3600, 30)));
    setSkillOptions(autoSleepEnterSkill, transparentSkills, rule.sleepEnterSkillId, {
      optional: true,
      placeholder: '不使用进入动画（直接淡入）',
    });
    setSkillOptions(autoSleepLoopSkill, transparentSkills, rule.sleepLoopSkillId);
    setSkillOptions(autoSleepWakeSkill, transparentSkills, rule.wakeSkillId, {
      optional: true,
      placeholder: '不使用恢复动画（直接淡入）',
    });
    autoSleepWakePointer.checked = rule.wakeOnPointer !== false;
    updateAutoSleepRuleSummary();
  }

  function getRandomIntervalWindow(minutes) {
    return {
      minimum: Math.max(1, Math.round(minutes * 0.7)),
      maximum: Math.max(1, Math.round(minutes * 1.3)),
    };
  }

  function getRandomBehaviorDraft() {
    return {
      enabled: randomEnabled.checked,
      intervalMinutes: Math.round(clamp(randomInterval.value, 5, 60, 20)),
      skillIds: [...randomSkillList.querySelectorAll('input[type="checkbox"]:checked')]
        .map((input) => input.value),
    };
  }

  function updateRandomBehaviorSummary() {
    const draft = getRandomBehaviorDraft();
    const intervalWindow = getRandomIntervalWindow(draft.intervalMinutes);
    randomIntervalOutput.textContent = `${draft.intervalMinutes} 分钟`;
    randomWindowText.textContent = `设置${draft.intervalMinutes}分钟时，会在约${intervalWindow.minimum}～${intervalWindow.maximum}分钟之间触发。`;
    randomFlowDelay.textContent = `约${intervalWindow.minimum}～${intervalWindow.maximum}分钟`;
    randomFlowSkill.textContent = draft.skillIds.length > 0
      ? `从${draft.skillIds.length}个技能中随机播放1个`
      : '尚未选择技能';
    randomFields.classList.toggle('is-disabled', !draft.enabled);
  }

  async function saveRandomBehavior() {
    clearTimeout(randomBehaviorSaveTimer);
    randomRuleStatus.textContent = '正在保存随机行为规则…';
    setStatus('正在保存随机行为…', 'busy');
    const result = await api.updateRandomBehavior(getRandomBehaviorDraft());
    if (!result?.ok) {
      const message = result?.error || '随机行为保存失败';
      randomRuleStatus.textContent = message;
      setStatus(message, 'error');
      renderData(data);
      return;
    }
    renderData(result.data);
    randomRuleStatus.textContent = `已保存到“${data.manifest.roleName || '当前角色'}”的角色档案。`;
    setStatus('随机行为已保存');
  }

  function scheduleRandomBehaviorSave(delay = 80) {
    clearTimeout(randomBehaviorSaveTimer);
    randomRuleStatus.textContent = '等待保存…';
    randomBehaviorSaveTimer = setTimeout(saveRandomBehavior, delay);
  }

  function renderRandomBehavior() {
    const rule = data?.randomBehavior;
    const deleted = rule === null;
    const currentRoleName = data?.manifest?.roleName || '未命名角色';
    randomRuleRole.textContent = `当前角色 · ${currentRoleName}`;
    randomRuleDescription.textContent = `“${currentRoleName}”仍然优先按照无互动规则进入循环状态。开启后，它会偶尔恢复并表演一个选中的技能，完成后返回循环状态。`;
    randomRuleCard.hidden = deleted;
    randomRuleEmpty.hidden = !deleted;
    if (deleted) return;

    const behavior = data?.manifest?.behavior || {};
    const reserved = new Set([
      behavior.idleSkillId,
      behavior.sleepEnterSkillId || 'sleep-enter',
      behavior.sleepLoopSkillId || 'sleep-loop',
      behavior.wakeSkillId || 'wake-up',
    ]);
    const categoryNames = new Map(
      (data?.manifest?.categories || []).map((category) => [category.id, category.name]),
    );
    const eligibleSkills = (data?.manifest?.skills || []).filter((skill) => !reserved.has(skill.id));
    const selectedIds = new Set(rule?.skillIds || []);
    randomEnabled.checked = rule?.enabled === true;
    randomInterval.value = String(Math.round(clamp(rule?.intervalMinutes, 5, 60, 20)));
    randomSkillList.innerHTML = '';
    for (const skill of eligibleSkills) {
      const label = document.createElement('label');
      label.className = 'random-skill-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = skill.id;
      input.checked = selectedIds.has(skill.id);
      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = skill.name;
      const meta = document.createElement('small');
      meta.textContent = `${categoryNames.get(skill.category) || skill.category} · ${skill.type === 'scene' ? '场景视频' : '透明动画'}`;
      text.append(name, meta);
      label.append(input, text);
      randomSkillList.append(label);
    }
    if (eligibleSkills.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'random-skill-empty';
      empty.textContent = '技能库中暂时没有可用于随机行为的普通技能。';
      randomSkillList.append(empty);
    }
    updateRandomBehaviorSummary();
  }

  function getSelectedOpeningPlan() {
    return data?.opening?.plans?.find((plan) => plan.id === selectedOpeningPlanId) || null;
  }

  function formatOpeningDuration(durationMs) {
    if (!durationMs) return '时长待识别';
    return `${(durationMs / 1000).toFixed(1)}秒`;
  }

  function updateOpeningPreviewTransform(segment) {
    const visual = segment?.visual || {};
    const previewScaleX = Math.max(0.1, openingPreviewCanvas.clientWidth / 368);
    const previewScaleY = Math.max(0.1, openingPreviewCanvas.clientHeight / 350);
    openingPreview.style.setProperty(
      '--opening-preview-scale',
      String(clamp(visual.scale, 0.4, 1.8, 1)),
    );
    openingPreview.style.setProperty(
      '--opening-preview-x',
      `${clamp(visual.offsetX, -160, 160, 0) * previewScaleX}px`,
    );
    openingPreview.style.setProperty(
      '--opening-preview-y',
      `${clamp(visual.offsetY, -160, 160, 0) * previewScaleY}px`,
    );
  }

  function updateOpeningPreviewTimeline() {
    const duration = Number.isFinite(openingPreview.duration) ? openingPreview.duration : 0;
    const current = Number.isFinite(openingPreview.currentTime) ? openingPreview.currentTime : 0;
    openingPreviewSeek.disabled = duration <= 0;
    openingPreviewSeek.max = String(Math.max(1, Math.round(duration * 1000)));
    if (!openingPreviewSeeking) {
      openingPreviewSeek.value = String(Math.round(current * 1000));
    }
    openingPreviewTime.textContent = `${formatPreviewTime(current)} / ${formatPreviewTime(duration)}`;
  }

  function updateOpeningPreviewPlaybackButton() {
    toggleOpeningPreviewButton.textContent = openingPreview.paused ? '继续预览' : '暂停预览';
    toggleOpeningPreviewButton.disabled = !openingPreview.getAttribute('src');
    toggleOpeningPreviewButton.setAttribute('aria-pressed', String(openingPreview.paused));
  }

  function stopOpeningPreview(message = '预览不会影响桌面上的角色') {
    openingPreviewQueue = [];
    openingPreviewIndex = -1;
    openingPreviewSeeking = false;
    openingPreview.pause();
    openingPreview.removeAttribute('src');
    openingPreview.load();
    openingPreview.hidden = true;
    openingPreviewEmpty.hidden = false;
    openingPreviewSeek.value = '0';
    updateOpeningPreviewTimeline();
    updateOpeningPreviewPlaybackButton();
    stopOpeningPreviewButton.disabled = true;
    openingPreviewStatus.textContent = message;
  }

  function playOpeningPreviewSegment() {
    openingPreviewIndex += 1;
    const segment = openingPreviewQueue[openingPreviewIndex];
    if (!segment) {
      stopOpeningPreview('预览完成；程序启动时会进入当前选择的普通待机状态。');
      return;
    }
    const visual = segment.visual || {};
    updateOpeningPreviewTransform({ ...segment, visual });
    openingPreview.muted = segment.muted === true;
    openingPreview.src = segment.source;
    openingPreview.hidden = false;
    openingPreviewEmpty.hidden = true;
    stopOpeningPreviewButton.disabled = false;
    openingPreviewStatus.textContent = `正在预览：${segment.name}（${openingPreviewIndex + 1}/${openingPreviewQueue.length}）`;
    openingPreview.load();
    updateOpeningPreviewPlaybackButton();
    updateOpeningPreviewTimeline();
    openingPreview.play().catch(() => {
      stopOpeningPreview(`${segment.name}无法播放，请检查WebM素材。`);
    });
  }

  function previewOpeningSegments(segments) {
    const enabled = segments.filter((segment) => segment.enabled !== false);
    if (enabled.length === 0) {
      setStatus('没有可预览的已启用片段', 'error');
      return;
    }
    stopOpeningPreview();
    openingPreviewQueue = enabled.map((segment) => ({ ...segment, visual: { ...segment.visual } }));
    openingPreviewIndex = -1;
    playOpeningPreviewSegment();
  }

  function getOpeningEditorVisual() {
    return {
      scale: clamp(Number(openingScale.value) / 100, 0.4, 1.8, 1),
      offsetX: clamp(openingOffsetX.value, -160, 160, 0),
      offsetY: clamp(openingOffsetY.value, -160, 160, 0),
    };
  }

  function updateOpeningEditorVisual() {
    const visual = getOpeningEditorVisual();
    const previewScaleX = Math.max(0.1, openingCalibrationCanvas.clientWidth / 368);
    const previewScaleY = Math.max(0.1, openingCalibrationCanvas.clientHeight / 350);
    openingEditPreview.style.setProperty('--opening-edit-scale', String(visual.scale));
    openingEditPreview.style.setProperty(
      '--opening-edit-x',
      `${visual.offsetX * previewScaleX}px`,
    );
    openingEditPreview.style.setProperty(
      '--opening-edit-y',
      `${visual.offsetY * previewScaleY}px`,
    );
    openingScaleOutput.textContent = `${Math.round(visual.scale * 100)}%`;
    openingOffsetXOutput.textContent = `${visual.offsetX > 0 ? '+' : ''}${Math.round(visual.offsetX)}`;
    openingOffsetYOutput.textContent = `${visual.offsetY > 0 ? '+' : ''}${Math.round(visual.offsetY)}`;
  }

  function setOpeningEditorVisual(visual = {}) {
    openingScale.value = String(Math.round(clamp(visual.scale, 0.4, 1.8, 1) * 100));
    openingOffsetX.value = String(Math.round(clamp(visual.offsetX, -160, 160, 0)));
    openingOffsetY.value = String(Math.round(clamp(visual.offsetY, -160, 160, 0)));
    updateOpeningEditorVisual();
  }

  function updateOpeningEditorTimeline() {
    const duration = Number.isFinite(openingEditPreview.duration)
      ? openingEditPreview.duration
      : 0;
    const current = Number.isFinite(openingEditPreview.currentTime)
      ? openingEditPreview.currentTime
      : 0;
    openingEditSeek.disabled = duration <= 0;
    openingEditSeek.max = String(Math.max(1, Math.round(duration * 1000)));
    if (!openingEditSeeking) openingEditSeek.value = String(Math.round(current * 1000));
    openingEditTime.textContent = `${formatPreviewTime(current)} / ${formatPreviewTime(duration)}`;
  }

  function updateOpeningEditorPlaybackButton() {
    toggleOpeningEditPreview.textContent = openingEditPreview.paused ? '继续预览' : '暂停预览';
    toggleOpeningEditPreview.disabled = !openingEditPreview.getAttribute('src');
    toggleOpeningEditPreview.setAttribute('aria-pressed', String(openingEditPreview.paused));
  }

  function showOpeningEditorError(message) {
    openingSegmentDialogError.textContent = message;
    openingSegmentDialogError.hidden = !message;
  }

  function openOpeningSegmentEditor(planId, segmentId, { autoPlay = true } = {}) {
    const plan = data?.opening?.plans?.find((item) => item.id === planId);
    const segment = plan?.segments?.find((item) => item.id === segmentId);
    if (!plan || !segment) return;
    editingOpeningPlanId = planId;
    editingOpeningSegmentId = segmentId;
    openingEditSeeking = false;
    openingSegmentDialogTitle.textContent = segment.name;
    openingSegmentName.value = segment.name;
    openingSegmentEnabled.checked = segment.enabled !== false;
    openingSegmentMuted.checked = segment.muted === true;
    openingEditPreview.muted = segment.muted === true;
    openingEditPreview.src = segment.source;
    openingEditPreview.hidden = false;
    openingEditPreview.load();
    openingEditSeek.value = '0';
    setOpeningEditorVisual(segment.visual);
    showOpeningEditorError('');
    openingCalibrationStatus.textContent = '可暂停并拖动进度，建议在最后的站立画面校准。';
    openingSegmentDialog.showModal();
    requestAnimationFrame(updateOpeningEditorVisual);
    if (autoPlay) {
      openingEditPreview.play().catch(() => {
        openingCalibrationStatus.textContent = '点击“继续预览”开始播放。';
      });
    }
  }

  async function seekOpeningEditor(seconds) {
    const duration = Number.isFinite(openingEditPreview.duration)
      ? openingEditPreview.duration
      : 0;
    if (duration <= 0) return false;
    const nextTime = clamp(seconds, 0, duration, 0);
    if (Math.abs(openingEditPreview.currentTime - nextTime) < 0.01) {
      updateOpeningEditorTimeline();
      return true;
    }
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timeout);
        openingEditPreview.removeEventListener('seeked', finish);
        updateOpeningEditorTimeline();
        resolve(true);
      };
      const timeout = setTimeout(() => {
        openingEditPreview.removeEventListener('seeked', finish);
        resolve(false);
      }, 1600);
      openingEditPreview.addEventListener('seeked', finish, { once: true });
      openingEditPreview.currentTime = nextTime;
    });
  }

  async function matchOpeningEndToIdle() {
    if (!openingEditPreview.videoWidth || !openingEditPreview.videoHeight) {
      openingCalibrationStatus.textContent = '视频还没有读取完成，请稍后再试。';
      return;
    }
    openingEditPreview.pause();
    updateOpeningEditorPlaybackButton();
    const duration = Number.isFinite(openingEditPreview.duration)
      ? openingEditPreview.duration
      : 0;
    const matchedFrame = await seekOpeningEditor(Math.max(0, duration - 0.06));
    if (!matchedFrame) {
      openingCalibrationStatus.textContent = '无法读取视频末帧，请手动拖动进度后再试。';
      return;
    }
    try {
      if (!openingReference.complete || !openingReference.naturalWidth) {
        await openingReference.decode();
      }
      const referenceAlpha = getAlphaBounds(
        openingReference,
        openingReference.naturalWidth,
        openingReference.naturalHeight,
      );
      const openingAlpha = getAlphaBounds(
        openingEditPreview,
        openingEditPreview.videoWidth,
        openingEditPreview.videoHeight,
      );
      if (!referenceAlpha || !openingAlpha) throw new Error('没有识别到透明角色边缘');
      const reference = renderBounds(
        referenceAlpha,
        openingReference.naturalWidth,
        openingReference.naturalHeight,
      );
      const current = renderBounds(
        openingAlpha,
        openingEditPreview.videoWidth,
        openingEditPreview.videoHeight,
      );
      const referenceWidth = reference.right - reference.left;
      const referenceHeight = reference.bottom - reference.top;
      const currentWidth = current.right - current.left;
      const currentHeight = current.bottom - current.top;
      const scale = clamp(
        Math.sqrt((referenceWidth / currentWidth) * (referenceHeight / currentHeight)),
        0.4,
        1.8,
        1,
      );
      const originX = 368 / 2;
      const originY = 350;
      const referenceCenterX = (reference.left + reference.right) / 2;
      const currentCenterX = originX + ((current.left + current.right) / 2 - originX) * scale;
      const currentBottom = originY + (current.bottom - originY) * scale;
      setOpeningEditorVisual({
        scale,
        offsetX: Math.round(referenceCenterX - currentCenterX),
        offsetY: Math.round(reference.bottom - currentBottom),
      });
      openingCalibrationStatus.textContent = `末帧已自动对齐：大小 ${Math.round(scale * 100)}%。仍可手动微调。`;
    } catch (error) {
      console.warn('自动对齐开场末帧失败', error);
      openingCalibrationStatus.textContent = '未能识别透明边缘，请使用三个滑块手动调整。';
    }
  }

  async function readOpeningMediaDuration(previewUrl) {
    const media = document.createElement('video');
    media.preload = 'metadata';
    media.src = previewUrl;
    return new Promise((resolve) => {
      const finish = () => resolve(Number.isFinite(media.duration) ? Math.round(media.duration * 1000) : 0);
      media.addEventListener('loadedmetadata', finish, { once: true });
      media.addEventListener('error', () => resolve(0), { once: true });
      setTimeout(() => resolve(0), 3500);
      media.load();
    });
  }

  async function createOpeningPlan() {
    const name = await requestTextInput({
      title: '新建开场方案',
      label: '方案名称',
      value: `${data?.manifest?.roleName || '当前角色'}默认开场`,
      confirmText: '创建方案',
    });
    if (name === null) return;
    setStatus('正在创建开场方案…', 'busy');
    const result = await api.createOpeningPlan(name);
    if (!result?.ok) {
      setStatus(result?.error || '开场方案创建失败', 'error');
      return;
    }
    selectedOpeningPlanId = result.planId;
    renderData(result.data);
    setStatus('开场方案已创建');
  }

  async function chooseOpeningSegment({ replaceSegmentId = null } = {}) {
    const plan = getSelectedOpeningPlan();
    if (!plan) return;
    setStatus('正在选择透明WebM素材…', 'busy');
    const result = await api.chooseOpeningMedia();
    if (!result?.ok) {
      setStatus(result?.cancelled ? '配置已保存' : (result?.error || '开场素材选择失败'), result?.cancelled ? 'saved' : 'error');
      return;
    }
    const existing = replaceSegmentId
      ? plan.segments.find((segment) => segment.id === replaceSegmentId)
      : null;
    const name = await requestTextInput({
      title: replaceSegmentId ? '替换开场片段' : '导入开场片段',
      label: '片段名称',
      value: existing?.name || result.media.suggestedName,
      confirmText: replaceSegmentId ? '替换片段' : '导入片段',
    });
    if (name === null) {
      api.discardPreview(result.media.token);
      setStatus('已取消导入');
      return;
    }
    const durationMs = await readOpeningMediaDuration(result.media.previewUrl);
    const draft = { token: result.media.token, name, durationMs, enabled: true, muted: false };
    const saved = replaceSegmentId
      ? await api.replaceOpeningSegment(plan.id, replaceSegmentId, draft)
      : await api.addOpeningSegment(plan.id, draft);
    if (!saved?.ok) {
      setStatus(saved?.error || '开场片段保存失败', 'error');
      return;
    }
    renderData(saved.data);
    const savedSegmentId = saved.segmentId || replaceSegmentId;
    if (savedSegmentId) {
      openOpeningSegmentEditor(plan.id, savedSegmentId);
      setStatus('素材已保存，请校准开场角色的大小和位置', 'busy');
    } else {
      setStatus(replaceSegmentId ? '开场片段已替换' : '开场片段已导入');
    }
  }

  function renderOpeningPlans() {
    const opening = data?.opening || { playOnStartup: false, currentPlanId: null, plans: [] };
    const plans = opening.plans || [];
    if (!plans.some((plan) => plan.id === selectedOpeningPlanId)) {
      selectedOpeningPlanId = opening.currentPlanId || plans[0]?.id || null;
    }
    openingPlayOnStartup.checked = opening.playOnStartup === true;
    openingPlayOnStartup.disabled = plans.length === 0;
    openingPlanList.innerHTML = '';
    for (const plan of plans) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `opening-plan-item${plan.id === selectedOpeningPlanId ? ' is-selected' : ''}`;
      button.dataset.planId = plan.id;
      const name = document.createElement('strong');
      name.textContent = plan.name;
      const meta = document.createElement('small');
      meta.textContent = `${plan.segments.length}个片段 · ${plan.enabled ? '已启用' : '已停用'}`;
      if (plan.id === opening.currentPlanId) meta.className = 'current-mark';
      if (plan.id === opening.currentPlanId) meta.textContent += ' · 当前方案';
      button.append(name, meta);
      openingPlanList.append(button);
    }
    const plan = getSelectedOpeningPlan();
    openingEmpty.hidden = Boolean(plan);
    openingDetail.hidden = !plan;
    if (!plan) {
      stopOpeningPreview();
      return;
    }
    openingPlanName.textContent = plan.name;
    const enabledCount = plan.segments.filter((segment) => segment.enabled !== false).length;
    openingPlanSummary.textContent = `${plan.segments.length}个片段，其中${enabledCount}个会播放`;
    openingCurrentPlan.checked = plan.id === opening.currentPlanId;
    openingPlanEnabled.checked = plan.enabled !== false;
    previewOpeningPlanButton.disabled = enabledCount === 0;
    renderOpeningSegments(plan);
  }

  function renderOpeningSegments(plan) {
    openingSegmentList.innerHTML = '';
    if (plan.segments.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'opening-segment-empty';
      empty.textContent = '还没有片段。建议先导入一段完整开场动画；需要时再拆成多段。';
      openingSegmentList.append(empty);
      return;
    }
    plan.segments.forEach((segment, index) => {
      const card = document.createElement('article');
      card.className = 'opening-segment-card';
      card.dataset.segmentId = segment.id;
      const handle = document.createElement('span');
      handle.className = 'opening-drag-handle';
      handle.textContent = '⋮⋮';
      handle.title = '拖动排序';
      const name = document.createElement('div');
      name.className = 'opening-segment-name';
      const strong = document.createElement('strong');
      strong.textContent = `${index + 1}. ${segment.name}`;
      const meta = document.createElement('small');
      meta.textContent = `${formatOpeningDuration(segment.durationMs)} · 透明WebM`;
      name.append(strong, meta);
      const switches = document.createElement('div');
      switches.className = 'opening-segment-switch';
      switches.innerHTML = `<label><input type="checkbox" data-field="enabled" ${segment.enabled !== false ? 'checked' : ''} /> 播放</label><label><input type="checkbox" data-field="muted" ${segment.muted === true ? 'checked' : ''} /> 静音</label>`;
      const scaleValue = Math.round(clamp(segment.visual?.scale, 0.4, 1.8, 1) * 100);
      meta.textContent += ` · 大小${scaleValue}%`;
      const actions = document.createElement('div');
      actions.className = 'opening-segment-actions';
      for (const [action, label, className] of [
        ['edit', '编辑校准', ''], ['preview', '预览', ''], ['replace', '替换', ''], ['delete', '删除', 'danger'],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = label;
        button.className = className;
        actions.append(button);
      }
      handle.draggable = true;
      card.append(handle, name, switches, actions);
      openingSegmentList.append(card);
    });
  }

  function characterCategoryName(categoryId) {
    return data?.characters?.categories?.find((item) => item.id === categoryId)?.name
      || ({ pet: '宠物', person: '人物', other: '其他' }[categoryId] || '其他');
  }

  function renderCharacters() {
    const registry = data?.characters;
    if (!registry) return;
    const roles = Array.isArray(registry.roles) ? registry.roles : [];
    characterCount.textContent = `${roles.length} / ${registry.maxCharacters || 30} 个角色`;
    createCharacterButton.disabled = roles.length >= (registry.maxCharacters || 30);
    characterGroups.innerHTML = '';
    for (const category of registry.categories || []) {
      const group = document.createElement('section');
      group.className = 'character-group';
      const groupedRoles = roles.filter((role) => role.category === category.id);
      const heading = document.createElement('div');
      heading.className = 'character-group-heading';
      const title = document.createElement('h3');
      title.textContent = category.name;
      const count = document.createElement('span');
      count.textContent = `${groupedRoles.length} 个角色`;
      heading.append(title, count);
      const grid = document.createElement('div');
      grid.className = 'character-grid';
      if (groupedRoles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'character-empty-category';
        empty.textContent = `还没有${category.name}角色`;
        grid.append(empty);
      }
      for (const role of groupedRoles) {
        const isActive = role.id === data.activeRoleId;
        const isDefault = role.id === registry.defaultRoleId;
        const switchState = data.characterSwitch || {
          allowed: false,
          busy: false,
          label: '切换角色（当前动作结束后可用）',
        };
        const card = document.createElement('article');
        card.className = `character-card${isActive ? ' is-active' : ''}`;
        card.dataset.roleId = role.id;
        const thumbnail = document.createElement('div');
        thumbnail.className = 'character-thumbnail';
        const image = document.createElement('img');
        image.src = role.thumbnail || 'assets/doudou-icon.png';
        image.alt = '';
        thumbnail.append(image);
        const main = document.createElement('div');
        main.className = 'character-card-main';
        const cardTitle = document.createElement('div');
        cardTitle.className = 'character-card-title';
        const name = document.createElement('strong');
        name.textContent = role.name;
        cardTitle.append(name);
        const badges = document.createElement('div');
        badges.className = 'character-badges';
        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'character-badge';
        categoryBadge.textContent = category.name;
        badges.append(categoryBadge);
        if (isActive) {
          const badge = document.createElement('span');
          badge.className = 'character-badge active';
          badge.textContent = '当前使用';
          badges.append(badge);
        }
        if (isDefault) {
          const badge = document.createElement('span');
          badge.className = 'character-badge default';
          badge.textContent = '默认启动';
          badges.append(badge);
        }
        const actions = document.createElement('div');
        actions.className = 'character-card-actions';
        const switchButton = document.createElement('button');
        switchButton.type = 'button';
        switchButton.dataset.action = 'switch';
        switchButton.className = 'primary';
        switchButton.textContent = isActive ? '当前角色' : switchState.label;
        switchButton.disabled = isActive || !switchState.allowed;
        if (!isActive && !switchState.allowed) switchButton.title = switchState.label;
        actions.append(switchButton);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.dataset.action = 'edit';
        edit.textContent = '编辑';
        actions.append(edit);
        const defaultButton = document.createElement('button');
        defaultButton.type = 'button';
        defaultButton.dataset.action = 'default';
        defaultButton.textContent = isDefault ? '已设为默认' : '设为默认';
        defaultButton.disabled = isDefault;
        actions.append(defaultButton);
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.dataset.action = 'export';
        exportButton.textContent = '导出角色包';
        actions.append(exportButton);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.action = 'delete';
        remove.className = 'danger';
        remove.textContent = '删除';
        remove.disabled = isActive || isDefault || roles.length <= 1;
        if (isActive) remove.title = '请先切换到其他角色';
        else if (isDefault) remove.title = '请先设置另一个默认启动角色';
        actions.append(remove);
        main.append(cardTitle, badges, actions);
        card.append(thumbnail, main);
        grid.append(card);
      }
      group.append(heading, grid);
      characterGroups.append(group);
    }
  }

  function selectedCharacterIdleMode() {
    return characterIdleModeInputs.find((input) => input.checked)?.value || 'static';
  }

  function showCharacterDialogError(message) {
    characterDialogError.textContent = message || '';
    characterDialogError.hidden = !message;
  }

  function updateCharacterPreview() {
    const scale = clamp(Number(characterScale.value) / 100, .6, 1.4, 1);
    const stage = characterImagePreview.parentElement;
    stage.style.setProperty('--character-preview-scale', String(scale));
    const idleMode = selectedCharacterIdleMode();
    const imageSource = selectedCharacterImage?.previewUrl || existingCharacterImageSource;
    const idleSource = selectedCharacterIdle?.previewUrl || existingCharacterIdleSource;
    characterIdleMaterial.hidden = idleMode !== 'animated';
    if (idleMode === 'animated' && idleSource) {
      characterImagePreview.hidden = true;
      if (characterIdlePreview.getAttribute('src') !== idleSource) {
        characterIdlePreview.src = idleSource;
        characterIdlePreview.load();
      }
      characterIdlePreview.hidden = false;
      characterPreviewEmpty.hidden = true;
      characterIdlePreview.play().catch(() => {});
    } else {
      characterIdlePreview.pause();
      characterIdlePreview.removeAttribute('src');
      characterIdlePreview.load();
      characterIdlePreview.hidden = true;
      if (imageSource) {
        if (characterImagePreview.getAttribute('src') !== imageSource) {
          characterImagePreview.src = imageSource;
        }
        characterImagePreview.hidden = false;
        characterPreviewEmpty.hidden = true;
      } else {
        characterImagePreview.removeAttribute('src');
        characterImagePreview.hidden = true;
        characterPreviewEmpty.hidden = false;
      }
    }
    characterScaleOutput.textContent = `${Math.round(scale * 100)}%`;
  }

  function discardCharacterSelections() {
    if (selectedCharacterImage?.token) api.discardPreview(selectedCharacterImage.token);
    if (selectedCharacterIdle?.token) api.discardPreview(selectedCharacterIdle.token);
    selectedCharacterImage = null;
    selectedCharacterIdle = null;
  }

  function resetCharacterDialog() {
    discardCharacterSelections();
    characterDialogMode = 'create';
    editingCharacterId = null;
    existingCharacterImageSource = null;
    existingCharacterIdleSource = null;
    characterCategory.value = 'pet';
    characterName.value = '';
    characterScale.value = '100';
    characterIdleModeInputs.forEach((input) => {
      input.checked = input.value === 'static';
    });
    characterImageStatus.textContent = '必须选择带透明通道的 PNG';
    characterIdleStatus.textContent = '选择透明 WebM';
    characterImagePreview.removeAttribute('src');
    characterImagePreview.hidden = true;
    characterIdlePreview.pause();
    characterIdlePreview.removeAttribute('src');
    characterIdlePreview.load();
    characterIdlePreview.hidden = true;
    characterPreviewEmpty.hidden = false;
    showCharacterDialogError('');
    updateCharacterPreview();
  }

  function openCreateCharacterDialog() {
    resetCharacterDialog();
    characterDialogKicker.textContent = '角色管理 · 新建';
    characterDialogTitle.textContent = '创建新角色';
    saveCharacterButton.textContent = '创建角色';
    characterDialog.showModal();
    requestAnimationFrame(() => characterName.focus());
  }

  async function openEditCharacterDialog(roleId) {
    setStatus('正在读取角色配置…', 'busy');
    const result = await api.getCharacter(roleId);
    if (!result?.ok) {
      setStatus(result?.error || '角色读取失败', 'error');
      return;
    }
    resetCharacterDialog();
    characterDialogMode = 'edit';
    editingCharacterId = roleId;
    const role = result.role;
    existingCharacterImageSource = role.imageSource;
    existingCharacterIdleSource = role.idleSource;
    characterCategory.value = role.category;
    characterName.value = role.name;
    characterScale.value = String(Math.round((role.scale || 1) * 100));
    characterIdleModeInputs.forEach((input) => {
      input.checked = input.value === role.idleMode;
    });
    characterImageStatus.textContent = role.imageSource ? '正在使用现有透明主图' : '请选择透明 PNG';
    characterIdleStatus.textContent = role.idleSource ? '正在使用现有待机 WebM' : '请选择透明 WebM';
    characterDialogKicker.textContent = `编辑${characterCategoryName(role.category)}角色`;
    characterDialogTitle.textContent = role.name;
    saveCharacterButton.textContent = '保存修改';
    showCharacterDialogError('');
    updateCharacterPreview();
    characterDialog.showModal();
    setStatus('配置已保存');
  }

  function renderData(nextData) {
    data = nextData;
    const standardImage = data.manifest.standardPose?.image || 'assets/dog.png';
    skillReference.src = standardImage;
    openingPlanReference.src = standardImage;
    openingReference.src = standardImage;
    roleAvatar.src = standardImage;
    const currentRoleName = data.manifest.roleName || '未命名角色';
    roleName.textContent = currentRoleName;
    appearanceSizeTitle.textContent = `“${currentRoleName}”的桌面尺寸`;
    appearanceSizeDescription.textContent = `拖动进度条时桌面上的“${currentRoleName}”会立即变化，尺寸会自动记住。`;
    startupStateTitle.textContent = `选择“${currentRoleName}”的普通待机方式`;
    voicePlaceholderDescription.textContent = `后续将在这里管理“${currentRoleName}，转圈”等名称唤醒指令，以及可导入的角色声音。`;
    scaleSlider.value = String(Math.round((data.appearance?.scale || 1) * 100));
    scaleOutput.textContent = `${scaleSlider.value}%`;
    const startupState = data.appearance?.startupState === 'standard-idle'
      ? 'standard-idle'
      : 'static';
    startupStateInputs.forEach((input) => {
      input.checked = input.value === startupState;
      if (input.value === 'standard-idle') {
        const available = Boolean(data.manifest.behavior?.idleSkillId);
        input.disabled = !available;
        input.closest('label')?.classList.toggle('is-disabled', !available);
        input.closest('label')?.setAttribute(
          'title',
          available ? '' : '当前角色尚未导入透明待机 WebM',
        );
      }
    });
    restoreSkillsButton.hidden = !data.canRestoreBuiltinSkills;
    skillCategory.innerHTML = '';
    for (const category of data.manifest.categories || []) {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      skillCategory.append(option);
    }
    renderSkills();
    renderCharacters();
    renderAutoSleepRule();
    renderRandomBehavior();
    renderOpeningPlans();
  }

  createCharacterButton.addEventListener('click', openCreateCharacterDialog);
  importCharacterPackageButton.addEventListener('click', async () => {
    importCharacterPackageButton.disabled = true;
    setStatus('正在检查并导入角色包…', 'busy');
    let result;
    try {
      result = await api.importCharacterPackage();
    } catch (error) {
      console.error('[豆豆桌宠] 导入角色包失败', error);
      result = { ok: false, error: `角色包导入失败：${error?.message || '程序没有返回结果'}` };
    } finally {
      importCharacterPackageButton.disabled = false;
    }
    if (!result?.ok) {
      setStatus(result?.cancelled ? '配置已保存' : (result?.error || '角色包导入失败'), result?.cancelled ? 'saved' : 'error');
      return;
    }
    renderData(result.data);
    setStatus(
      result.replaced
        ? `“${result.roleName}”已经完全替换更新`
        : result.switched
          ? `“${result.roleName}”已导入并切换`
          : `“${result.roleName}”已加入角色库`,
    );
  });

  chooseCharacterImageButton.addEventListener('click', async () => {
    setStatus('正在选择角色主图…', 'busy');
    const result = await api.chooseCharacterImage();
    if (!result?.ok) {
      setStatus(result?.cancelled ? '配置已保存' : (result?.error || '角色主图选择失败'), result?.cancelled ? 'saved' : 'error');
      if (!result?.cancelled) showCharacterDialogError(result?.error || '角色主图选择失败');
      return;
    }
    if (selectedCharacterImage?.token) api.discardPreview(selectedCharacterImage.token);
    selectedCharacterImage = result.image;
    characterImageStatus.textContent = `${result.image.fileName} · ${result.image.width}×${result.image.height}`;
    showCharacterDialogError('');
    updateCharacterPreview();
    setStatus('等待保存角色', 'busy');
  });

  chooseCharacterIdleButton.addEventListener('click', async () => {
    setStatus('正在选择待机动画…', 'busy');
    const result = await api.chooseCharacterIdle();
    if (!result?.ok) {
      setStatus(result?.cancelled ? '配置已保存' : (result?.error || '待机动画选择失败'), result?.cancelled ? 'saved' : 'error');
      if (!result?.cancelled) showCharacterDialogError(result?.error || '待机动画选择失败');
      return;
    }
    if (selectedCharacterIdle?.token) api.discardPreview(selectedCharacterIdle.token);
    selectedCharacterIdle = result.media;
    characterIdleStatus.textContent = result.media.fileName;
    showCharacterDialogError('');
    updateCharacterPreview();
    setStatus('等待保存角色', 'busy');
  });

  characterIdleModeInputs.forEach((input) => {
    input.addEventListener('change', updateCharacterPreview);
  });
  characterScale.addEventListener('input', updateCharacterPreview);

  characterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') {
      characterDialog.close();
      setStatus('配置已保存');
      return;
    }
    const name = characterName.value.trim();
    if (!name) {
      showCharacterDialogError('请填写角色名称。');
      characterName.focus();
      return;
    }
    if (characterDialogMode === 'create' && !selectedCharacterImage?.token) {
      showCharacterDialogError('请先选择透明 PNG 角色主图。');
      return;
    }
    const idleMode = selectedCharacterIdleMode();
    if (
      idleMode === 'animated' &&
      !selectedCharacterIdle?.token &&
      !existingCharacterIdleSource
    ) {
      showCharacterDialogError('请选择透明待机 WebM，或改用静止图片。');
      return;
    }
    saveCharacterButton.disabled = true;
    showCharacterDialogError('');
    setStatus(characterDialogMode === 'create' ? '正在创建角色…' : '正在保存角色…', 'busy');
    const draft = {
      name,
      category: characterCategory.value,
      scale: Number(characterScale.value) / 100,
      idleMode,
      imageToken: selectedCharacterImage?.token || null,
      idleToken: selectedCharacterIdle?.token || null,
    };
    let result;
    try {
      result = characterDialogMode === 'create'
        ? await api.createCharacter(draft)
        : await api.updateCharacter(editingCharacterId, draft);
    } catch (error) {
      console.error('[豆豆桌宠] 角色保存失败', error);
      result = { ok: false, error: `角色保存失败：${error?.message || '程序没有返回结果'}` };
    }
    saveCharacterButton.disabled = false;
    if (!result?.ok) {
      showCharacterDialogError(result?.error || '角色保存失败，请重试。');
      setStatus(result?.error || '角色保存失败', 'error');
      return;
    }
    selectedCharacterImage = null;
    selectedCharacterIdle = null;
    renderData(result.data);
    characterDialog.close();
    setStatus(characterDialogMode === 'create' ? '角色已创建' : '角色修改已保存');
  });

  characterDialog.addEventListener('close', () => {
    discardCharacterSelections();
    characterIdlePreview.pause();
    characterIdlePreview.removeAttribute('src');
    characterIdlePreview.load();
    showCharacterDialogError('');
  });

  characterGroups.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    const card = event.target.closest('[data-role-id]');
    if (!actionButton || !card) return;
    const role = data?.characters?.roles?.find((item) => item.id === card.dataset.roleId);
    if (!role) return;
    if (actionButton.dataset.action === 'edit') {
      await openEditCharacterDialog(role.id);
      return;
    }
    if (actionButton.dataset.action === 'switch') {
      setStatus('正在切换角色…', 'busy');
      const result = await api.switchCharacter(role.id);
      if (!result?.ok) {
        if (result?.switchState) {
          data.characterSwitch = result.switchState;
          renderCharacters();
        }
        setStatus(result?.error || '角色切换失败', 'error');
        return;
      }
      renderData(result.data);
      setStatus(`已切换为“${role.name}”`);
      return;
    }
    if (actionButton.dataset.action === 'default') {
      setStatus('正在设置默认启动角色…', 'busy');
      const result = await api.setDefaultCharacter(role.id);
      if (!result?.ok) {
        setStatus(result?.error || '默认角色保存失败', 'error');
        return;
      }
      renderData(result.data);
      setStatus(`“${role.name}”已设为默认启动角色`);
      return;
    }
    if (actionButton.dataset.action === 'export') {
      actionButton.disabled = true;
      setStatus(`正在导出“${role.name}”…`, 'busy');
      let result;
      try {
        result = await api.exportCharacterPackage(role.id);
      } catch (error) {
        console.error('[豆豆桌宠] 导出角色包失败', error);
        result = { ok: false, error: `角色包导出失败：${error?.message || '程序没有返回结果'}` };
      } finally {
        actionButton.disabled = false;
      }
      if (!result?.ok) {
        setStatus(result?.cancelled ? '配置已保存' : (result?.error || '角色包导出失败'), result?.cancelled ? 'saved' : 'error');
        return;
      }
      setStatus(`“${role.name}”角色包已导出`);
      return;
    }
    if (actionButton.dataset.action === 'delete') {
      const confirmed = await requestConfirmation({
        title: '永久删除角色',
        message: `确定永久删除“${role.name}”吗？\n它独立保存的图片、视频、声音、技能、开场和规则都会一起删除，无法恢复。`,
        confirmText: '永久删除',
      });
      if (!confirmed) return;
      setStatus('正在删除角色…', 'busy');
      const result = await api.deleteCharacter(role.id);
      if (!result?.ok) {
        setStatus(result?.error || '角色删除失败', 'error');
        return;
      }
      renderData(result.data);
      setStatus('角色已永久删除');
    }
  });

  function showDialogError(message) {
    dialogError.textContent = message;
    dialogError.hidden = !message;
  }

  function formatPreviewTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(1).padStart(4, '0')}`;
  }

  function updatePreviewTimeline() {
    const duration = Number.isFinite(preview.duration) ? preview.duration : 0;
    const current = Number.isFinite(preview.currentTime) ? preview.currentTime : 0;
    previewSeek.disabled = duration <= 0;
    previewSeek.max = String(Math.max(1, Math.round(duration * 1000)));
    if (!seekingPreview) previewSeek.value = String(Math.round(current * 1000));
    previewTime.textContent = `${formatPreviewTime(current)} / ${formatPreviewTime(duration)}`;
  }

  function resetPreview() {
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    preview.hidden = true;
    previewEmpty.hidden = false;
    autoMatchOnLoad = false;
    calibrationStatus.textContent = '';
    seekingPreview = false;
    previewSeek.value = '0';
    updatePreviewPlaybackButton();
    updatePreviewTimeline();
  }

  function showPreview(source) {
    preview.crossOrigin = 'anonymous';
    preview.src = source;
    preview.hidden = false;
    previewEmpty.hidden = true;
    preview.load();
    updatePreviewPlaybackButton();
  }

  function updatePreviewPlaybackButton() {
    const paused = preview.paused;
    pausePreviewButton.textContent = paused ? '继续预览' : '暂停预览';
    pausePreviewButton.disabled = !preview.getAttribute('src');
    pausePreviewButton.setAttribute('aria-pressed', String(paused));
  }

  async function openImportDialog() {
    setStatus('正在选择素材…', 'busy');
    const result = await api.chooseSkillMedia();
    if (!result?.ok) {
      setStatus(result?.cancelled ? '配置已保存' : (result?.error || '选择素材失败'), result?.cancelled ? 'saved' : 'error');
      return;
    }
    dialogMode = 'import';
    editingSkillId = null;
    selectedMedia = result.media;
    dialogKicker.textContent = '导入本地素材';
    dialogTitle.textContent = result.media.fileName;
    skillName.value = result.media.suggestedName;
    skillType.value = result.media.suggestedType;
    skillType.disabled = false;
    skillPinned.checked = false;
    skillMuted.checked = result.media.suggestedType === 'transparent';
    skillCategory.value = result.media.suggestedType === 'scene' ? 'scene' : 'daily';
    setVisual({ scale: 1, offsetX: 0, offsetY: 0 });
    updateCalibrationMode();
    autoMatchOnLoad = result.media.suggestedType === 'transparent';
    showDialogError('');
    showPreview(result.media.previewUrl);
    setStatus('等待保存技能', 'busy');
    dialog.showModal();
  }

  function openEditDialog(skill, autoPlay = false) {
    dialogMode = 'edit';
    editingSkillId = skill.id;
    selectedMedia = null;
    dialogKicker.textContent = sourceLabel(skill);
    dialogTitle.textContent = skill.name;
    skillName.value = skill.name;
    skillCategory.value = skill.category;
    skillType.value = skill.type;
    skillType.disabled = true;
    skillPinned.checked = Boolean(skill.pinned);
    skillMuted.checked = skill.muted !== false;
    setVisual(skill.visual);
    updateCalibrationMode();
    autoMatchOnLoad = false;
    showDialogError('');
    showPreview(skill.source);
    dialog.showModal();
    if (autoPlay) preview.play().catch(() => {});
  }

  importButton.addEventListener('click', openImportDialog);

  for (const control of [skillScale, skillOffsetX, skillOffsetY]) {
    control.addEventListener('input', () => {
      calibrationStatus.textContent = '正在使用手动校准值。';
      updatePreviewVisual();
    });
  }

  for (const [numberInput, rangeInput] of [
    [skillScaleNumber, skillScale],
    [skillOffsetXNumber, skillOffsetX],
    [skillOffsetYNumber, skillOffsetY],
  ]) {
    numberInput.addEventListener('input', () => {
      if (numberInput.value === '' || numberInput.value === '-') return;
      const value = clamp(Number(numberInput.value), Number(rangeInput.min), Number(rangeInput.max), Number(rangeInput.value));
      rangeInput.value = String(value);
      calibrationStatus.textContent = '正在使用手动校准值。';
      updatePreviewVisual();
    });
  }

  skillType.addEventListener('change', () => {
    updateCalibrationMode();
    if (dialogMode === 'import') {
      skillMuted.checked = skillType.value === 'transparent';
      skillCategory.value = skillType.value === 'scene' ? 'scene' : 'daily';
    }
  });

  autoMatchButton.addEventListener('click', autoMatchVisual);
  pausePreviewButton.addEventListener('click', async () => {
    if (!preview.getAttribute('src')) return;
    if (preview.paused) {
      await preview.play().catch(() => {});
      calibrationStatus.textContent = '预览继续播放，可再次暂停选择其他画面。';
    } else {
      preview.pause();
      calibrationStatus.textContent = '预览已暂停，现在可以对照这一帧调整大小和位置。';
    }
    updatePreviewPlaybackButton();
  });
  previewSeek.addEventListener('pointerdown', () => {
    seekingPreview = true;
    if (!preview.paused) preview.pause();
    calibrationStatus.textContent = '预览已暂停，拖动进度条选择需要校准的画面。';
  });
  previewSeek.addEventListener('input', () => {
    if (!Number.isFinite(preview.duration)) return;
    seekingPreview = true;
    preview.currentTime = clamp(Number(previewSeek.value) / 1000, 0, preview.duration, 0);
    previewTime.textContent = `${formatPreviewTime(preview.currentTime)} / ${formatPreviewTime(preview.duration)}`;
  });
  previewSeek.addEventListener('change', () => {
    seekingPreview = false;
    updatePreviewTimeline();
  });
  resetVisualButton.addEventListener('click', () => {
    setVisual({ scale: 1, offsetX: 0, offsetY: 0 });
    calibrationStatus.textContent = '已恢复为素材原始大小和位置。';
  });

  preview.addEventListener('loadeddata', () => {
    updatePreviewVisual();
    updatePreviewTimeline();
    preview.play().catch(() => {});
    if (autoMatchOnLoad) {
      autoMatchOnLoad = false;
      requestAnimationFrame(() => autoMatchVisual());
    }
  });
  preview.addEventListener('play', updatePreviewPlaybackButton);
  preview.addEventListener('pause', updatePreviewPlaybackButton);
  preview.addEventListener('timeupdate', updatePreviewTimeline);
  preview.addEventListener('durationchange', updatePreviewTimeline);
  preview.addEventListener('seeked', updatePreviewTimeline);

  window.addEventListener('resize', updatePreviewVisual);

  restoreSkillsButton.addEventListener('click', async () => {
    setStatus('正在恢复内置技能…', 'busy');
    const result = await api.restoreBuiltinSkills();
    if (!result?.ok) {
      setStatus(result?.error || '恢复失败', 'error');
      return;
    }
    renderData(result.data);
    setStatus('内置技能已恢复');
  });

  skillList.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    const card = event.target.closest('[data-skill-id]');
    if (!actionButton || !card) return;
    const skill = data.manifest.skills.find((item) => item.id === card.dataset.skillId);
    if (!skill) return;
    if (actionButton.dataset.action === 'preview') {
      openEditDialog(skill, true);
      return;
    }
    if (actionButton.dataset.action === 'edit') {
      openEditDialog(skill);
      return;
    }
    if (actionButton.dataset.action === 'delete') {
      const usage = await api.getSkillUsage(skill.id);
      const affected = usage?.ok ? usage.affected || [] : [];
      const affectedMessage = affected.length > 0
        ? `\n\n当前会影响：\n• ${affected.join('\n• ')}\n相关流程会自动清除该步骤；如果删除的是必需循环动画，无互动规则会自动关闭。`
        : '\n\n当前没有开场、待机、随机行为或无互动流程使用这个技能。';
      const confirmed = await requestConfirmation({
        title: '删除技能',
        message: `确定删除技能“${skill.name}”吗？${affectedMessage}`,
        confirmText: '删除技能',
      });
      if (!confirmed) return;
      setStatus('正在删除技能…', 'busy');
      const result = await api.deleteSkill(skill.id);
      if (!result?.ok) {
        setStatus(result?.error || '删除失败', 'error');
        return;
      }
      renderData(result.data);
      setStatus('技能已删除');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') {
      dialog.close();
      setStatus('配置已保存');
      return;
    }

    const name = skillName.value.trim();
    if (!name) {
      showDialogError('请填写技能名称。');
      return;
    }
    saveSkillButton.disabled = true;
    showDialogError('');
    setStatus('正在保存技能…', 'busy');
    let result = null;
    try {
      if (dialogMode === 'import') {
        result = await api.importSkill({
          token: selectedMedia?.token,
          name,
          category: skillCategory.value,
          type: skillType.value,
          pinned: skillPinned.checked,
          muted: skillMuted.checked,
          visual: getVisual(),
          durationMs: Number.isFinite(preview.duration) ? Math.round(preview.duration * 1000) : 0,
        });
      } else {
        result = await api.updateSkill(editingSkillId, {
          name,
          category: skillCategory.value,
          pinned: skillPinned.checked,
          muted: skillMuted.checked,
          visual: getVisual(),
        });
      }
    } catch (error) {
      console.error('[豆豆桌宠] 保存技能失败', error);
      result = {
        ok: false,
        error: `保存失败：${error?.message || '程序没有返回结果，请重新选择素材后再试。'}`,
      };
    } finally {
      saveSkillButton.disabled = false;
    }
    if (!result?.ok) {
      const message = result?.error || '保存失败';
      showDialogError(message);
      setStatus(message, 'error');
      return;
    }
    renderData(result.data);
    dialog.close();
    setStatus('技能已保存');
  });

  dialog.addEventListener('close', () => {
    if (selectedMedia?.token) api.discardPreview(selectedMedia.token);
    resetPreview();
    selectedMedia = null;
    editingSkillId = null;
    showDialogError('');
  });

  scaleSlider.addEventListener('input', () => {
    scaleOutput.textContent = `${scaleSlider.value}%`;
    clearTimeout(scaleSaveTimer);
    setStatus(`正在调整“${data?.manifest?.roleName || '当前角色'}”的大小…`, 'busy');
    scaleSaveTimer = setTimeout(async () => {
      const result = await api.setScale(Number(scaleSlider.value) / 100);
      if (!result?.ok) {
        setStatus(result?.error || '尺寸保存失败', 'error');
        return;
      }
      data.appearance = result.appearance;
      setStatus('尺寸已保存');
    }, 35);
  });

  startupStateInputs.forEach((input) => {
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      setStatus('正在切换启动状态…', 'busy');
      const result = await api.setStartupState(input.value);
      if (!result?.ok) {
        setStatus(result?.error || '启动状态保存失败', 'error');
        renderData(data);
        return;
      }
      data.appearance = result.appearance;
      setStatus(input.value === 'standard-idle' ? '已使用标准待机状态' : '已使用静止状态');
    });
  });

  autoSleepEnabled.addEventListener('change', () => {
    updateAutoSleepRuleSummary();
    scheduleAutoSleepSave(0);
  });
  autoSleepSeconds.addEventListener('input', updateAutoSleepRuleSummary);
  autoSleepSeconds.addEventListener('change', () => scheduleAutoSleepSave(0));
  for (const control of [autoSleepEnterSkill, autoSleepLoopSkill, autoSleepWakeSkill, autoSleepWakePointer]) {
    control.addEventListener('change', () => {
      updateAutoSleepRuleSummary();
      scheduleAutoSleepSave(0);
    });
  }
  autoSleepFields.addEventListener('click', (event) => {
    const button = event.target.closest('[data-calibrate-inactivity]');
    if (!button) return;
    const selectByPhase = {
      enter: autoSleepEnterSkill,
      loop: autoSleepLoopSkill,
      recover: autoSleepWakeSkill,
    };
    const select = selectByPhase[button.dataset.calibrateInactivity];
    const skill = data?.manifest?.skills?.find((item) => item.id === select?.value);
    if (!skill) {
      autoSleepRuleStatus.textContent = button.dataset.calibrateInactivity === 'loop'
        ? '请先选择循环状态动画。'
        : '当前步骤没有选择动画，无需校准。';
      return;
    }
    openEditDialog(skill, true);
    calibrationStatus.textContent = '以普通待机角色为参照，调整这一段动画；三段流程会共同对齐到底部中心锚点。';
  });
  testInactivityFlowButton.addEventListener('click', async () => {
    testInactivityFlowButton.disabled = true;
    try {
      const saved = await saveAutoSleepRule();
      if (!saved) return;
      const result = await api.testInactivityFlow();
      if (!result?.ok) {
        autoSleepRuleStatus.textContent = result?.error || '无法开始测试。';
        setStatus(autoSleepRuleStatus.textContent, 'error');
        return;
      }
      autoSleepRuleStatus.textContent = '已在桌面开始测试；鼠标碰到循环状态中的角色即可恢复。';
      setStatus('正在桌面测试无互动流程');
    } finally {
      testInactivityFlowButton.disabled = !autoSleepEnabled.checked;
    }
  });

  randomEnabled.addEventListener('change', () => {
    updateRandomBehaviorSummary();
    if (randomEnabled.checked && getRandomBehaviorDraft().skillIds.length === 0) {
      randomRuleStatus.textContent = '请先勾选至少一个随机播放技能，选择后会自动保存并启用。';
      setStatus('等待选择随机技能', 'busy');
      return;
    }
    scheduleRandomBehaviorSave(0);
  });
  randomInterval.addEventListener('input', updateRandomBehaviorSummary);
  randomInterval.addEventListener('change', () => scheduleRandomBehaviorSave(0));
  randomSkillList.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    updateRandomBehaviorSummary();
    scheduleRandomBehaviorSave(0);
  });
  deleteRandomRule.addEventListener('click', async () => {
    const confirmed = await requestConfirmation({
      title: '删除随机行为规则',
      message: `删除后，“${data?.manifest?.roleName || '当前角色'}”不会在无互动状态中自行恢复并表演技能。确定删除吗？`,
      confirmText: '删除规则',
    });
    if (!confirmed) return;
    setStatus('正在删除随机行为规则…', 'busy');
    const result = await api.deleteRandomBehavior();
    if (!result?.ok) {
      setStatus(result?.error || '随机行为规则删除失败', 'error');
      return;
    }
    renderData(result.data);
    setStatus('随机行为规则已删除');
  });
  restoreRandomRule.addEventListener('click', async () => {
    setStatus('正在恢复随机行为规则…', 'busy');
    const result = await api.restoreRandomBehavior();
    if (!result?.ok) {
      setStatus(result?.error || '随机行为规则恢复失败', 'error');
      return;
    }
    renderData(result.data);
    setStatus('已恢复默认随机行为规则');
  });

  createOpeningPlanButton.addEventListener('click', createOpeningPlan);
  openingEmptyCreate.addEventListener('click', createOpeningPlan);
  openingPlanList.addEventListener('click', (event) => {
    const item = event.target.closest('[data-plan-id]');
    if (!item) return;
    selectedOpeningPlanId = item.dataset.planId;
    stopOpeningPreview();
    renderOpeningPlans();
  });
  openingPlayOnStartup.addEventListener('change', async () => {
    setStatus('正在保存启动播放设置…', 'busy');
    const result = await api.updateOpeningSettings({ playOnStartup: openingPlayOnStartup.checked });
    if (!result?.ok) {
      setStatus(result?.error || '启动播放设置保存失败', 'error');
      renderData(data);
      return;
    }
    renderData(result.data);
    setStatus(openingPlayOnStartup.checked ? '每次启动都会播放当前开场' : '启动时已不再播放开场');
  });
  openingCurrentPlan.addEventListener('change', async () => {
    const plan = getSelectedOpeningPlan();
    if (!plan || !openingCurrentPlan.checked) return;
    setStatus('正在切换当前开场方案…', 'busy');
    const result = await api.updateOpeningSettings({ currentPlanId: plan.id });
    if (!result?.ok) {
      setStatus(result?.error || '当前方案切换失败', 'error');
      return;
    }
    renderData(result.data);
    setStatus('当前开场方案已切换');
  });
  openingPlanEnabled.addEventListener('change', async () => {
    const plan = getSelectedOpeningPlan();
    if (!plan) return;
    const result = await api.updateOpeningPlan(plan.id, { enabled: openingPlanEnabled.checked });
    if (!result?.ok) {
      setStatus(result?.error || '方案状态保存失败', 'error');
      renderData(data);
      return;
    }
    renderData(result.data);
    setStatus(openingPlanEnabled.checked ? '开场方案已启用' : '开场方案已停用');
  });
  renameOpeningPlanButton.addEventListener('click', async () => {
    const plan = getSelectedOpeningPlan();
    if (!plan) return;
    const name = await requestTextInput({
      title: '修改方案名称',
      label: '方案名称',
      value: plan.name,
      confirmText: '保存名称',
    });
    if (name === null || !name.trim()) return;
    const result = await api.updateOpeningPlan(plan.id, { name });
    if (!result?.ok) { setStatus(result?.error || '方案改名失败', 'error'); return; }
    renderData(result.data);
    setStatus('开场方案已改名');
  });
  duplicateOpeningPlanButton.addEventListener('click', async () => {
    const plan = getSelectedOpeningPlan();
    if (!plan) return;
    setStatus('正在复制开场方案…', 'busy');
    const result = await api.duplicateOpeningPlan(plan.id);
    if (!result?.ok) { setStatus(result?.error || '方案复制失败', 'error'); return; }
    selectedOpeningPlanId = result.planId;
    renderData(result.data);
    setStatus('开场方案已复制');
  });
  deleteOpeningPlanButton.addEventListener('click', async () => {
    const plan = getSelectedOpeningPlan();
    if (!plan) return;
    const confirmed = await requestConfirmation({
      title: '删除开场方案',
      message: `确定删除开场方案“${plan.name}”吗？`,
      confirmText: '删除方案',
    });
    if (!confirmed) return;
    const result = await api.deleteOpeningPlan(plan.id);
    if (!result?.ok) { setStatus(result?.error || '方案删除失败', 'error'); return; }
    selectedOpeningPlanId = result.data.opening?.currentPlanId || null;
    stopOpeningPreview();
    renderData(result.data);
    setStatus('开场方案已删除');
  });
  addOpeningSegmentButton.addEventListener('click', () => chooseOpeningSegment());
  previewOpeningPlanButton.addEventListener('click', () => {
    const plan = getSelectedOpeningPlan();
    if (plan) previewOpeningSegments(plan.segments);
  });
  toggleOpeningPreviewButton.addEventListener('click', async () => {
    if (!openingPreview.getAttribute('src')) return;
    if (openingPreview.paused) {
      if (
        Number.isFinite(openingPreview.duration) &&
        openingPreview.currentTime >= openingPreview.duration - 0.04
      ) {
        openingPreview.currentTime = 0;
      }
      await openingPreview.play().catch(() => {});
    } else {
      openingPreview.pause();
    }
    updateOpeningPreviewPlaybackButton();
  });
  stopOpeningPreviewButton.addEventListener('click', () => stopOpeningPreview('预览已停止'));
  openingPreview.addEventListener('ended', playOpeningPreviewSegment);
  openingPreview.addEventListener('loadedmetadata', updateOpeningPreviewTimeline);
  openingPreview.addEventListener('durationchange', updateOpeningPreviewTimeline);
  openingPreview.addEventListener('timeupdate', updateOpeningPreviewTimeline);
  openingPreview.addEventListener('play', updateOpeningPreviewPlaybackButton);
  openingPreview.addEventListener('pause', updateOpeningPreviewPlaybackButton);
  openingPreviewSeek.addEventListener('pointerdown', () => {
    openingPreviewSeeking = true;
    openingPreview.pause();
    updateOpeningPreviewPlaybackButton();
  });
  openingPreviewSeek.addEventListener('input', () => {
    if (!Number.isFinite(openingPreview.duration)) return;
    openingPreviewSeeking = true;
    openingPreview.currentTime = clamp(
      Number(openingPreviewSeek.value) / 1000,
      0,
      openingPreview.duration,
      0,
    );
    openingPreviewTime.textContent = `${formatPreviewTime(openingPreview.currentTime)} / ${formatPreviewTime(openingPreview.duration)}`;
  });
  openingPreviewSeek.addEventListener('change', () => {
    openingPreviewSeeking = false;
    updateOpeningPreviewTimeline();
  });

  openingSegmentList.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-segment-id]');
    const action = event.target.closest('[data-action]')?.dataset.action;
    const plan = getSelectedOpeningPlan();
    const segment = plan?.segments.find((item) => item.id === card?.dataset.segmentId);
    if (!plan || !segment || !action) return;
    if (action === 'edit') {
      openOpeningSegmentEditor(plan.id, segment.id);
      return;
    }
    if (action === 'preview') {
      previewOpeningSegments([segment]);
      return;
    }
    if (action === 'replace') {
      chooseOpeningSegment({ replaceSegmentId: segment.id });
      return;
    }
    if (action === 'delete') {
      const confirmed = await requestConfirmation({
        title: '删除开场片段',
        message: `确定删除片段“${segment.name}”吗？`,
        confirmText: '删除片段',
      });
      if (!confirmed) return;
      const result = await api.deleteOpeningSegment(plan.id, segment.id);
      if (!result?.ok) { setStatus(result?.error || '片段删除失败', 'error'); return; }
      stopOpeningPreview();
      renderData(result.data);
      setStatus('开场片段已删除');
    }
  });
  openingSegmentList.addEventListener('change', async (event) => {
    const card = event.target.closest('[data-segment-id]');
    const plan = getSelectedOpeningPlan();
    const segment = plan?.segments.find((item) => item.id === card?.dataset.segmentId);
    const field = event.target.dataset.field;
    if (!plan || !segment || !field) return;
    let changes;
    if (field === 'enabled' || field === 'muted') changes = { [field]: event.target.checked };
    else return;
    const result = await api.updateOpeningSegment(plan.id, segment.id, changes);
    if (!result?.ok) { setStatus(result?.error || '片段设置保存失败', 'error'); renderData(data); return; }
    renderData(result.data);
    setStatus('开场片段设置已保存');
  });
  openingSegmentList.addEventListener('dragstart', (event) => {
    const handle = event.target.closest('.opening-drag-handle');
    const card = handle?.closest('[data-segment-id]');
    if (!handle || !card) {
      event.preventDefault();
      return;
    }
    draggedOpeningSegmentId = card.dataset.segmentId;
    card.classList.add('is-dragging');
    event.dataTransfer.effectAllowed = 'move';
  });
  openingSegmentList.addEventListener('dragover', (event) => {
    event.preventDefault();
    const draggingCard = openingSegmentList.querySelector('.is-dragging');
    const target = event.target.closest('[data-segment-id]');
    if (!draggingCard || !target || draggingCard === target) return;
    const before = event.clientY < target.getBoundingClientRect().top + target.offsetHeight / 2;
    openingSegmentList.insertBefore(draggingCard, before ? target : target.nextSibling);
  });
  openingSegmentList.addEventListener('dragend', async () => {
    const card = openingSegmentList.querySelector('.is-dragging');
    if (card) card.classList.remove('is-dragging');
    const plan = getSelectedOpeningPlan();
    if (!plan || !draggedOpeningSegmentId) return;
    draggedOpeningSegmentId = null;
    const ids = [...openingSegmentList.querySelectorAll('[data-segment-id]')].map((item) => item.dataset.segmentId);
    const result = await api.reorderOpeningSegments(plan.id, ids);
    if (!result?.ok) { setStatus(result?.error || '开场顺序保存失败', 'error'); renderData(data); return; }
    renderData(result.data);
    setStatus('开场片段顺序已保存');
  });

  for (const control of [openingScale, openingOffsetX, openingOffsetY]) {
    control.addEventListener('input', () => {
      openingCalibrationStatus.textContent = '正在使用手动校准值。';
      updateOpeningEditorVisual();
    });
  }
  openingSegmentMuted.addEventListener('change', () => {
    openingEditPreview.muted = openingSegmentMuted.checked;
  });
  toggleOpeningEditPreview.addEventListener('click', async () => {
    if (!openingEditPreview.getAttribute('src')) return;
    if (openingEditPreview.paused) {
      if (
        Number.isFinite(openingEditPreview.duration) &&
        openingEditPreview.currentTime >= openingEditPreview.duration - 0.04
      ) {
        openingEditPreview.currentTime = 0;
      }
      await openingEditPreview.play().catch(() => {});
      openingCalibrationStatus.textContent = '预览继续播放，可再次暂停选择其他画面。';
    } else {
      openingEditPreview.pause();
      openingCalibrationStatus.textContent = '预览已暂停，现在可以调整大小和位置。';
    }
    updateOpeningEditorPlaybackButton();
  });
  matchOpeningEndButton.addEventListener('click', matchOpeningEndToIdle);
  resetOpeningVisualButton.addEventListener('click', () => {
    setOpeningEditorVisual({ scale: 1, offsetX: 0, offsetY: 0 });
    openingCalibrationStatus.textContent = '已恢复为素材原始大小和位置。';
  });
  openingEditSeek.addEventListener('pointerdown', () => {
    openingEditSeeking = true;
    openingEditPreview.pause();
    updateOpeningEditorPlaybackButton();
    openingCalibrationStatus.textContent = '预览已暂停，拖动进度条选择需要校准的画面。';
  });
  openingEditSeek.addEventListener('input', () => {
    if (!Number.isFinite(openingEditPreview.duration)) return;
    openingEditSeeking = true;
    openingEditPreview.currentTime = clamp(
      Number(openingEditSeek.value) / 1000,
      0,
      openingEditPreview.duration,
      0,
    );
    openingEditTime.textContent = `${formatPreviewTime(openingEditPreview.currentTime)} / ${formatPreviewTime(openingEditPreview.duration)}`;
  });
  openingEditSeek.addEventListener('change', () => {
    openingEditSeeking = false;
    updateOpeningEditorTimeline();
  });
  openingEditPreview.addEventListener('loadeddata', () => {
    updateOpeningEditorVisual();
    updateOpeningEditorTimeline();
    updateOpeningEditorPlaybackButton();
  });
  openingEditPreview.addEventListener('durationchange', updateOpeningEditorTimeline);
  openingEditPreview.addEventListener('timeupdate', updateOpeningEditorTimeline);
  openingEditPreview.addEventListener('seeked', updateOpeningEditorTimeline);
  openingEditPreview.addEventListener('play', updateOpeningEditorPlaybackButton);
  openingEditPreview.addEventListener('pause', updateOpeningEditorPlaybackButton);

  openingSegmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') {
      openingSegmentDialog.close();
      return;
    }
    const name = openingSegmentName.value.trim();
    if (!name) {
      showOpeningEditorError('请填写片段名称。');
      return;
    }
    if (!editingOpeningPlanId || !editingOpeningSegmentId) {
      showOpeningEditorError('没有找到正在编辑的开场片段，请关闭后重试。');
      return;
    }
    saveOpeningSegmentButton.disabled = true;
    setStatus('正在保存开场片段设置…', 'busy');
    const result = await api.updateOpeningSegment(
      editingOpeningPlanId,
      editingOpeningSegmentId,
      {
        name,
        enabled: openingSegmentEnabled.checked,
        muted: openingSegmentMuted.checked,
        visual: getOpeningEditorVisual(),
      },
    );
    saveOpeningSegmentButton.disabled = false;
    if (!result?.ok) {
      const message = result?.error || '开场片段设置保存失败';
      showOpeningEditorError(message);
      setStatus(message, 'error');
      return;
    }
    renderData(result.data);
    openingSegmentDialog.close();
    setStatus('开场片段的大小、位置和播放设置已保存');
  });
  openingSegmentDialog.addEventListener('close', () => {
    openingEditPreview.pause();
    openingEditPreview.removeAttribute('src');
    openingEditPreview.load();
    openingEditSeek.value = '0';
    editingOpeningPlanId = null;
    editingOpeningSegmentId = null;
    openingEditSeeking = false;
    showOpeningEditorError('');
    updateOpeningEditorTimeline();
    updateOpeningEditorPlaybackButton();
  });
  window.addEventListener('resize', () => {
    if (openingSegmentDialog.open) updateOpeningEditorVisual();
    const segment = openingPreviewQueue[openingPreviewIndex];
    if (segment) updateOpeningPreviewTransform(segment);
  });

  api.onCharacterSwitchState((switchState) => {
    if (!data || !switchState) return;
    data.characterSwitch = switchState;
    renderCharacters();
  });

  api.onDataChanged((nextData) => renderData(nextData));

  api.getData().then((initialData) => {
    if (previewLegend) calibrationStage.append(previewLegend);
    if (visualCalibration) formGrid.append(visualCalibration);
    renderData(initialData);
    setStatus('配置已保存');
  }).catch((error) => {
    console.error(error);
    setStatus('设置读取失败', 'error');
  });
})();
