const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { Readable } = require('node:stream');
const {
  CHARACTER_PROFILE_SCHEMA_VERSION,
  MAX_CHARACTERS,
  addRoleMetadata,
  getCharacterRegistrySnapshot,
  getRoleDirectoryPath,
  getRoleMediaDirectoryPath,
  getRoleProfilePath,
  initializeCharacterStore,
  isSafeRoleId,
  markRoleUpdated,
  removeRoleMetadata,
  saveCharacterIndex,
  setDefaultRole,
  updateRoleMetadata,
  writeJsonAtomic,
} = require('./character-store');
const {
  PACKAGE_EXTENSION,
  packageMediaSource,
  parsePackageMediaSource,
  readCharacterPackage,
  writeCharacterPackage,
} = require('./character-package');
const {
  getInactivityRuleReferences,
  normalizeInactivityRule,
} = require('./inactivity-flow');
const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Tray,
  ipcMain,
  powerMonitor,
  protocol,
  screen,
} = require('electron');

const PET_WINDOW_SIZE = 440;
const SCENE_WINDOW_SIZE = 460;
// Keep real fur pixels away from the DWM/work-area clipping line. This small
// inset also protects anti-aliasing and display-scale rounding at 150% DPI.
const PET_EDGE_SAFE_MARGIN = 28;
const PET_SHAPE_PADDING = 36;
// The hover controls live above the pet and are not part of the role image's
// alpha bounds. Keep their native Windows region explicitly, otherwise a
// narrow imported character can cause the close button to be clipped by
// BrowserWindow.setShape(). Values mirror the base 440px canvas CSS layout
// and include room for the buttons' shadows.
const PET_CONTROL_BASE_BOUNDS = {
  left: 314,
  top: 44,
  right: 420,
  bottom: 115,
};
const LIFECYCLE_ANIMATION_MS = 520;
const isPrototypeQa = process.argv.includes('--prototype-qa');
const isInputQa = process.argv.includes('--input-qa');
const isSmokeTest = process.argv.includes('--smoke-test');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;
let isClosedToTray = false;
let isSceneMode = false;
let normalBounds = null;
let sceneBounds = null;
let petCanvasBounds = null;
let dragSession = null;
let dragPollTimer = null;
let dragShapeRestoreTimer = null;
let dragShapeConfirmTimer = null;
let lifecycleTimer = null;
let mousePassthrough = false;
let pointerProbeTimer = null;
let lastPointerProbeResult = null;
let currentWindowShape = [];
let animationStateHistory = [];
let dragOverlayActivationCount = 0;
let petScale = 1;
let petWindowSize = PET_WINDOW_SIZE;
let systemSleeping = false;
let screenLocked = false;
let bundledSkillManifest = null;
let userProfile = null;
let characterIndex = null;
let activeRoleId = 'doudou';
let currentAnimationMode = 'initializing';
let isCharacterSwitching = false;
let characterSwitchSequence = 0;
let pendingCharacterSwitch = null;
let centerRoleAfterVisualBounds = false;
const previewFiles = new Map();
// Fallback values match the current idle asset and CSS layout. The renderer
// replaces them with alpha-aware measurements as soon as the image loads.
const basePetVisualBounds = {
  left: 94,
  top: 170,
  right: 359,
  bottom: 418,
};
let petVisualBounds = { ...basePetVisualBounds };

const fallbackSkillManifest = {
  schemaVersion: 1,
  roleId: 'doudou',
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
      durationMs: 3933,
      muted: true,
      pinned: false,
      transition: 'standard',
      visual: { scale: 0.86, offsetX: 0, offsetY: 1 },
    },
    {
      id: 'spin',
      name: '原地转圈',
      category: 'daily',
      type: 'transparent',
      source: 'assets/media/doudou-spin.webm',
      durationMs: 5066,
      muted: true,
      pinned: true,
      transition: 'standard',
      visual: { scale: 1.24, offsetX: 0, offsetY: 0 },
    },
    {
      id: 'sleep-enter',
      name: '进入睡眠',
      category: 'daily',
      type: 'transparent',
      source: 'assets/media/doudou-sleep-enter.webm',
      durationMs: 5066,
      muted: true,
      pinned: false,
      transition: 'standard',
      visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
    },
    {
      id: 'sleep-loop',
      name: '睡觉呼吸',
      category: 'daily',
      type: 'transparent',
      source: 'assets/media/doudou-sleep-loop.webm',
      durationMs: 5066,
      muted: true,
      pinned: false,
      transition: 'standard',
      visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
    },
    {
      id: 'wake-up',
      name: '醒来',
      category: 'daily',
      type: 'transparent',
      source: 'assets/media/doudou-wake.webm',
      durationMs: 4066,
      muted: true,
      pinned: false,
      transition: 'standard',
      visual: { scale: 1.07, offsetX: 0, offsetY: 38 },
    },
    {
      id: 'grass',
      name: '滚草地',
      category: 'scene',
      type: 'scene',
      source: 'assets/media/doudou-grass.mp4',
      durationMs: 5056,
      muted: false,
      pinned: false,
      transition: 'scene-fade',
      visual: { scale: 1, offsetX: 0, offsetY: 0 },
    },
  ],
};
let skillManifest = fallbackSkillManifest;

function safeRelativeAsset(source) {
  if (typeof source !== 'string' || !source.trim()) return null;
  const normalized = source.trim().replaceAll('\\', '/').replace(/^\/+/, '');
  const absolutePath = path.resolve(__dirname, normalized);
  const relativePath = path.relative(__dirname, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return fs.existsSync(absolutePath) ? normalized : null;
}

function loadSkillManifest() {
  const manifestPath = path.join(__dirname, 'assets', 'skills.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const standardImage = safeRelativeAsset(parsed?.standardPose?.image) || 'assets/dog.png';
    const categories = Array.isArray(parsed?.categories)
      ? parsed.categories
          .filter((item) => item && /^[a-z0-9-]+$/i.test(item.id) && item.name)
          .map((item) => ({
            id: item.id,
            name: String(item.name),
            order: Number.isFinite(item.order) ? item.order : 100,
          }))
      : [];
    const categoryIds = new Set(categories.map((item) => item.id));
    const skills = Array.isArray(parsed?.skills)
      ? parsed.skills
          .filter((item) => {
            return (
              item &&
              /^[a-z0-9-]+$/i.test(item.id) &&
              item.name &&
              ['transparent', 'scene'].includes(item.type) &&
              categoryIds.has(item.category)
            );
          })
          .map((item) => ({
            id: item.id,
            name: String(item.name),
            category: item.category,
            type: item.type,
            source: safeRelativeAsset(item.source),
            durationMs: Math.max(0, Number(item.durationMs) || 0),
            muted: item.muted !== false,
            pinned: Boolean(item.pinned),
            transition: item.transition === 'scene-fade' ? 'scene-fade' : 'standard',
            visual: normalizeSkillVisual(item.visual),
          }))
          .filter((item) => item.source)
      : [];

    if (!skills.length) throw new Error('技能清单中没有可用素材');
    return {
      schemaVersion: 1,
      roleId: String(parsed.roleId || 'doudou'),
      roleName: String(parsed.roleName || '豆豆'),
      standardPose: {
        image: standardImage,
        transitionMs: Math.min(800, Math.max(80, Number(parsed?.standardPose?.transitionMs) || 220)),
        holdMs: Math.min(800, Math.max(0, Number(parsed?.standardPose?.holdMs) || 160)),
      },
      behavior: {
        autoSleepEnabled: parsed?.behavior?.autoSleepEnabled !== false,
        inactivitySleepMs: Math.min(
          3600000,
          Math.max(5000, Number(parsed?.behavior?.inactivitySleepMs) || 30000),
        ),
        sleepEnterSkillId: String(parsed?.behavior?.sleepEnterSkillId || 'sleep-enter'),
        sleepLoopSkillId: String(parsed?.behavior?.sleepLoopSkillId || 'sleep-loop'),
        wakeSkillId: String(parsed?.behavior?.wakeSkillId || 'wake-up'),
        wakeOnPointer: parsed?.behavior?.wakeOnPointer !== false,
        stateAnchor: { mode: 'bottom-center', x: 0.5, y: 1 },
      },
      categories: categories.sort((a, b) => a.order - b.order),
      skills,
    };
  } catch (error) {
    console.error('[豆豆桌宠] 读取技能清单失败，使用内置清单', error);
    return fallbackSkillManifest;
  }
}

function getRoleDirectory(roleId = activeRoleId) {
  return getRoleDirectoryPath(app.getPath('userData'), roleId);
}

function getRoleMediaDirectory(roleId = activeRoleId) {
  return getRoleMediaDirectoryPath(app.getPath('userData'), roleId);
}

function getProfilePath(roleId = activeRoleId) {
  return getRoleProfilePath(app.getPath('userData'), roleId);
}

function getActiveRoleMetadata() {
  return getRoleMetadata(activeRoleId);
}

function getRoleMetadata(roleId) {
  return (
    characterIndex?.roles?.find((role) => role.id === roleId) || {
      id: roleId,
      name: roleId === 'doudou' ? (bundledSkillManifest?.roleName || '豆豆') : roleId,
      category: 'pet',
    }
  );
}

function clampPetScale(value) {
  return Math.min(1.4, Math.max(0.6, Number(value) || 1));
}

function normalizeStartupState(value) {
  return value === 'standard-idle' ? 'standard-idle' : 'static';
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function normalizeSkillVisual(visual) {
  return {
    scale: clampNumber(visual?.scale, 0.4, 1.8, 1),
    offsetX: clampNumber(visual?.offsetX, -160, 160, 0),
    offsetY: clampNumber(visual?.offsetY, -160, 160, 0),
  };
}

function normalizeAutoSleepRule(rule, behavior = fallbackSkillManifest.behavior) {
  return normalizeInactivityRule(rule, behavior);
}

function normalizeRandomBehaviorRule(rule) {
  const skillIds = Array.isArray(rule?.skillIds)
    ? [...new Set(rule.skillIds.filter((id) => typeof id === 'string' && id.length <= 80))]
    : ['spin'];
  return {
    enabled: rule?.enabled === true,
    intervalMinutes: Math.round(clampNumber(rule?.intervalMinutes, 5, 60, 20)),
    skillIds,
  };
}

function normalizeOpeningConfig(opening) {
  const plans = (Array.isArray(opening?.plans) ? opening.plans : [])
    .filter((plan) => plan && typeof plan.id === 'string' && /^[a-z0-9-]+$/i.test(plan.id))
    .slice(0, 30)
    .map((plan) => ({
      id: plan.id.slice(0, 80),
      name: String(plan.name || '未命名开场').trim().slice(0, 40) || '未命名开场',
      enabled: plan.enabled !== false,
      segments: (Array.isArray(plan.segments) ? plan.segments : [])
        .filter((segment) => segment && typeof segment.id === 'string' && /^[a-z0-9-]+$/i.test(segment.id))
        .slice(0, 30)
        .map((segment) => {
          const source = safeSkillSource(segment.source);
          if (!source || path.extname(new URL(source, 'pet://app/').pathname).toLowerCase() !== '.webm') return null;
          return {
            id: segment.id.slice(0, 80),
            name: String(segment.name || '开场片段').trim().slice(0, 40) || '开场片段',
            source,
            durationMs: Math.max(0, Number(segment.durationMs) || 0),
            enabled: segment.enabled !== false,
            muted: segment.muted === true,
            visual: normalizeSkillVisual(segment.visual),
          };
        })
        .filter(Boolean),
    }));
  const currentPlanId = plans.some((plan) => plan.id === opening?.currentPlanId)
    ? opening.currentPlanId
    : (plans[0]?.id || null);
  return {
    playOnStartup: opening?.playOnStartup === true,
    currentPlanId,
    plans,
  };
}

function getRoleBehaviorDefaults(roleId) {
  if (roleId === 'doudou') return bundledSkillManifest?.behavior || fallbackSkillManifest.behavior;
  return {
    autoSleepEnabled: false,
    inactivitySleepMs: 30000,
    sleepEnterSkillId: '',
    sleepLoopSkillId: '',
    wakeSkillId: '',
    wakeOnPointer: true,
    stateAnchor: { mode: 'bottom-center', x: 0.5, y: 1 },
  };
}

function createDefaultUserProfile(roleId = activeRoleId) {
  const role = getRoleMetadata(roleId);
  const isDoudou = roleId === 'doudou';
  return {
    schemaVersion: CHARACTER_PROFILE_SCHEMA_VERSION,
    identity: {
      id: role.id,
      name: role.name,
      category: role.category,
    },
    appearance: {
      scale: 1,
      startupState: 'static',
      mainImageSource: isDoudou ? null : role.thumbnail,
      idleSkillId: isDoudou ? 'idle-breath' : null,
    },
    fixedRules: {
      autoSleep: normalizeAutoSleepRule(
        isDoudou ? null : { enabled: false, sleepEnterSkillId: '', sleepLoopSkillId: '', wakeSkillId: '' },
        getRoleBehaviorDefaults(roleId),
      ),
    },
    randomBehavior: normalizeRandomBehaviorRule(null),
    randomBehaviorDeleted: false,
    opening: normalizeOpeningConfig(null),
    skillOverrides: {},
    userSkills: [],
    deletedBuiltinSkillIds: [],
  };
}

function loadUserProfile(roleId = activeRoleId) {
  fs.mkdirSync(getRoleMediaDirectory(roleId), { recursive: true });
  const fallback = createDefaultUserProfile(roleId);
  try {
    if (!fs.existsSync(getProfilePath(roleId))) return fallback;
    const parsed = JSON.parse(fs.readFileSync(getProfilePath(roleId), 'utf8'));
    const role = getRoleMetadata(roleId);
    return {
      schemaVersion: CHARACTER_PROFILE_SCHEMA_VERSION,
      identity: {
        id: role.id,
        name: role.name,
        category: role.category,
      },
      appearance: {
        scale: clampPetScale(parsed?.appearance?.scale),
        startupState: normalizeStartupState(parsed?.appearance?.startupState),
        mainImageSource: safeSkillSource(parsed?.appearance?.mainImageSource),
        idleSkillId:
          typeof parsed?.appearance?.idleSkillId === 'string'
            ? parsed.appearance.idleSkillId.slice(0, 80)
            : fallback.appearance.idleSkillId,
      },
      fixedRules: {
        autoSleep: normalizeAutoSleepRule(
          parsed?.fixedRules?.autoSleep,
          getRoleBehaviorDefaults(roleId),
        ),
      },
      randomBehavior: parsed?.randomBehaviorDeleted === true
        ? null
        : normalizeRandomBehaviorRule(parsed?.randomBehavior),
      randomBehaviorDeleted: parsed?.randomBehaviorDeleted === true,
      opening: normalizeOpeningConfig(parsed?.opening),
      skillOverrides:
        parsed?.skillOverrides && typeof parsed.skillOverrides === 'object'
          ? parsed.skillOverrides
          : {},
      userSkills: Array.isArray(parsed?.userSkills) ? parsed.userSkills : [],
      deletedBuiltinSkillIds: Array.isArray(parsed?.deletedBuiltinSkillIds)
        ? parsed.deletedBuiltinSkillIds.filter((id) => typeof id === 'string')
        : [],
    };
  } catch (error) {
    console.error('[豆豆桌宠] 读取用户角色配置失败，使用默认配置', error);
    return fallback;
  }
}

function saveUserProfile() {
  fs.mkdirSync(getRoleDirectory(), { recursive: true });
  const role = getActiveRoleMetadata();
  userProfile.schemaVersion = CHARACTER_PROFILE_SCHEMA_VERSION;
  userProfile.identity = {
    id: role.id,
    name: role.name,
    category: role.category,
  };
  const profilePath = getProfilePath();
  writeJsonAtomic(profilePath, userProfile);
  if (characterIndex) {
    markRoleUpdated(characterIndex, activeRoleId);
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
  }
}

function resolveUserMediaSource(source) {
  if (typeof source !== 'string' || !source.startsWith('pet://media/')) return null;
  try {
    const url = new URL(source);
    if (url.hostname !== 'media') return null;
    const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (parts.length !== 2 || !isSafeRoleId(parts[0])) return null;
    if (!characterIndex?.roles?.some((role) => role.id === parts[0])) return null;
    const mediaRoot = path.resolve(getRoleMediaDirectory(parts[0]));
    const filePath = path.resolve(mediaRoot, parts[1]);
    const relativePath = path.relative(mediaRoot, filePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
    return fs.existsSync(filePath) ? filePath : null;
  } catch (_error) {
    return null;
  }
}

function safeSkillSource(source) {
  if (typeof source === 'string' && source.startsWith('pet://media/')) {
    return resolveUserMediaSource(source) ? source : null;
  }
  return safeRelativeAsset(source);
}

function sanitizeSkill(skill, origin) {
  const categoryIds = new Set(bundledSkillManifest.categories.map((item) => item.id));
  if (
    !skill ||
    !/^[a-z0-9-]+$/i.test(skill.id) ||
    !skill.name ||
    !categoryIds.has(skill.category) ||
    !['transparent', 'scene'].includes(skill.type)
  ) {
    return null;
  }
  const source = safeSkillSource(skill.source);
  if (!source) return null;
  return {
    id: skill.id,
    name: String(skill.name).slice(0, 40),
    category: skill.category,
    type: skill.type,
    source,
    durationMs: Math.max(0, Number(skill.durationMs) || 0),
    muted: skill.muted !== false,
    pinned: Boolean(skill.pinned),
    transition: skill.type === 'scene' ? 'scene-fade' : 'standard',
    visual: normalizeSkillVisual(skill.visual),
    origin,
  };
}

function rebuildSkillManifest() {
  const isDoudou = activeRoleId === 'doudou';
  const deleted = new Set(userProfile.deletedBuiltinSkillIds);
  const builtinSkills = (isDoudou ? bundledSkillManifest.skills : [])
    .filter((skill) => !deleted.has(skill.id))
    .map((skill) => {
      const override = userProfile.skillOverrides[skill.id] || {};
      return sanitizeSkill(
        {
          ...skill,
          name: override.name || skill.name,
          category: override.category || skill.category,
          muted: typeof override.muted === 'boolean' ? override.muted : skill.muted,
          pinned: typeof override.pinned === 'boolean' ? override.pinned : skill.pinned,
          visual: override.visual || skill.visual,
        },
        'builtin',
      );
    })
    .filter(Boolean);
  const userSkills = userProfile.userSkills
    .map((skill) => sanitizeSkill(skill, 'user'))
    .filter(Boolean);
  const autoSleep = normalizeAutoSleepRule(
    userProfile.fixedRules?.autoSleep,
    getRoleBehaviorDefaults(activeRoleId),
  );
  userProfile.fixedRules = { ...(userProfile.fixedRules || {}), autoSleep };
  const skills = [...builtinSkills, ...userSkills];
  const idleSkillId =
    skills.some((skill) => skill.id === userProfile.appearance?.idleSkillId)
      ? userProfile.appearance.idleSkillId
      : (isDoudou && skills.some((skill) => skill.id === 'idle-breath') ? 'idle-breath' : null);
  userProfile.appearance.idleSkillId = idleSkillId;
  const reservedRandomSkillIds = new Set([
    idleSkillId,
    autoSleep.sleepEnterSkillId,
    autoSleep.sleepLoopSkillId,
    autoSleep.wakeSkillId,
  ]);
  const eligibleRandomSkillIds = new Set(
    skills.filter((skill) => !reservedRandomSkillIds.has(skill.id)).map((skill) => skill.id),
  );
  const randomBehavior = userProfile.randomBehaviorDeleted
    ? null
    : normalizeRandomBehaviorRule(userProfile.randomBehavior);
  if (randomBehavior) {
    randomBehavior.skillIds = randomBehavior.skillIds.filter((id) => eligibleRandomSkillIds.has(id));
    if (randomBehavior.enabled && randomBehavior.skillIds.length === 0) randomBehavior.enabled = false;
  }
  userProfile.randomBehavior = randomBehavior;
  userProfile.opening = normalizeOpeningConfig(userProfile.opening);
  skillManifest = {
    ...bundledSkillManifest,
    roleId: activeRoleId,
    roleName: getActiveRoleMetadata().name,
    standardPose: {
      ...bundledSkillManifest.standardPose,
      image:
        safeSkillSource(userProfile.appearance?.mainImageSource) ||
        getActiveRoleMetadata().thumbnail ||
        bundledSkillManifest.standardPose.image,
    },
    behavior: {
      ...bundledSkillManifest.behavior,
      idleSkillId,
      autoSleepEnabled: autoSleep.enabled,
      inactivitySleepMs: autoSleep.inactivitySeconds * 1000,
      sleepEnterSkillId: autoSleep.sleepEnterSkillId,
      sleepLoopSkillId: autoSleep.sleepLoopSkillId,
      wakeSkillId: autoSleep.wakeSkillId,
      wakeOnPointer: autoSleep.wakeOnPointer,
      stateAnchor: autoSleep.anchor,
      randomBehavior: randomBehavior || {
        enabled: false,
        intervalMinutes: 20,
        skillIds: [],
      },
    },
    opening: isInputQa
      ? { ...userProfile.opening, playOnStartup: false }
      : userProfile.opening,
    skills,
  };
  petScale = clampPetScale(userProfile.appearance.scale);
  petWindowSize = Math.round(PET_WINDOW_SIZE * petScale);
  if (!mainWindow) {
    petVisualBounds = {
      left: basePetVisualBounds.left * petScale,
      top: basePetVisualBounds.top * petScale,
      right: basePetVisualBounds.right * petScale,
      bottom: basePetVisualBounds.bottom * petScale,
    };
  }
}

function getSettingsData() {
  return {
    manifest: skillManifest,
    appearance: {
      scale: petScale,
      startupState: normalizeStartupState(userProfile.appearance?.startupState),
    },
    fixedRules: userProfile.fixedRules,
    randomBehavior: userProfile.randomBehaviorDeleted ? null : userProfile.randomBehavior,
    opening: userProfile.opening,
    canRestoreRandomBehavior: userProfile.randomBehaviorDeleted === true,
    canRestoreBuiltinSkills: userProfile.deletedBuiltinSkillIds.length > 0,
    dataDirectory: getRoleDirectory(),
    characters: getCharacterRegistrySnapshot(characterIndex),
    activeRoleId,
    characterSwitch: getCharacterSwitchState(),
  };
}

app.setName('豆豆桌宠');
const isolatedTestUserData = process.env.DOUDOU_TEST_USER_DATA;
if (isolatedTestUserData) {
  fs.mkdirSync(isolatedTestUserData, { recursive: true });
  app.setPath('userData', path.resolve(isolatedTestUserData));
} else if (isPrototypeQa) {
  const qaUserData = app.isPackaged
    ? path.join(app.getPath('temp'), 'doudou-pet-prototype-qa-user-data')
    : path.join(__dirname, 'qa-prototype-current', 'user-data');
  fs.rmSync(qaUserData, { recursive: true, force: true });
  app.setPath('userData', qaUserData);
}
if (process.platform === 'win32') {
  app.setAppUserModelId('com.doudou.desktoppet');
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pet',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

if (!isPrototypeQa && !isInputQa && !isSmokeTest && !app.requestSingleInstanceLock()) {
  app.quit();
}

function getPrimaryWorkArea() {
  return screen.getPrimaryDisplay().workArea;
}

function validVisualBounds(bounds) {
  return Boolean(
    bounds &&
      ['left', 'top', 'right', 'bottom'].every((key) => Number.isFinite(bounds[key])) &&
      bounds.left >= 0 &&
      bounds.top >= 0 &&
      bounds.right > bounds.left &&
      bounds.bottom > bounds.top &&
      bounds.right <= petWindowSize &&
      bounds.bottom <= petWindowSize,
  );
}

function makeIntegerShapeRect({ left, top, right, bottom }, padding = 0) {
  const leftEdge = Math.max(0, Math.floor(left - padding));
  const topEdge = Math.max(0, Math.floor(top - padding));
  const rightEdge = Math.min(petWindowSize, Math.ceil(right + padding));
  const bottomEdge = Math.min(petWindowSize, Math.ceil(bottom + padding));
  return {
    x: leftEdge,
    y: topEdge,
    width: Math.max(1, rightEdge - leftEdge),
    height: Math.max(1, bottomEdge - topEdge),
  };
}

function applyWindowShape(rects) {
  if (!isUsableWindow() || process.platform !== 'win32') return;
  const safeRects = rects
    .filter((rect) => rect && rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }));
  if (!safeRects.length) return;
  try {
    mainWindow.setShape(safeRects);
    currentWindowShape = safeRects;
  } catch (error) {
    console.error('[豆豆桌宠] 设置 Windows 交互区域失败', error);
  }
}

function applyNormalWindowShape() {
  // Windows can leave a shaped transparent window clipped against its old
  // screen position while the window is being moved. Keep the complete native
  // region for the duration of a drag; the tight pet outline is restored once
  // Windows has committed the final window position.
  if (dragSession) {
    applyFullWindowShape();
    return;
  }
  if (!petCanvasBounds) return;
  const workArea = getPrimaryWorkArea();
  const petRect = makeIntegerShapeRect(petVisualBounds, PET_SHAPE_PADDING);
  const controlRect = makeIntegerShapeRect({
    left: PET_CONTROL_BASE_BOUNDS.left * petScale,
    top: PET_CONTROL_BASE_BOUNDS.top * petScale,
    right: PET_CONTROL_BASE_BOUNDS.right * petScale,
    bottom: PET_CONTROL_BASE_BOUNDS.bottom * petScale,
  });
  const canvasOffsetX = petCanvasBounds.x - workArea.x;
  const canvasOffsetY = petCanvasBounds.y - workArea.y;
  applyWindowShape([petRect, controlRect].map((rect) => ({
    x: canvasOffsetX + rect.x,
    y: canvasOffsetY + rect.y,
    width: rect.width,
    height: rect.height,
  })));
}

function applyFullWindowShape() {
  if (!isUsableWindow()) return;
  const bounds = mainWindow.getBounds();
  applyWindowShape([{ x: 0, y: 0, width: bounds.width, height: bounds.height }]);
}

function applyPetCanvasWindowShape() {
  if (!isUsableWindow() || !petCanvasBounds) return;
  const workArea = getPrimaryWorkArea();
  applyWindowShape([{
    x: petCanvasBounds.x - workArea.x,
    y: petCanvasBounds.y - workArea.y,
    width: petWindowSize,
    height: petWindowSize,
  }]);
}

function publishPetCanvasPosition({ dragging = false } = {}) {
  if (!petCanvasBounds) return;
  const workArea = getPrimaryWorkArea();
  sendToPet('pet:drag-overlay', {
    active: true,
    dragging,
    x: petCanvasBounds.x - workArea.x,
    y: petCanvasBounds.y - workArea.y,
    size: petWindowSize,
  });
}

function cancelDragShapeRestore() {
  clearTimeout(dragShapeRestoreTimer);
  clearTimeout(dragShapeConfirmTimer);
  dragShapeRestoreTimer = null;
  dragShapeConfirmTimer = null;
}

function restoreNormalWindowShapeAfterDrag() {
  cancelDragShapeRestore();
  // A short delay lets Windows finish the native move before setShape is
  // applied. Apply it once more afterwards because fractional display scaling
  // can finish its DPI rounding one message later.
  dragShapeRestoreTimer = setTimeout(() => {
    dragShapeRestoreTimer = null;
    if (!isUsableWindow() || dragSession || isSceneMode) return;
    applyNormalWindowShape();
    dragShapeConfirmTimer = setTimeout(() => {
      dragShapeConfirmTimer = null;
      if (!isUsableWindow() || dragSession || isSceneMode) return;
      applyNormalWindowShape();
    }, 90);
    dragShapeConfirmTimer.unref?.();
  }, 40);
  dragShapeRestoreTimer.unref?.();
}

function clampPetToPrimary(bounds) {
  const workArea = getPrimaryWorkArea();
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  // BrowserWindow.setPosition/setBounds only accept integer coordinates.
  const minimumX = Math.floor(
    workArea.x - petVisualBounds.left + PET_EDGE_SAFE_MARGIN,
  );
  const maximumX = Math.ceil(
    workArea.x + workArea.width - petVisualBounds.right - PET_EDGE_SAFE_MARGIN,
  );
  const minimumY = Math.floor(
    workArea.y - petVisualBounds.top + PET_EDGE_SAFE_MARGIN,
  );
  const maximumY = Math.ceil(
    workArea.y + workArea.height - petVisualBounds.bottom - PET_EDGE_SAFE_MARGIN,
  );
  return {
    width,
    height,
    x: Math.min(Math.max(Math.round(bounds.x), minimumX), maximumX),
    y: Math.min(Math.max(Math.round(bounds.y), minimumY), maximumY),
  };
}

function getPetVisualCenter(bounds) {
  return {
    x: bounds.x + (petVisualBounds.left + petVisualBounds.right) / 2,
    y: bounds.y + (petVisualBounds.top + petVisualBounds.bottom) / 2,
  };
}

function applyPetScale(nextScale, { persist = true } = {}) {
  const normalizedScale = clampPetScale(nextScale);
  if (Math.abs(normalizedScale - petScale) < 0.0001) return;

  if (isSceneMode) {
    sendToPet('pet:suspended', { reason: 'appearance-change' });
    resetSceneWindow();
  }

  const previousScale = petScale;
  const previousSize = petWindowSize;
  const ratio = normalizedScale / previousScale;
  const previousBounds = petCanvasBounds && !isSceneMode ? { ...petCanvasBounds } : null;
  const visibleCenter = previousBounds ? getPetVisualCenter(previousBounds) : null;

  petScale = normalizedScale;
  petWindowSize = Math.round(PET_WINDOW_SIZE * petScale);
  petVisualBounds = {
    left: petWindowSize / 2 + (petVisualBounds.left - previousSize / 2) * ratio,
    right: petWindowSize / 2 + (petVisualBounds.right - previousSize / 2) * ratio,
    top: petWindowSize - (previousSize - petVisualBounds.top) * ratio,
    bottom: petWindowSize - (previousSize - petVisualBounds.bottom) * ratio,
  };

  if (previousBounds && visibleCenter) {
    const nextVisibleCenterX = (petVisualBounds.left + petVisualBounds.right) / 2;
    const nextVisibleCenterY = (petVisualBounds.top + petVisualBounds.bottom) / 2;
    petCanvasBounds = clampPetToPrimary({
      width: petWindowSize,
      height: petWindowSize,
      x: visibleCenter.x - nextVisibleCenterX,
      y: visibleCenter.y - nextVisibleCenterY,
    });
    sendToPet('pet:appearance', {
      scale: petScale,
      startupState: normalizeStartupState(userProfile.appearance?.startupState),
    });
    publishPetCanvasPosition();
    applyNormalWindowShape();
  }

  if (persist) {
    userProfile.appearance.scale = petScale;
    saveUserProfile();
  }
}

function getAnchoredDragBounds(session, point) {
  const requestedX = Math.round(
    session.anchorWindowX + point.x - session.anchorPointerX,
  );
  const requestedY = Math.round(
    session.anchorWindowY + point.y - session.anchorPointerY,
  );
  const nextBounds = clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: requestedX,
    y: requestedY,
  });

  // Rebase only the axis that hit an edge. This removes overshoot without
  // feeding BrowserWindow's DPI-rounded position back into the next frame.
  // Reversing the physical cursor by one pixel therefore moves the pet by one
  // pixel immediately, while a stationary cursor can never move the window.
  if (nextBounds.x !== requestedX) {
    session.anchorPointerX = point.x;
    session.anchorWindowX = nextBounds.x;
  }
  if (nextBounds.y !== requestedY) {
    session.anchorPointerY = point.y;
    session.anchorWindowY = nextBounds.y;
  }
  return nextBounds;
}

function stopDragPolling() {
  if (!dragPollTimer) return;
  clearInterval(dragPollTimer);
  dragPollTimer = null;
}

function finishWindowDrag() {
  stopDragPolling();
  const finishedSession = dragSession;
  dragSession = null;
  if (finishedSession) publishPetCanvasPosition({ dragging: false });
  restoreNormalWindowShapeAfterDrag();
}

function updateDraggedWindowFromCursor() {
  if (!isUsableWindow() || !dragSession) return;
  const nextBounds = getAnchoredDragBounds(
    dragSession,
    screen.getCursorScreenPoint(),
  );
  if (nextBounds.x === dragSession.appliedX && nextBounds.y === dragSession.appliedY) return;
  try {
    petCanvasBounds = { ...nextBounds };
    publishPetCanvasPosition({ dragging: true });
    dragSession.appliedX = nextBounds.x;
    dragSession.appliedY = nextBounds.y;
  } catch (error) {
    console.error('[豆豆桌宠] 移动窗口失败', error);
    finishWindowDrag();
  }
}

function startDragPolling() {
  stopDragPolling();
  dragPollTimer = setInterval(updateDraggedWindowFromCursor, 16);
  dragPollTimer.unref?.();
}

function getInitialBounds() {
  const workArea = getPrimaryWorkArea();
  const targetCenterX = workArea.x + workArea.width / 2;
  // Place the visible dog between the upper quarter and the middle line.
  const targetCenterY = workArea.y + workArea.height * 0.375;
  return clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: targetCenterX - (petVisualBounds.left + petVisualBounds.right) / 2,
    y: targetCenterY - (petVisualBounds.top + petVisualBounds.bottom) / 2,
  });
}

function isUsableWindow() {
  return Boolean(mainWindow && !mainWindow.isDestroyed());
}

function isTrustedSender(event) {
  return isUsableWindow() && event.sender === mainWindow.webContents;
}

function isTrustedSettingsSender(event) {
  return Boolean(
    settingsWindow &&
      !settingsWindow.isDestroyed() &&
      event.sender === settingsWindow.webContents,
  );
}

function sendToPet(channel, payload) {
  if (isUsableWindow() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function sendToSettings(channel, payload) {
  if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.webContents.isDestroyed()) {
    settingsWindow.webContents.send(channel, payload);
  }
}

function setMousePassthrough(enabled, { force = false } = {}) {
  if (!isUsableWindow()) return;
  const nextValue = Boolean(enabled);
  if (!force && nextValue === mousePassthrough) return;
  mousePassthrough = nextValue;
  if (nextValue) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
}

function normalWindowUsesNativeShape() {
  return Boolean(
    isUsableWindow() &&
      mainWindow.isVisible() &&
      !mainWindow.isMinimized() &&
      !isSceneMode &&
      !isClosedToTray &&
      !lifecycleTimer
  );
}

function stopPointerProbe() {
  if (!pointerProbeTimer) return;
  clearInterval(pointerProbeTimer);
  pointerProbeTimer = null;
}

function probeGlobalPointer() {
  if (
    !isUsableWindow() ||
    !mainWindow.isVisible() ||
    mainWindow.isMinimized() ||
    isClosedToTray ||
    lifecycleTimer
  ) {
    return;
  }

  if (isSceneMode) {
    setMousePassthrough(true);
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  sendToPet('pet:pointer-probe', {
    x: cursor.x - bounds.x,
    y: cursor.y - bounds.y,
  });
}

function startPointerProbe() {
  stopPointerProbe();
  probeGlobalPointer();
  pointerProbeTimer = setInterval(probeGlobalPointer, 40);
  pointerProbeTimer.unref?.();
}

function brieflyBringToFront() {
  if (!isUsableWindow()) return;
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.show();
  mainWindow.focus();
  setTimeout(() => {
    if (isUsableWindow()) mainWindow.setAlwaysOnTop(false);
  }, 240);
}

function resetSceneWindow() {
  if (!isUsableWindow() || !isSceneMode) return;
  isSceneMode = false;
  if (normalBounds) petCanvasBounds = clampPetToPrimary(normalBounds);
  normalBounds = null;
  sceneBounds = null;
  sendToPet('pet:scene-layout', { active: false });
  publishPetCanvasPosition();
  applyNormalWindowShape();
  setMousePassthrough(false, { force: true });
}

function enterSceneWindow() {
  if (!isUsableWindow()) return false;
  if (!isSceneMode) {
    normalBounds = { ...petCanvasBounds };
    const workArea = getPrimaryWorkArea();
    const size = Math.min(SCENE_WINDOW_SIZE, workArea.width, workArea.height);
    const petCenter = getPetVisualCenter(normalBounds);
    isSceneMode = true;
    sceneBounds = {
      width: size,
      height: size,
      x: Math.min(
        Math.max(Math.round(petCenter.x - size / 2), workArea.x),
        workArea.x + workArea.width - size,
      ),
      y: Math.min(
        Math.max(Math.round(petCenter.y - size / 2), workArea.y),
        workArea.y + workArea.height - size,
      ),
    };
    sendToPet('pet:scene-layout', {
      active: true,
      x: sceneBounds.x - workArea.x,
      y: sceneBounds.y - workArea.y,
      size,
    });
    applyWindowShape([{
      x: sceneBounds.x - workArea.x,
      y: sceneBounds.y - workArea.y,
      width: size,
      height: size,
    }]);
  }
  setMousePassthrough(true);
  return true;
}

function showPet({ command = null } = {}) {
  if (!isUsableWindow()) return;
  clearTimeout(lifecycleTimer);
  lifecycleTimer = null;
  isClosedToTray = false;
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  applyNormalWindowShape();
  setMousePassthrough(false, { force: true });
  sendToPet('pet:resumed', { source: 'tray' });
  brieflyBringToFront();
  if (command) {
    setTimeout(() => sendToPet('pet:command', command), 120);
  }
}

function suspendPet(reason) {
  if (dragSession) finishWindowDrag();
  sendToPet('pet:suspended', { reason });
  resetSceneWindow();
  setMousePassthrough(false);
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide();
}

function hideToTaskbar() {
  if (!isUsableWindow()) return;
  suspendPet('hidden');
  mainWindow.setSkipTaskbar(false);
  mainWindow.minimize();
}

function completeCloseToTray() {
  if (!isUsableWindow()) return;
  suspendPet('closed');
  isClosedToTray = true;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
}

function quitImmediately() {
  if (isQuitting) return;
  isQuitting = true;
  clearTimeout(lifecycleTimer);
  lifecycleTimer = null;
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.destroy();
  settingsWindow = null;
  if (isUsableWindow()) mainWindow.destroy();
  app.exit(0);
}

function requestAnimatedLifecycle(action) {
  if (!isUsableWindow() || isQuitting) return;
  if (action === 'hide') {
    hideToTaskbar();
    return;
  }

  clearTimeout(lifecycleTimer);
  suspendPet(action);
  setMousePassthrough(true);
  sendToPet('pet:prepare-lifecycle', { action });
  lifecycleTimer = setTimeout(() => {
    lifecycleTimer = null;
    if (action === 'home-exit') {
      quitImmediately();
    } else {
      completeCloseToTray();
    }
  }, LIFECYCLE_ANIMATION_MS);
}

function makeSkillCommand(skillId, source = 'menu') {
  return { skillId, source };
}

function sendCommand(skillId, source = 'menu') {
  if (!isUsableWindow()) return;
  const command = makeSkillCommand(skillId, source);
  if (!mainWindow.isVisible() || mainWindow.isMinimized() || isClosedToTray) {
    showPet({ command });
    return;
  }
  sendToPet('pet:command', command);
}

function createSkillMenuSections(onSelect) {
  const sections = [];
  const pinned = skillManifest.skills.filter((skill) => skill.pinned);
  if (pinned.length) {
    sections.push({
      label: '常用技能',
      submenu: pinned.map((skill) => ({
        label: skill.name,
        click: () => onSelect(skill.id),
      })),
    });
  }

  for (const category of skillManifest.categories) {
    const categorySkills = skillManifest.skills.filter((skill) => skill.category === category.id);
    if (!categorySkills.length) continue;
    sections.push({
      label: category.name,
      submenu: categorySkills.map((skill) => ({
        label: skill.name,
        click: () => onSelect(skill.id),
      })),
    });
  }
  return sections;
}

function getCharacterSwitchState() {
  const allowedMode = currentAnimationMode === 'idle' || currentAnimationMode === 'sleep-loop';
  const visible =
    isUsableWindow() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized() &&
    !isClosedToTray &&
    !systemSleeping &&
    !screenLocked;
  const allowed =
    !isCharacterSwitching &&
    !isQuitting &&
    !isSceneMode &&
    !dragSession &&
    visible &&
    allowedMode;
  return {
    allowed,
    busy: isCharacterSwitching,
    mode: currentAnimationMode,
    label: isCharacterSwitching
      ? '正在切换角色…'
      : allowed
        ? '切换角色'
        : '切换角色（当前动作结束后可用）',
  };
}

function publishCharacterSwitchState() {
  sendToSettings('settings:character-switch-state', getCharacterSwitchState());
}

function createCharacterSwitchSubmenu() {
  const items = [];
  const categories = characterIndex?.categories || [
    { id: 'pet', name: '宠物' },
    { id: 'person', name: '人物' },
    { id: 'other', name: '其他' },
  ];
  for (const category of categories) {
    const roles = (characterIndex?.roles || []).filter((role) => role.category === category.id);
    if (!roles.length) continue;
    items.push({
      label: category.name,
      submenu: roles.map((role) => ({
        label: role.id === activeRoleId ? `✓ ${role.name}` : role.name,
        enabled: role.id !== activeRoleId,
        click: () => {
          switchCharacter(role.id, 'menu').catch((error) => {
            console.error('[豆豆桌宠] 右键菜单切换角色失败', error);
          });
        },
      })),
    });
  }
  return items;
}

function waitForCharacterSwitchResult(switchId, timeoutMs = 9000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pendingCharacterSwitch?.switchId !== switchId) return;
      pendingCharacterSwitch = null;
      resolve({ ok: false, error: '角色素材加载超时。' });
    }, timeoutMs);
    pendingCharacterSwitch = {
      switchId,
      resolve: (result) => {
        clearTimeout(timer);
        pendingCharacterSwitch = null;
        resolve(result);
      },
    };
  });
}

function resetRoleGeometry(scale) {
  petScale = clampPetScale(scale);
  petWindowSize = Math.round(PET_WINDOW_SIZE * petScale);
  petVisualBounds = {
    left: petWindowSize / 2 + (basePetVisualBounds.left - PET_WINDOW_SIZE / 2) * petScale,
    right: petWindowSize / 2 + (basePetVisualBounds.right - PET_WINDOW_SIZE / 2) * petScale,
    top: petWindowSize - (PET_WINDOW_SIZE - basePetVisualBounds.top) * petScale,
    bottom: petWindowSize - (PET_WINDOW_SIZE - basePetVisualBounds.bottom) * petScale,
  };
  petCanvasBounds = getInitialBounds();
  centerRoleAfterVisualBounds = true;
  publishPetCanvasPosition();
  applyPetCanvasWindowShape();
}

async function sendCharacterSwitchToRenderer(switchId, roleId, manifest, appearance) {
  const resultPromise = waitForCharacterSwitchResult(switchId);
  sendToPet('pet:switch-character', {
    switchId,
    roleId,
    manifest,
    appearance,
  });
  return resultPromise;
}

async function switchCharacter(roleId, source = 'settings') {
  const target = characterIndex?.roles?.find((role) => role.id === roleId);
  if (!target) return { ok: false, error: '没有找到这个角色。' };
  if (roleId === activeRoleId) return { ok: true, unchanged: true, data: getSettingsData() };
  const switchState = getCharacterSwitchState();
  if (!switchState.allowed) {
    return {
      ok: false,
      unavailable: true,
      error: switchState.label,
      switchState,
    };
  }

  const previous = {
    roleId: activeRoleId,
    profile: userProfile,
    manifest: skillManifest,
    scale: petScale,
    windowSize: petWindowSize,
    visualBounds: { ...petVisualBounds },
    canvasBounds: petCanvasBounds ? { ...petCanvasBounds } : null,
  };
  const switchId = ++characterSwitchSequence;
  isCharacterSwitching = true;
  currentAnimationMode = 'switching';
  publishCharacterSwitchState();

  try {
    activeRoleId = roleId;
    userProfile = loadUserProfile(roleId);
    rebuildSkillManifest();
    resetRoleGeometry(clampPetScale(userProfile.appearance?.scale));
    const result = await sendCharacterSwitchToRenderer(
      switchId,
      roleId,
      skillManifest,
      {
        scale: petScale,
        startupState: normalizeStartupState(userProfile.appearance?.startupState),
      },
    );
    if (!result?.ok) throw new Error(result?.error || '角色素材加载失败。');

    currentAnimationMode = 'idle';
    refreshTrayMenu();
    sendToSettings('settings:data-changed', getSettingsData());
    return {
      ok: true,
      roleId,
      roleName: target.name,
      source,
      data: getSettingsData(),
    };
  } catch (error) {
    console.error(`[豆豆桌宠] 切换到角色“${target.name}”失败`, error);
    const failureReason = String(error?.message || '角色素材加载失败。').slice(0, 160);
    activeRoleId = previous.roleId;
    userProfile = previous.profile;
    skillManifest = previous.manifest;
    petScale = previous.scale;
    petWindowSize = previous.windowSize;
    petVisualBounds = previous.visualBounds;
    petCanvasBounds = previous.canvasBounds;
    centerRoleAfterVisualBounds = false;
    const rollbackId = ++characterSwitchSequence;
    try {
      await sendCharacterSwitchToRenderer(
        rollbackId,
        previous.roleId,
        previous.manifest,
        {
          scale: previous.scale,
          startupState: normalizeStartupState(previous.profile.appearance?.startupState),
        },
      );
    } catch (_rollbackError) {
      publishConfigurationChanges({ skillsChanged: true, appearanceChanged: true });
    }
    if (petCanvasBounds) {
      publishPetCanvasPosition();
      applyNormalWindowShape();
    }
    currentAnimationMode = 'idle';
    return {
      ok: false,
      error: `角色加载失败，已经恢复原来的角色。原因：${failureReason}`,
    };
  } finally {
    isCharacterSwitching = false;
    publishCharacterSwitchState();
    refreshTrayMenu();
    sendToSettings('settings:data-changed', getSettingsData());
  }
}

function createPetMenu() {
  const switchState = getCharacterSwitchState();
  return Menu.buildFromTemplate([
    { label: `当前版本：${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    ...createSkillMenuSections((skillId) => sendCommand(skillId, 'menu')),
    { type: 'separator' },
    {
      label: switchState.label,
      enabled: switchState.allowed,
      submenu: switchState.allowed ? createCharacterSwitchSubmenu() : undefined,
    },
    {
      label: '设置',
      click: () => showSettings(),
    },
    { type: 'separator' },
    {
      label: '隐藏（保留任务栏）',
      click: () => requestAnimatedLifecycle('hide'),
    },
    {
      label: '关闭到通知区域',
      click: () => requestAnimatedLifecycle('close-to-tray'),
    },
    {
      label: '回家并退出',
      click: () => requestAnimatedLifecycle('home-exit'),
    },
  ]);
}

function showPetMenu() {
  if (!isUsableWindow()) return;
  const menu = createPetMenu();
  // Let Electron position the native menu at the real cursor location. This
  // avoids the Windows high-DPI coordinate mismatch caused by manual x/y.
  menu.popup({ window: mainWindow });
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const activeRoleName = getActiveRoleMetadata().name;
  tray.setToolTip(`豆豆桌宠 ${app.getVersion()} · ${activeRoleName}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `豆豆桌宠 ${app.getVersion()} · ${activeRoleName}`, enabled: false },
      { type: 'separator' },
      { label: `显示${activeRoleName}`, click: () => showPet() },
      { label: '设置', click: () => showSettings() },
      { type: 'separator' },
      {
        label: '技能',
        submenu: createSkillMenuSections((skillId) => {
          showPet({ command: makeSkillCommand(skillId, 'tray') });
        }),
      },
      { type: 'separator' },
      { label: '退出（立即结束）', click: quitImmediately },
    ]),
  );
}

function publishConfigurationChanges({ skillsChanged = true, appearanceChanged = false } = {}) {
  if (skillsChanged) sendToPet('skills:updated', skillManifest);
  if (appearanceChanged) {
    sendToPet('pet:appearance', {
      scale: petScale,
      startupState: normalizeStartupState(userProfile.appearance?.startupState),
    });
  }
  sendToSettings('settings:data-changed', getSettingsData());
  refreshTrayMenu();
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'doudou.ico'));
  refreshTrayMenu();
  tray.on('click', () => showPet());
  tray.on('double-click', () => showPet());
}

function resumePetAfterSystemPause(source) {
  if (systemSleeping || screenLocked) return;
  if (
    isUsableWindow() &&
    mainWindow.isVisible() &&
    !mainWindow.isMinimized() &&
    !isClosedToTray
  ) {
    sendToPet('pet:resumed', { source });
  }
}

function installPowerMonitorHandlers() {
  powerMonitor.on('suspend', () => {
    systemSleeping = true;
    sendToPet('pet:suspended', { reason: 'system-suspend' });
  });
  powerMonitor.on('resume', () => {
    systemSleeping = false;
    resumePetAfterSystemPause('system-resume');
  });
  powerMonitor.on('lock-screen', () => {
    screenLocked = true;
    sendToPet('pet:suspended', { reason: 'screen-locked' });
  });
  powerMonitor.on('unlock-screen', () => {
    screenLocked = false;
    resumePetAfterSystemPause('screen-unlocked');
  });
}

function installPetProtocol() {
  const appRoot = path.resolve(__dirname);
  const contentTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.ico', 'image/x-icon'],
    ['.webm', 'video/webm'],
    ['.mp4', 'video/mp4'],
    ['.mov', 'video/quicktime'],
  ]);

  protocol.handle('pet', async (request) => {
    const requestUrl = new URL(request.url);
    let filePath;

    if (requestUrl.hostname === 'app') {
      const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '') || 'index.html';
      filePath = path.resolve(appRoot, relativePath);
      const relativeToRoot = path.relative(appRoot, filePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
    } else if (requestUrl.hostname === 'media') {
      const parts = decodeURIComponent(requestUrl.pathname).split('/').filter(Boolean);
      if (
        parts.length !== 2 ||
        !isSafeRoleId(parts[0]) ||
        !characterIndex?.roles?.some((role) => role.id === parts[0])
      ) {
        return new Response('Not found', { status: 404 });
      }
      const mediaRoot = path.resolve(getRoleMediaDirectory(parts[0]));
      filePath = path.resolve(mediaRoot, parts[1]);
      const relativeToRoot = path.relative(mediaRoot, filePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        return new Response('Forbidden', { status: 403 });
      }
    } else if (requestUrl.hostname === 'preview') {
      const token = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
      filePath = previewFiles.get(token);
      if (!filePath) return new Response('Not found', { status: 404 });
    } else {
      return new Response('Not found', { status: 404 });
    }

    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (_error) {
      return new Response('Not found', { status: 404 });
    }
    if (!stats.isFile()) return new Response('Not found', { status: 404 });

    const totalSize = stats.size;
    const contentType = contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
    const rangeHeader = request.headers.get('range');
    const commonHeaders = {
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Content-Type': contentType,
    };

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { ...commonHeaders, 'Content-Length': String(totalSize) },
      });
    }

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) {
        return new Response(null, {
          status: 416,
          headers: { ...commonHeaders, 'Content-Range': `bytes */${totalSize}` },
        });
      }

      let start;
      let end;
      if (match[1]) {
        start = Number.parseInt(match[1], 10);
        end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1;
      } else {
        const suffixLength = Number.parseInt(match[2], 10);
        start = Math.max(totalSize - suffixLength, 0);
        end = totalSize - 1;
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= totalSize) {
        return new Response(null, {
          status: 416,
          headers: { ...commonHeaders, 'Content-Range': `bytes */${totalSize}` },
        });
      }

      end = Math.min(end, totalSize - 1);
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream), {
        status: 206,
        headers: {
          ...commonHeaders,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        },
      });
    }

    const stream = fs.createReadStream(filePath);
    return new Response(Readable.toWeb(stream), {
      status: 200,
      headers: { ...commonHeaders, 'Content-Length': String(totalSize) },
    });
  });
}

function validSkillCategory(category) {
  return skillManifest.categories.some((item) => item.id === category);
}

function normalizeSkillChanges(changes) {
  const next = {};
  if (typeof changes?.name === 'string' && changes.name.trim()) {
    next.name = changes.name.trim().slice(0, 40);
  }
  if (typeof changes?.category === 'string' && validSkillCategory(changes.category)) {
    next.category = changes.category;
  }
  if (typeof changes?.muted === 'boolean') next.muted = changes.muted;
  if (typeof changes?.pinned === 'boolean') next.pinned = changes.pinned;
  if (changes?.visual && typeof changes.visual === 'object') {
    next.visual = normalizeSkillVisual(changes.visual);
  }
  return next;
}

function inspectTransparentPng(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size <= 0) throw new Error('PNG 文件为空');
  if (stats.size > 25 * 1024 * 1024) throw new Error('PNG 文件不能超过 25MB');
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('文件不是有效的 PNG 图片');
  }
  const ihdrLength = buffer.readUInt32BE(8);
  const ihdrType = buffer.toString('ascii', 12, 16);
  if (ihdrLength !== 13 || ihdrType !== 'IHDR') throw new Error('PNG 图片头无效');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  if (width < 32 || height < 32 || width > 8192 || height > 8192) {
    throw new Error('PNG 尺寸需要在 32×32 到 8192×8192 之间');
  }
  let hasTransparency = colorType === 4 || colorType === 6;
  let offset = 8;
  while (!hasTransparency && offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'tRNS') hasTransparency = true;
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  if (!hasTransparency) {
    throw new Error('这张 PNG 没有透明通道，请先在程序外抠图并导出透明 PNG');
  }
  return { width, height, fileSize: stats.size };
}

async function chooseCharacterImage() {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: '选择透明 PNG 角色图片',
    properties: ['openFile'],
    filters: [{ name: '透明 PNG 图片', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  const filePath = path.resolve(result.filePaths[0]);
  if (path.extname(filePath).toLowerCase() !== '.png') {
    return { ok: false, error: '角色主图只支持透明 PNG 格式。' };
  }
  try {
    const info = inspectTransparentPng(filePath);
    const token = crypto.randomUUID();
    previewFiles.set(token, filePath);
    return {
      ok: true,
      image: {
        token,
        fileName: path.basename(filePath),
        previewUrl: `pet://preview/${token}`,
        ...info,
      },
    };
  } catch (error) {
    return { ok: false, error: error.message || '透明 PNG 检查失败。' };
  }
}

async function chooseCharacterIdleMedia() {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: '选择透明待机 WebM',
    properties: ['openFile'],
    filters: [{ name: '透明待机动画', extensions: ['webm'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  const filePath = path.resolve(result.filePaths[0]);
  if (path.extname(filePath).toLowerCase() !== '.webm') {
    return { ok: false, error: '待机动画只支持透明 WebM 格式。' };
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile() || stats.size <= 0) return { ok: false, error: '待机动画文件为空。' };
  if (stats.size > 250 * 1024 * 1024) return { ok: false, error: '待机动画不能超过 250MB。' };
  const token = crypto.randomUUID();
  previewFiles.set(token, filePath);
  return {
    ok: true,
    media: {
      token,
      fileName: path.basename(filePath),
      previewUrl: `pet://preview/${token}`,
    },
  };
}

function roleSource(roleId, fileName) {
  return `pet://media/${roleId}/${fileName}`;
}

function copyPreviewFile(token, targetPath, expectedExtension) {
  const sourcePath = previewFiles.get(token);
  if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error('选择的素材已经失效，请重新选择');
  if (path.extname(sourcePath).toLowerCase() !== expectedExtension) {
    throw new Error(`素材格式必须是 ${expectedExtension}`);
  }
  const pendingPath = `${targetPath}.${process.pid}.${Date.now()}.importing`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.rmSync(pendingPath, { force: true });
  fs.copyFileSync(sourcePath, pendingPath, fs.constants.COPYFILE_EXCL);
  if (fs.statSync(pendingPath).size <= 0) {
    fs.rmSync(pendingPath, { force: true });
    throw new Error('复制后的素材文件为空');
  }
  fs.rmSync(targetPath, { force: true });
  fs.renameSync(pendingPath, targetPath);
}

function normalizeCharacterDraft(draft) {
  const category = ['pet', 'person', 'other'].includes(draft?.category) ? draft.category : null;
  const name = typeof draft?.name === 'string' ? draft.name.trim().slice(0, 40) : '';
  const idleMode = draft?.idleMode === 'animated' ? 'animated' : 'static';
  return {
    name,
    category,
    scale: clampPetScale(draft?.scale),
    idleMode,
    imageToken: typeof draft?.imageToken === 'string' ? draft.imageToken : null,
    idleToken: typeof draft?.idleToken === 'string' ? draft.idleToken : null,
  };
}

function getRoleDetails(roleId) {
  const role = characterIndex?.roles?.find((item) => item.id === roleId);
  if (!role) return { ok: false, error: '没有找到这个角色。' };
  const profile = roleId === activeRoleId ? userProfile : loadUserProfile(roleId);
  const idleSkill = profile.userSkills.find((skill) => skill.id === profile.appearance?.idleSkillId)
    || (roleId === 'doudou'
      ? bundledSkillManifest.skills.find((skill) => skill.id === profile.appearance?.idleSkillId)
      : null);
  const imageSource =
    safeSkillSource(profile.appearance?.mainImageSource) ||
    role.thumbnail ||
    (roleId === 'doudou' ? bundledSkillManifest.standardPose.image : null);
  return {
    ok: true,
    role: {
      ...role,
      isActive: roleId === activeRoleId,
      isDefault: roleId === characterIndex.defaultRoleId,
      scale: clampPetScale(profile.appearance?.scale),
      idleMode:
        profile.appearance?.startupState === 'standard-idle' && idleSkill
          ? 'animated'
          : 'static',
      imageSource,
      idleSource: safeSkillSource(idleSkill?.source),
      idleSkillId: idleSkill?.id || null,
    },
  };
}

function createCharacter(draft) {
  const normalized = normalizeCharacterDraft(draft);
  if (!normalized.name) return { ok: false, error: '请填写角色名称。' };
  if (!normalized.category) return { ok: false, error: '请选择角色分类。' };
  if (characterIndex.roles.length >= MAX_CHARACTERS) {
    return { ok: false, error: `角色库最多可以创建 ${MAX_CHARACTERS} 个角色。` };
  }
  const imagePath = previewFiles.get(normalized.imageToken);
  if (!imagePath || !fs.existsSync(imagePath)) {
    return { ok: false, error: '请选择透明 PNG 角色主图。' };
  }
  try {
    inspectTransparentPng(imagePath);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  if (normalized.idleMode === 'animated') {
    const idlePath = previewFiles.get(normalized.idleToken);
    if (!idlePath || path.extname(idlePath).toLowerCase() !== '.webm') {
      return { ok: false, error: '请选择透明待机 WebM，或改用静止状态。' };
    }
  }

  const roleId = `role-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const roleDirectory = getRoleDirectory(roleId);
  const mediaDirectory = getRoleMediaDirectory(roleId);
  const mainFileName = 'main.png';
  const idleFileName = 'idle.webm';
  const mainSource = roleSource(roleId, mainFileName);
  const idleSkillId = normalized.idleMode === 'animated' ? 'role-idle' : null;
  const profile = {
    schemaVersion: CHARACTER_PROFILE_SCHEMA_VERSION,
    identity: { id: roleId, name: normalized.name, category: normalized.category },
    appearance: {
      scale: normalized.scale,
      startupState: idleSkillId ? 'standard-idle' : 'static',
      mainImageSource: mainSource,
      idleSkillId,
    },
    fixedRules: {
      autoSleep: normalizeAutoSleepRule(
        { enabled: false, sleepEnterSkillId: '', sleepLoopSkillId: '', wakeSkillId: '' },
        getRoleBehaviorDefaults(roleId),
      ),
    },
    randomBehavior: normalizeRandomBehaviorRule({ enabled: false, skillIds: [] }),
    randomBehaviorDeleted: false,
    opening: normalizeOpeningConfig(null),
    skillOverrides: {},
    userSkills: idleSkillId
      ? [{
          id: idleSkillId,
          name: '标准待机',
          category: 'daily',
          type: 'transparent',
          source: roleSource(roleId, idleFileName),
          durationMs: 0,
          muted: true,
          pinned: false,
          transition: 'standard',
          visual: { scale: 1, offsetX: 0, offsetY: 0 },
        }]
      : [],
    deletedBuiltinSkillIds: [],
  };

  try {
    fs.mkdirSync(mediaDirectory, { recursive: true });
    copyPreviewFile(normalized.imageToken, path.join(mediaDirectory, mainFileName), '.png');
    if (idleSkillId) {
      copyPreviewFile(normalized.idleToken, path.join(mediaDirectory, idleFileName), '.webm');
    }
    writeJsonAtomic(getProfilePath(roleId), profile);
    addRoleMetadata(characterIndex, {
      id: roleId,
      name: normalized.name,
      category: normalized.category,
      thumbnail: mainSource,
      builtIn: false,
    });
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
  } catch (error) {
    if (characterIndex?.roles?.some((role) => role.id === roleId)) {
      characterIndex.roles = characterIndex.roles.filter((role) => role.id !== roleId);
    }
    fs.rmSync(roleDirectory, { recursive: true, force: true });
    throw error;
  }
  previewFiles.delete(normalized.imageToken);
  if (normalized.idleToken) previewFiles.delete(normalized.idleToken);
  sendToSettings('settings:data-changed', getSettingsData());
  return { ok: true, data: getSettingsData(), roleId };
}

function updateCharacter(roleId, draft) {
  const role = characterIndex?.roles?.find((item) => item.id === roleId);
  if (!role) return { ok: false, error: '没有找到这个角色。' };
  const normalized = normalizeCharacterDraft(draft);
  if (!normalized.name) return { ok: false, error: '请填写角色名称。' };
  if (!normalized.category) return { ok: false, error: '请选择角色分类。' };
  const profile = roleId === activeRoleId ? userProfile : loadUserProfile(roleId);
  const mediaDirectory = getRoleMediaDirectory(roleId);

  if (normalized.imageToken) {
    const imagePath = previewFiles.get(normalized.imageToken);
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { ok: false, error: '新选择的角色主图已经失效。' };
    }
    try {
      inspectTransparentPng(imagePath);
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
  const currentIdleSkill = profile.userSkills.find((skill) => skill.id === profile.appearance?.idleSkillId)
    || (roleId === 'doudou'
      ? bundledSkillManifest.skills.find((skill) => skill.id === profile.appearance?.idleSkillId)
      : null);
  if (normalized.idleMode === 'animated' && !normalized.idleToken && !currentIdleSkill) {
    return { ok: false, error: '请选择透明待机 WebM，或改用静止状态。' };
  }
  if (normalized.idleToken) {
    const idlePath = previewFiles.get(normalized.idleToken);
    if (!idlePath || path.extname(idlePath).toLowerCase() !== '.webm') {
      return { ok: false, error: '新选择的待机动画已经失效。' };
    }
  }

  try {
    fs.mkdirSync(mediaDirectory, { recursive: true });
    if (normalized.imageToken) {
      copyPreviewFile(normalized.imageToken, path.join(mediaDirectory, 'main.png'), '.png');
      profile.appearance.mainImageSource = roleSource(roleId, 'main.png');
    }
    if (normalized.idleToken) {
      const idleFileName = `idle-${Date.now().toString(36)}.webm`;
      copyPreviewFile(normalized.idleToken, path.join(mediaDirectory, idleFileName), '.webm');
      const idleSkillId = roleId === 'doudou' ? 'role-idle-custom' : 'role-idle';
      const nextSkill = {
        id: idleSkillId,
        name: '标准待机',
        category: 'daily',
        type: 'transparent',
        source: roleSource(roleId, idleFileName),
        durationMs: 0,
        muted: true,
        pinned: false,
        transition: 'standard',
        visual: currentIdleSkill?.visual || { scale: 1, offsetX: 0, offsetY: 0 },
      };
      const existingIndex = profile.userSkills.findIndex((skill) => skill.id === idleSkillId);
      if (existingIndex >= 0) profile.userSkills[existingIndex] = nextSkill;
      else profile.userSkills.push(nextSkill);
      profile.appearance.idleSkillId = idleSkillId;
    }
    profile.appearance.scale = normalized.scale;
    profile.appearance.startupState =
      normalized.idleMode === 'animated' ? 'standard-idle' : 'static';
    profile.identity = { id: roleId, name: normalized.name, category: normalized.category };
    writeJsonAtomic(getProfilePath(roleId), profile);
    updateRoleMetadata(characterIndex, roleId, {
      name: normalized.name,
      category: normalized.category,
      thumbnail: profile.appearance.mainImageSource || role.thumbnail,
    });
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
  } catch (error) {
    throw error;
  }

  if (normalized.imageToken) previewFiles.delete(normalized.imageToken);
  if (normalized.idleToken) previewFiles.delete(normalized.idleToken);
  if (roleId === activeRoleId) {
    userProfile = profile;
    applyPetScale(normalized.scale, { persist: false });
    rebuildSkillManifest();
    publishConfigurationChanges({ skillsChanged: true, appearanceChanged: true });
  } else {
    sendToSettings('settings:data-changed', getSettingsData());
  }
  return { ok: true, data: getSettingsData(), roleId };
}

function setDefaultCharacter(roleId) {
  try {
    setDefaultRole(characterIndex, roleId);
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
    sendToSettings('settings:data-changed', getSettingsData());
    return { ok: true, data: getSettingsData() };
  } catch (error) {
    return { ok: false, error: error.message === 'Role not found' ? '没有找到这个角色。' : '默认角色保存失败。' };
  }
}

function deleteCharacter(roleId) {
  const role = characterIndex?.roles?.find((item) => item.id === roleId);
  if (!role) return { ok: false, error: '没有找到这个角色。' };
  if (roleId === activeRoleId) return { ok: false, error: '当前正在使用这个角色，请先切换到其他角色。' };
  if (roleId === characterIndex.defaultRoleId) {
    return { ok: false, error: '这是默认启动角色，请先设置另一个默认启动角色。' };
  }
  if (characterIndex.roles.length <= 1) return { ok: false, error: '角色库至少需要保留一个角色。' };
  const roleDirectory = path.resolve(getRoleDirectory(roleId));
  const charactersRoot = path.resolve(path.join(app.getPath('userData'), 'characters'));
  const relative = path.relative(charactersRoot, roleDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, error: '角色目录无效，无法删除。' };
  }
  try {
    removeRoleMetadata(characterIndex, roleId);
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
    fs.rmSync(roleDirectory, { recursive: true, force: true });
    sendToSettings('settings:data-changed', getSettingsData());
    return { ok: true, data: getSettingsData() };
  } catch (error) {
    throw error;
  }
}

function resolveCharacterPackageSource(source) {
  if (typeof source !== 'string' || !source) return null;
  if (source.startsWith('pet://media/')) return resolveUserMediaSource(source);
  const relative = safeRelativeAsset(source);
  return relative ? path.resolve(__dirname, relative) : null;
}

function sanitizePackageFileStem(value, fallback = 'media') {
  const stem = String(value || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return stem || fallback;
}

function createCharacterPackageMediaCollector() {
  const bySource = new Map();
  const mediaFiles = [];
  function add(source, hint = 'media') {
    if (bySource.has(source)) return bySource.get(source);
    const filePath = resolveCharacterPackageSource(source);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`角色素材不存在：${String(source || '未填写素材')}`);
    }
    const extension = path.extname(filePath).toLowerCase();
    const number = String(mediaFiles.length + 1).padStart(3, '0');
    const name = `${number}-${sanitizePackageFileStem(hint, 'media')}${extension}`;
    const packagedSource = packageMediaSource(name);
    bySource.set(source, packagedSource);
    mediaFiles.push({ name, path: filePath });
    return packagedSource;
  }
  return { add, mediaFiles };
}

function getMaterializedSkillsForRole(roleId, profile) {
  const merged = new Map();
  if (roleId === 'doudou') {
    const deleted = new Set(profile.deletedBuiltinSkillIds || []);
    for (const skill of bundledSkillManifest.skills) {
      if (deleted.has(skill.id)) continue;
      const override = profile.skillOverrides?.[skill.id] || {};
      const normalized = sanitizeSkill(
        {
          ...skill,
          name: override.name || skill.name,
          category: override.category || skill.category,
          muted: typeof override.muted === 'boolean' ? override.muted : skill.muted,
          pinned: typeof override.pinned === 'boolean' ? override.pinned : skill.pinned,
          visual: override.visual || skill.visual,
        },
        'package',
      );
      if (normalized) merged.set(normalized.id, normalized);
    }
  }
  for (const skill of profile.userSkills || []) {
    const normalized = sanitizeSkill(skill, 'package');
    if (normalized) merged.set(normalized.id, normalized);
  }
  return [...merged.values()];
}

function createPortableRoleProfile(roleId) {
  const role = getRoleMetadata(roleId);
  const profile = roleId === activeRoleId ? userProfile : loadUserProfile(roleId);
  const collector = createCharacterPackageMediaCollector();
  const mainImageSource =
    safeSkillSource(profile.appearance?.mainImageSource) ||
    safeSkillSource(role.thumbnail) ||
    bundledSkillManifest.standardPose.image;
  const portableMainImage = collector.add(mainImageSource, 'main');
  const skills = getMaterializedSkillsForRole(roleId, profile).map((skill) => {
    const { origin: _origin, ...portableSkill } = skill;
    return {
      ...portableSkill,
      source: collector.add(skill.source, `skill-${skill.id}`),
    };
  });
  const opening = normalizeOpeningConfig(profile.opening);
  const portableOpening = {
    ...opening,
    plans: opening.plans.map((plan) => ({
      ...plan,
      segments: plan.segments.map((segment) => ({
        ...segment,
        source: collector.add(segment.source, `opening-${plan.id}-${segment.id}`),
      })),
    })),
  };
  return {
    role,
    mediaFiles: collector.mediaFiles,
    profile: {
      schemaVersion: CHARACTER_PROFILE_SCHEMA_VERSION,
      identity: { id: role.id, name: role.name, category: role.category },
      appearance: {
        scale: clampPetScale(profile.appearance?.scale),
        startupState: normalizeStartupState(profile.appearance?.startupState),
        mainImageSource: portableMainImage,
        idleSkillId:
          typeof profile.appearance?.idleSkillId === 'string'
            ? profile.appearance.idleSkillId.slice(0, 80)
            : null,
      },
      fixedRules: {
        autoSleep: normalizeAutoSleepRule(
          profile.fixedRules?.autoSleep,
          getRoleBehaviorDefaults(roleId),
        ),
      },
      randomBehavior: profile.randomBehaviorDeleted
        ? null
        : normalizeRandomBehaviorRule(profile.randomBehavior),
      randomBehaviorDeleted: profile.randomBehaviorDeleted === true,
      opening: portableOpening,
      skillOverrides: {},
      userSkills: skills,
      deletedBuiltinSkillIds: [],
    },
  };
}

function uniqueRoleId() {
  let roleId;
  do {
    roleId = `role-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  } while (characterIndex.roles.some((role) => role.id === roleId));
  return roleId;
}

function rewriteImportedPackageSource(source, roleId, availableMedia) {
  const fileName = parsePackageMediaSource(source);
  if (!fileName || !availableMedia.has(fileName)) return null;
  return roleSource(roleId, fileName);
}

function normalizeImportedCharacterProfile(packageProfile, manifest, roleId, availableMedia) {
  const category = ['pet', 'person', 'other'].includes(manifest.role?.category)
    ? manifest.role.category
    : 'other';
  const name = String(manifest.role?.name || '导入角色').trim().slice(0, 40) || '导入角色';
  const mainImageSource = rewriteImportedPackageSource(
    packageProfile?.appearance?.mainImageSource,
    roleId,
    availableMedia,
  );
  if (!mainImageSource || path.extname(new URL(mainImageSource).pathname).toLowerCase() !== '.png') {
    throw new Error('角色包缺少有效的透明 PNG 主图。');
  }

  const categoryIds = new Set(bundledSkillManifest.categories.map((item) => item.id));
  const skillIds = new Set();
  const userSkills = [];
  for (const candidate of Array.isArray(packageProfile?.userSkills)
    ? packageProfile.userSkills.slice(0, 500)
    : []) {
    if (
      !candidate ||
      !/^[a-z0-9-]+$/i.test(candidate.id) ||
      skillIds.has(candidate.id) ||
      !['transparent', 'scene'].includes(candidate.type)
    ) {
      continue;
    }
    const source = rewriteImportedPackageSource(candidate.source, roleId, availableMedia);
    if (!source) continue;
    const extension = path.extname(new URL(source).pathname).toLowerCase();
    if (candidate.type === 'transparent' && extension !== '.webm') continue;
    if (candidate.type === 'scene' && !['.webm', '.mp4'].includes(extension)) continue;
    skillIds.add(candidate.id);
    userSkills.push({
      id: candidate.id.slice(0, 80),
      name: String(candidate.name || candidate.id).trim().slice(0, 40) || candidate.id,
      category: categoryIds.has(candidate.category)
        ? candidate.category
        : (candidate.type === 'scene' ? 'scene' : 'daily'),
      type: candidate.type,
      source,
      durationMs: Math.max(0, Number(candidate.durationMs) || 0),
      muted: candidate.muted !== false,
      pinned: candidate.pinned === true,
      transition: candidate.type === 'scene' ? 'scene-fade' : 'standard',
      visual: normalizeSkillVisual(candidate.visual),
    });
  }

  const openingPlans = [];
  for (const plan of Array.isArray(packageProfile?.opening?.plans)
    ? packageProfile.opening.plans.slice(0, 30)
    : []) {
    if (!plan || !/^[a-z0-9-]+$/i.test(plan.id)) continue;
    const segments = [];
    for (const segment of Array.isArray(plan.segments) ? plan.segments.slice(0, 30) : []) {
      if (!segment || !/^[a-z0-9-]+$/i.test(segment.id)) continue;
      const source = rewriteImportedPackageSource(segment.source, roleId, availableMedia);
      if (!source || path.extname(new URL(source).pathname).toLowerCase() !== '.webm') continue;
      segments.push({
        id: segment.id.slice(0, 80),
        name: String(segment.name || '开场片段').trim().slice(0, 40) || '开场片段',
        source,
        durationMs: Math.max(0, Number(segment.durationMs) || 0),
        enabled: segment.enabled !== false,
        muted: segment.muted === true,
        visual: normalizeSkillVisual(segment.visual),
      });
    }
    openingPlans.push({
      id: plan.id.slice(0, 80),
      name: String(plan.name || '开场方案').trim().slice(0, 40) || '开场方案',
      enabled: plan.enabled !== false,
      segments,
    });
  }
  const requestedPlanId = packageProfile?.opening?.currentPlanId;
  const currentPlanId = openingPlans.some((plan) => plan.id === requestedPlanId)
    ? requestedPlanId
    : (openingPlans[0]?.id || null);
  const requestedIdleSkillId =
    typeof packageProfile?.appearance?.idleSkillId === 'string'
      ? packageProfile.appearance.idleSkillId.slice(0, 80)
      : null;
  const idleSkillId = skillIds.has(requestedIdleSkillId) ? requestedIdleSkillId : null;
  const importedAutoSleepRule = normalizeAutoSleepRule(
    packageProfile?.fixedRules?.autoSleep || {
      enabled: false,
      sleepEnterSkillId: '',
      sleepLoopSkillId: '',
      wakeSkillId: '',
    },
    getRoleBehaviorDefaults(roleId),
  );
  importedAutoSleepRule.sleepEnterSkillId = skillIds.has(importedAutoSleepRule.sleepEnterSkillId)
    ? importedAutoSleepRule.sleepEnterSkillId
    : '';
  importedAutoSleepRule.sleepLoopSkillId = skillIds.has(importedAutoSleepRule.sleepLoopSkillId)
    ? importedAutoSleepRule.sleepLoopSkillId
    : '';
  importedAutoSleepRule.wakeSkillId = skillIds.has(importedAutoSleepRule.wakeSkillId)
    ? importedAutoSleepRule.wakeSkillId
    : '';
  if (!importedAutoSleepRule.sleepLoopSkillId) importedAutoSleepRule.enabled = false;
  const importedRandomBehavior = packageProfile?.randomBehaviorDeleted === true
    ? null
    : normalizeRandomBehaviorRule(packageProfile?.randomBehavior);
  if (importedRandomBehavior) {
    importedRandomBehavior.skillIds = importedRandomBehavior.skillIds.filter((id) => skillIds.has(id));
    if (importedRandomBehavior.skillIds.length === 0) importedRandomBehavior.enabled = false;
  }

  return {
    schemaVersion: CHARACTER_PROFILE_SCHEMA_VERSION,
    identity: { id: roleId, name, category },
    appearance: {
      scale: clampPetScale(packageProfile?.appearance?.scale),
      startupState:
        normalizeStartupState(packageProfile?.appearance?.startupState) === 'standard-idle' &&
        idleSkillId
          ? 'standard-idle'
          : 'static',
      mainImageSource,
      idleSkillId,
    },
    fixedRules: {
      autoSleep: importedAutoSleepRule,
    },
    randomBehavior: importedRandomBehavior,
    randomBehaviorDeleted: packageProfile?.randomBehaviorDeleted === true,
    opening: {
      playOnStartup: packageProfile?.opening?.playOnStartup === true,
      currentPlanId,
      plans: openingPlans,
    },
    skillOverrides: {},
    userSkills,
    deletedBuiltinSkillIds:
      roleId === 'doudou' ? bundledSkillManifest.skills.map((skill) => skill.id) : [],
  };
}

function safePackageFileName(roleName) {
  const safeName = String(roleName || '角色')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[.\s]+$/g, '')
    .slice(0, 80);
  return `${safeName || '角色'}${PACKAGE_EXTENSION}`;
}

async function exportCharacterPackage(roleId) {
  const role = characterIndex?.roles?.find((item) => item.id === roleId);
  if (!role) return { ok: false, error: '没有找到这个角色。' };
  const result = await dialog.showSaveDialog(settingsWindow || mainWindow, {
    title: `导出“${role.name}”角色包`,
    defaultPath: path.join(app.getPath('documents'), safePackageFileName(role.name)),
    filters: [{ name: '豆豆角色包', extensions: [PACKAGE_EXTENSION.slice(1)] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
  const outputPath = result.filePath.toLowerCase().endsWith(PACKAGE_EXTENSION)
    ? result.filePath
    : `${result.filePath}${PACKAGE_EXTENSION}`;
  const portable = createPortableRoleProfile(roleId);
  writeCharacterPackage({
    outputPath,
    appVersion: app.getVersion(),
    role: portable.role,
    profile: portable.profile,
    mediaFiles: portable.mediaFiles,
  });
  return { ok: true, filePath: outputPath, roleName: role.name };
}

function writeImportedRoleDirectory(stagingDirectory, profile, mediaFiles) {
  const mediaDirectory = path.join(stagingDirectory, 'media');
  fs.mkdirSync(mediaDirectory, { recursive: true });
  for (const media of mediaFiles) {
    const outputPath = path.resolve(mediaDirectory, media.name);
    const relative = path.relative(mediaDirectory, outputPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('角色包素材路径无效。');
    }
    fs.writeFileSync(outputPath, media.data, { flag: 'wx' });
  }
  writeJsonAtomic(path.join(stagingDirectory, 'profile.json'), profile);
  const actualMainImage = path.join(
    mediaDirectory,
    new URL(profile.appearance.mainImageSource).pathname.split('/').pop(),
  );
  inspectTransparentPng(actualMainImage);
}

async function chooseCharacterPackageConflict(manifest, conflict) {
  if (!conflict) return 'new';
  const result = await dialog.showMessageBox(settingsWindow || mainWindow, {
    type: 'question',
    title: '发现同一个角色',
    message: `角色库中已经存在“${conflict.name}”。`,
    detail: '作为新副本导入最安全；替换并更新会完全覆盖原角色的素材、技能、开场和规则。',
    buttons: ['作为新副本导入', '替换并更新原角色', '取消导入'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  return result.response === 0 ? 'new' : result.response === 1 ? 'replace' : 'cancel';
}

async function askSwitchAfterImport(roleId, roleName) {
  const result = await dialog.showMessageBox(settingsWindow || mainWindow, {
    type: 'info',
    title: '角色导入成功',
    message: `“${roleName}”已经加入角色库。`,
    detail: '是否立即切换到新导入的角色？',
    buttons: ['立即切换', '稍后使用'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (result.response !== 0) return { switched: false };
  const switched = await switchCharacter(roleId, 'package-import');
  if (!switched.ok) {
    await dialog.showMessageBox(settingsWindow || mainWindow, {
      type: 'info',
      title: '角色已导入',
      message: '当前动作还没有结束，暂时不能切换角色。',
      detail: '角色包已经安全导入，可以稍后在角色管理中切换。',
      buttons: ['知道了'],
    });
    return { switched: false, switchError: switched.error };
  }
  return { switched: true };
}

function installImportedCharacterPackage(imported, mode, conflict = null) {
  const originalId = isSafeRoleId(imported.manifest.role?.originalId)
    ? imported.manifest.role.originalId
    : null;
  const targetRoleId = mode === 'replace' && conflict
    ? conflict.id
    : (originalId && !characterIndex.roles.some((role) => role.id === originalId)
      ? originalId
      : uniqueRoleId());
  const mediaNames = new Set(imported.mediaFiles.map((file) => file.name));
  const profile = normalizeImportedCharacterProfile(
    imported.profile,
    imported.manifest,
    targetRoleId,
    mediaNames,
  );
  const roleName =
    mode === 'new' && conflict
      ? `${profile.identity.name} 副本`.slice(0, 40)
      : profile.identity.name;
  profile.identity.name = roleName;
  const charactersRoot = path.join(app.getPath('userData'), 'characters');
  const stagingDirectory = path.join(
    charactersRoot,
    `.import-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
  );
  const roleDirectory = getRoleDirectory(targetRoleId);
  const backupDirectory = `${roleDirectory}.replace-${Date.now()}.bak`;
  const previousCharacterIndex = JSON.parse(JSON.stringify(characterIndex));
  let existingMoved = false;
  try {
    writeImportedRoleDirectory(stagingDirectory, profile, imported.mediaFiles);
    if (mode === 'replace' && fs.existsSync(roleDirectory)) {
      fs.renameSync(roleDirectory, backupDirectory);
      existingMoved = true;
    }
    fs.renameSync(stagingDirectory, roleDirectory);
    if (mode === 'replace' && conflict) {
      updateRoleMetadata(characterIndex, targetRoleId, {
        name: roleName,
        category: profile.identity.category,
        thumbnail: profile.appearance.mainImageSource,
      });
    } else {
      addRoleMetadata(characterIndex, {
        id: targetRoleId,
        name: roleName,
        category: profile.identity.category,
        thumbnail: profile.appearance.mainImageSource,
        builtIn: false,
      });
    }
    characterIndex = saveCharacterIndex(app.getPath('userData'), characterIndex);
    fs.rmSync(backupDirectory, { recursive: true, force: true });
  } catch (error) {
    characterIndex = previousCharacterIndex;
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
    if (existingMoved) {
      fs.rmSync(roleDirectory, { recursive: true, force: true });
      fs.renameSync(backupDirectory, roleDirectory);
    }
    throw error;
  }
  return { roleId: targetRoleId, roleName, replaced: mode === 'replace' };
}

async function importCharacterPackage() {
  const chosen = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: '导入豆豆角色包',
    properties: ['openFile'],
    filters: [{ name: '豆豆角色包', extensions: [PACKAGE_EXTENSION.slice(1)] }],
  });
  if (chosen.canceled || !chosen.filePaths[0]) return { ok: false, cancelled: true };

  const imported = readCharacterPackage(chosen.filePaths[0]);
  const originalId = isSafeRoleId(imported.manifest.role?.originalId)
    ? imported.manifest.role.originalId
    : null;
  const conflict = originalId
    ? characterIndex.roles.find((role) => role.id === originalId)
    : null;
  const mode = await chooseCharacterPackageConflict(imported.manifest, conflict);
  if (mode === 'cancel') return { ok: false, cancelled: true };
  if (mode === 'replace' && conflict?.id === activeRoleId) {
    return {
      ok: false,
      error: '当前正在使用这个角色。请先切换到另一个角色，再执行“替换并更新”。',
    };
  }
  if (mode === 'new' && characterIndex.roles.length >= MAX_CHARACTERS) {
    return { ok: false, error: `角色库最多可以保存 ${MAX_CHARACTERS} 个角色。` };
  }

  const installed = installImportedCharacterPackage(imported, mode, conflict);

  sendToSettings('settings:data-changed', getSettingsData());
  const switchResult =
    mode === 'replace'
      ? { switched: false }
      : await askSwitchAfterImport(installed.roleId, installed.roleName);
  return {
    ok: true,
    roleId: installed.roleId,
    roleName: installed.roleName,
    replaced: installed.replaced,
    switched: switchResult.switched,
    data: getSettingsData(),
  };
}

async function chooseSkillMedia() {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: '选择技能视频素材',
    properties: ['openFile'],
    filters: [
      { name: '技能视频', extensions: ['webm', 'mp4'] },
      { name: '透明角色动画', extensions: ['webm'] },
      { name: '场景视频', extensions: ['mp4', 'webm'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  const filePath = path.resolve(result.filePaths[0]);
  const extension = path.extname(filePath).toLowerCase();
  if (!['.webm', '.mp4'].includes(extension)) {
    return { ok: false, error: '只支持WebM透明动画或MP4/WebM场景视频。' };
  }
  const token = crypto.randomUUID();
  previewFiles.set(token, filePath);
  const fileName = path.basename(filePath);
  return {
    ok: true,
    media: {
      token,
      fileName,
      suggestedName: path.basename(fileName, extension).slice(0, 40),
      suggestedType: extension === '.mp4' ? 'scene' : 'transparent',
      previewUrl: `pet://preview/${token}`,
    },
  };
}

function importSkill(draft) {
  const sourcePath = previewFiles.get(draft?.token);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, error: '选择的素材已经失效，请重新选择。' };
  }
  const name = typeof draft.name === 'string' ? draft.name.trim().slice(0, 40) : '';
  const type = draft.type;
  const category = draft.category;
  const extension = path.extname(sourcePath).toLowerCase();
  if (!name) return { ok: false, error: '请填写技能名称。' };
  if (!['transparent', 'scene'].includes(type)) return { ok: false, error: '素材类型无效。' };
  if (!validSkillCategory(category)) return { ok: false, error: '技能分类无效。' };
  if (type === 'transparent' && extension !== '.webm') {
    return { ok: false, error: '透明角色动画必须先转换为WebM。' };
  }
  if (!['.webm', '.mp4'].includes(extension)) {
    return { ok: false, error: '视频格式不受支持。' };
  }

  const skillId = `user-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const targetName = `${skillId}${extension}`;
  const targetPath = path.join(getRoleMediaDirectory(), targetName);
  const pendingPath = `${targetPath}.importing`;
  const importedSkill = {
    id: skillId,
    name,
    category,
    type,
    source: `pet://media/${activeRoleId}/${targetName}`,
    durationMs: Math.max(0, Number(draft.durationMs) || 0),
    muted: draft.muted !== false,
    pinned: Boolean(draft.pinned),
    transition: type === 'scene' ? 'scene-fade' : 'standard',
    visual: normalizeSkillVisual(draft.visual),
  };

  fs.mkdirSync(getRoleMediaDirectory(), { recursive: true });
  fs.rmSync(pendingPath, { force: true });
  try {
    fs.copyFileSync(sourcePath, pendingPath, fs.constants.COPYFILE_EXCL);
    const copiedSize = fs.statSync(pendingPath).size;
    if (copiedSize <= 0) throw new Error('复制后的素材文件为空');
    fs.renameSync(pendingPath, targetPath);
    userProfile.userSkills.push(importedSkill);
    saveUserProfile();
  } catch (error) {
    userProfile.userSkills = userProfile.userSkills.filter((item) => item.id !== skillId);
    fs.rmSync(pendingPath, { force: true });
    fs.rmSync(targetPath, { force: true });
    throw error;
  }

  previewFiles.delete(draft.token);
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function updateSkill(skillId, changes) {
  const skill = skillManifest.skills.find((item) => item.id === skillId);
  if (!skill) return { ok: false, error: '没有找到这个技能。' };
  const normalized = normalizeSkillChanges(changes);
  if (!normalized.name) normalized.name = skill.name;
  if (!normalized.category) normalized.category = skill.category;

  if (skill.origin === 'builtin') {
    userProfile.skillOverrides[skillId] = {
      ...(userProfile.skillOverrides[skillId] || {}),
      ...normalized,
    };
  } else {
    const index = userProfile.userSkills.findIndex((item) => item.id === skillId);
    if (index < 0) return { ok: false, error: '没有找到导入技能的配置。' };
    userProfile.userSkills[index] = { ...userProfile.userSkills[index], ...normalized };
  }
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function getSkillUsage(skillId) {
  const affected = [];
  const autoSleep = normalizeAutoSleepRule(
    userProfile.fixedRules?.autoSleep,
    getRoleBehaviorDefaults(activeRoleId),
  );
  for (const reference of getInactivityRuleReferences(autoSleep)) {
    if (reference.skillId === skillId) affected.push(reference.label);
  }
  if (userProfile.appearance?.idleSkillId === skillId) affected.push('普通待机动画');
  if (userProfile.randomBehavior?.skillIds?.includes(skillId)) affected.push('随机行为');
  for (const plan of userProfile.opening?.plans || []) {
    for (const segment of plan.segments || []) {
      if (segment.skillId === skillId) affected.push(`开场方案：${plan.name}`);
    }
  }
  return [...new Set(affected)];
}

function deleteSkill(skillId) {
  const skill = skillManifest.skills.find((item) => item.id === skillId);
  if (!skill) return { ok: false, error: '没有找到这个技能。' };

  const affected = getSkillUsage(skillId);
  if (userProfile.randomBehavior?.skillIds?.includes(skillId)) {
    userProfile.randomBehavior.skillIds = userProfile.randomBehavior.skillIds.filter((id) => id !== skillId);
    if (userProfile.randomBehavior.skillIds.length === 0) userProfile.randomBehavior.enabled = false;
  }
  if (userProfile.appearance?.idleSkillId === skillId) {
    userProfile.appearance.idleSkillId = null;
    userProfile.appearance.startupState = 'static';
  }
  const autoSleep = normalizeAutoSleepRule(
    userProfile.fixedRules?.autoSleep,
    getRoleBehaviorDefaults(activeRoleId),
  );
  if (autoSleep.sleepEnterSkillId === skillId) autoSleep.sleepEnterSkillId = '';
  if (autoSleep.sleepLoopSkillId === skillId) {
    autoSleep.sleepLoopSkillId = '';
    autoSleep.enabled = false;
  }
  if (autoSleep.wakeSkillId === skillId) autoSleep.wakeSkillId = '';
  userProfile.fixedRules = { ...(userProfile.fixedRules || {}), autoSleep };

  if (skill.origin === 'builtin') {
    if (!userProfile.deletedBuiltinSkillIds.includes(skillId)) {
      userProfile.deletedBuiltinSkillIds.push(skillId);
    }
    delete userProfile.skillOverrides[skillId];
  } else {
    userProfile.userSkills = userProfile.userSkills.filter((item) => item.id !== skillId);
    const mediaPath = resolveUserMediaSource(skill.source);
    if (mediaPath) {
      const stillUsed = userProfile.userSkills.some((item) => {
        return resolveUserMediaSource(item.source) === mediaPath;
      });
      if (!stillUsed) fs.rmSync(mediaPath, { force: true });
    }
  }
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, affected, data: getSettingsData() };
}

function restoreBuiltinSkills() {
  userProfile.deletedBuiltinSkillIds = [];
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function updateAutoSleepRule(changes) {
  const current = normalizeAutoSleepRule(
    userProfile.fixedRules?.autoSleep,
    getRoleBehaviorDefaults(activeRoleId),
  );
  const next = normalizeAutoSleepRule(
    { ...current, ...(changes || {}) },
    getRoleBehaviorDefaults(activeRoleId),
  );
  if (next.enabled && !next.sleepLoopSkillId) {
    return { ok: false, error: '启用无互动流程前，必须选择一个循环状态动画。' };
  }
  const selectedSkills = [
    ['进入动画', next.sleepEnterSkillId],
    ['循环动画', next.sleepLoopSkillId],
    ['恢复动画', next.wakeSkillId],
  ].filter(([, skillId]) => skillId);
  for (const [label, skillId] of selectedSkills) {
    const skill = skillManifest.skills.find((item) => item.id === skillId);
    if (!skill || skill.type !== 'transparent') {
      return { ok: false, error: `${label}必须选择一个可用的透明角色动画。` };
    }
  }
  userProfile.fixedRules = { ...(userProfile.fixedRules || {}), autoSleep: next };
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function updateStartupState(value) {
  userProfile.appearance = {
    ...(userProfile.appearance || {}),
    startupState: normalizeStartupState(value),
  };
  saveUserProfile();
  publishConfigurationChanges({ skillsChanged: false, appearanceChanged: true });
  return { ok: true, appearance: getSettingsData().appearance };
}

function getEligibleRandomSkills() {
  const autoSleep = normalizeAutoSleepRule(
    userProfile.fixedRules?.autoSleep,
    getRoleBehaviorDefaults(activeRoleId),
  );
  const reserved = new Set([
    userProfile.appearance?.idleSkillId,
    autoSleep.sleepEnterSkillId,
    autoSleep.sleepLoopSkillId,
    autoSleep.wakeSkillId,
  ]);
  return skillManifest.skills.filter((skill) => !reserved.has(skill.id));
}

function updateRandomBehaviorRule(changes) {
  const current = userProfile.randomBehaviorDeleted
    ? normalizeRandomBehaviorRule(null)
    : normalizeRandomBehaviorRule(userProfile.randomBehavior);
  const next = normalizeRandomBehaviorRule({ ...current, ...(changes || {}) });
  const eligibleIds = new Set(getEligibleRandomSkills().map((skill) => skill.id));
  next.skillIds = next.skillIds.filter((id) => eligibleIds.has(id));
  if (next.enabled && next.skillIds.length === 0) {
    return { ok: false, error: '开启随机行为前，请至少勾选一个可以随机播放的技能。' };
  }
  userProfile.randomBehaviorDeleted = false;
  userProfile.randomBehavior = next;
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function deleteRandomBehaviorRule() {
  userProfile.randomBehaviorDeleted = true;
  userProfile.randomBehavior = null;
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function restoreRandomBehaviorRule() {
  userProfile.randomBehaviorDeleted = false;
  userProfile.randomBehavior = normalizeRandomBehaviorRule(null);
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function getOpeningPlan(planId) {
  return userProfile.opening?.plans?.find((plan) => plan.id === planId) || null;
}

function openingSourceStillUsed(source) {
  if (!source) return false;
  if (userProfile.userSkills.some((skill) => skill.source === source)) return true;
  return userProfile.opening.plans.some((plan) => (
    plan.segments.some((segment) => segment.source === source)
  ));
}

function removeUnusedOpeningSource(source) {
  if (openingSourceStillUsed(source)) return;
  const mediaPath = resolveUserMediaSource(source);
  if (mediaPath) fs.rmSync(mediaPath, { force: true });
}

async function chooseOpeningMedia() {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    title: '选择透明WebM开场视频',
    properties: ['openFile'],
    filters: [{ name: '透明WebM动画', extensions: ['webm'] }],
  });
  if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
  const filePath = path.resolve(result.filePaths[0]);
  if (path.extname(filePath).toLowerCase() !== '.webm') {
    return { ok: false, error: '开场片段只支持带透明通道的WebM动画。' };
  }
  const token = crypto.randomUUID();
  previewFiles.set(token, filePath);
  const fileName = path.basename(filePath);
  return {
    ok: true,
    media: {
      token,
      fileName,
      suggestedName: path.basename(fileName, '.webm').slice(0, 40),
      previewUrl: `pet://preview/${token}`,
    },
  };
}

function copyOpeningPreview(token) {
  const sourcePath = previewFiles.get(token);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { ok: false, error: '选择的开场素材已经失效，请重新选择。' };
  }
  if (path.extname(sourcePath).toLowerCase() !== '.webm') {
    return { ok: false, error: '开场片段必须是WebM动画。' };
  }
  const segmentId = `opening-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const targetName = `${segmentId}.webm`;
  fs.copyFileSync(
    sourcePath,
    path.join(getRoleMediaDirectory(), targetName),
    fs.constants.COPYFILE_EXCL,
  );
  previewFiles.delete(token);
  return { ok: true, segmentId, source: `pet://media/${activeRoleId}/${targetName}` };
}

function createOpeningPlan(name = '新开场方案') {
  if (userProfile.opening.plans.length >= 30) {
    return { ok: false, error: '每个角色最多保存30套开场方案。' };
  }
  const plan = {
    id: `plan-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    name: String(name || '新开场方案').trim().slice(0, 40) || '新开场方案',
    enabled: true,
    segments: [],
  };
  userProfile.opening.plans.push(plan);
  if (!userProfile.opening.currentPlanId) userProfile.opening.currentPlanId = plan.id;
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, planId: plan.id, data: getSettingsData() };
}

function updateOpeningSettings(changes) {
  if (typeof changes?.playOnStartup === 'boolean') {
    userProfile.opening.playOnStartup = changes.playOnStartup;
  }
  if (typeof changes?.currentPlanId === 'string') {
    if (!getOpeningPlan(changes.currentPlanId)) return { ok: false, error: '没有找到这个开场方案。' };
    userProfile.opening.currentPlanId = changes.currentPlanId;
  }
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function updateOpeningPlan(planId, changes) {
  const plan = getOpeningPlan(planId);
  if (!plan) return { ok: false, error: '没有找到这个开场方案。' };
  if (typeof changes?.name === 'string' && changes.name.trim()) {
    plan.name = changes.name.trim().slice(0, 40);
  }
  if (typeof changes?.enabled === 'boolean') plan.enabled = changes.enabled;
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function duplicateOpeningPlan(planId) {
  const plan = getOpeningPlan(planId);
  if (!plan) return { ok: false, error: '没有找到这个开场方案。' };
  if (userProfile.opening.plans.length >= 30) {
    return { ok: false, error: '每个角色最多保存30套开场方案。' };
  }
  const copyId = `plan-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const copy = {
    id: copyId,
    name: `${plan.name} 副本`.slice(0, 40),
    enabled: plan.enabled,
    segments: plan.segments.map((segment) => ({
      ...segment,
      id: `opening-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      visual: { ...segment.visual },
    })),
  };
  userProfile.opening.plans.push(copy);
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, planId: copyId, data: getSettingsData() };
}

function deleteOpeningPlan(planId) {
  const plan = getOpeningPlan(planId);
  if (!plan) return { ok: false, error: '没有找到这个开场方案。' };
  const sources = [...new Set(plan.segments.map((segment) => segment.source))];
  userProfile.opening.plans = userProfile.opening.plans.filter((item) => item.id !== planId);
  if (userProfile.opening.currentPlanId === planId) {
    userProfile.opening.currentPlanId = userProfile.opening.plans[0]?.id || null;
  }
  if (userProfile.opening.plans.length === 0) userProfile.opening.playOnStartup = false;
  saveUserProfile();
  rebuildSkillManifest();
  sources.forEach(removeUnusedOpeningSource);
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function addOpeningSegment(planId, draft) {
  const plan = getOpeningPlan(planId);
  if (!plan) return { ok: false, error: '请先选择一个开场方案。' };
  if (plan.segments.length >= 30) {
    return { ok: false, error: '每套开场方案最多包含30个片段。' };
  }
  const copied = copyOpeningPreview(draft?.token);
  if (!copied.ok) return copied;
  plan.segments.push({
    id: copied.segmentId,
    name: String(draft?.name || '开场片段').trim().slice(0, 40) || '开场片段',
    source: copied.source,
    durationMs: Math.max(0, Number(draft?.durationMs) || 0),
    enabled: draft?.enabled !== false,
    muted: draft?.muted === true,
    visual: normalizeSkillVisual(draft?.visual),
  });
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, segmentId: copied.segmentId, data: getSettingsData() };
}

function updateOpeningSegment(planId, segmentId, changes) {
  const plan = getOpeningPlan(planId);
  const segment = plan?.segments.find((item) => item.id === segmentId);
  if (!segment) return { ok: false, error: '没有找到这个开场片段。' };
  if (typeof changes?.name === 'string' && changes.name.trim()) {
    segment.name = changes.name.trim().slice(0, 40);
  }
  if (typeof changes?.enabled === 'boolean') segment.enabled = changes.enabled;
  if (typeof changes?.muted === 'boolean') segment.muted = changes.muted;
  if (changes?.visual && typeof changes.visual === 'object') {
    segment.visual = normalizeSkillVisual(changes.visual);
  }
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function replaceOpeningSegment(planId, segmentId, draft) {
  const plan = getOpeningPlan(planId);
  const segment = plan?.segments.find((item) => item.id === segmentId);
  if (!segment) return { ok: false, error: '没有找到这个开场片段。' };
  const previousSource = segment.source;
  const copied = copyOpeningPreview(draft?.token);
  if (!copied.ok) return copied;
  segment.source = copied.source;
  segment.durationMs = Math.max(0, Number(draft?.durationMs) || 0);
  if (typeof draft?.name === 'string' && draft.name.trim()) {
    segment.name = draft.name.trim().slice(0, 40);
  }
  saveUserProfile();
  rebuildSkillManifest();
  removeUnusedOpeningSource(previousSource);
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, segmentId: segment.id, data: getSettingsData() };
}

function deleteOpeningSegment(planId, segmentId) {
  const plan = getOpeningPlan(planId);
  const segment = plan?.segments.find((item) => item.id === segmentId);
  if (!segment) return { ok: false, error: '没有找到这个开场片段。' };
  plan.segments = plan.segments.filter((item) => item.id !== segmentId);
  saveUserProfile();
  rebuildSkillManifest();
  removeUnusedOpeningSource(segment.source);
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function reorderOpeningSegments(planId, segmentIds) {
  const plan = getOpeningPlan(planId);
  if (!plan || !Array.isArray(segmentIds)) return { ok: false, error: '开场排序数据无效。' };
  const byId = new Map(plan.segments.map((segment) => [segment.id, segment]));
  if (segmentIds.length !== plan.segments.length || segmentIds.some((id) => !byId.has(id))) {
    return { ok: false, error: '开场片段列表已经变化，请重试。' };
  }
  plan.segments = segmentIds.map((id) => byId.get(id));
  saveUserProfile();
  rebuildSkillManifest();
  publishConfigurationChanges({ skillsChanged: true });
  return { ok: true, data: getSettingsData() };
}

function installIpcHandlers() {
  ipcMain.handle('settings:get-data', (event) => {
    if (!isTrustedSettingsSender(event)) return null;
    return getSettingsData();
  });

  ipcMain.handle('settings:get-character', (event, roleId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return getRoleDetails(roleId);
    } catch (error) {
      console.error('[豆豆桌宠] 读取角色详情失败', error);
      return { ok: false, error: '角色详情读取失败。' };
    }
  });

  ipcMain.handle('settings:choose-character-image', async (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await chooseCharacterImage();
    } catch (error) {
      console.error('[豆豆桌宠] 选择角色主图失败', error);
      return { ok: false, error: '选择角色主图失败，请重试。' };
    }
  });

  ipcMain.handle('settings:choose-character-idle', async (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await chooseCharacterIdleMedia();
    } catch (error) {
      console.error('[豆豆桌宠] 选择角色待机动画失败', error);
      return { ok: false, error: '选择角色待机动画失败，请重试。' };
    }
  });

  ipcMain.handle('settings:create-character', (event, draft) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return createCharacter(draft);
    } catch (error) {
      console.error('[豆豆桌宠] 创建角色失败', error);
      return { ok: false, error: '角色素材复制或配置保存失败，请重试。' };
    }
  });

  ipcMain.handle('settings:update-character', (event, roleId, draft) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return updateCharacter(roleId, draft);
    } catch (error) {
      console.error('[豆豆桌宠] 编辑角色失败', error);
      return { ok: false, error: '角色修改保存失败，请重试。' };
    }
  });

  ipcMain.handle('settings:set-default-character', (event, roleId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    return setDefaultCharacter(roleId);
  });

  ipcMain.handle('settings:switch-character', async (event, roleId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await switchCharacter(roleId, 'settings');
    } catch (error) {
      console.error('[豆豆桌宠] 设置页面切换角色失败', error);
      return { ok: false, error: '角色切换失败，请重试。' };
    }
  });

  ipcMain.handle('settings:delete-character', (event, roleId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return deleteCharacter(roleId);
    } catch (error) {
      console.error('[豆豆桌宠] 删除角色失败', error);
      return { ok: false, error: '角色删除失败，请检查文件占用后重试。' };
    }
  });

  ipcMain.handle('settings:export-character-package', async (event, roleId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await exportCharacterPackage(roleId);
    } catch (error) {
      console.error('[豆豆桌宠] 导出角色包失败', error);
      return { ok: false, error: `角色包导出失败：${error?.message || '未知错误'}` };
    }
  });

  ipcMain.handle('settings:import-character-package', async (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await importCharacterPackage();
    } catch (error) {
      console.error('[豆豆桌宠] 导入角色包失败', error);
      return { ok: false, error: `角色包导入失败：${error?.message || '未知错误'}` };
    }
  });

  ipcMain.handle('settings:choose-skill-media', async (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return await chooseSkillMedia();
    } catch (error) {
      console.error('[豆豆桌宠] 选择技能素材失败', error);
      return { ok: false, error: '选择素材失败，请重试。' };
    }
  });

  ipcMain.on('settings:discard-preview', (event, token) => {
    if (isTrustedSettingsSender(event) && typeof token === 'string') previewFiles.delete(token);
  });

  ipcMain.handle('settings:import-skill', (event, draft) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return importSkill(draft);
    } catch (error) {
      console.error('[豆豆桌宠] 导入技能失败', error);
      return { ok: false, error: '复制或保存素材失败，请检查文件。' };
    }
  });

  ipcMain.handle('settings:update-skill', (event, skillId, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return updateSkill(skillId, changes);
    } catch (error) {
      console.error('[豆豆桌宠] 修改技能失败', error);
      return { ok: false, error: '技能修改失败。' };
    }
  });

  ipcMain.handle('settings:get-skill-usage', (event, skillId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    return { ok: true, affected: getSkillUsage(skillId) };
  });

  ipcMain.handle('settings:delete-skill', (event, skillId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return deleteSkill(skillId);
    } catch (error) {
      console.error('[豆豆桌宠] 删除技能失败', error);
      return { ok: false, error: '技能删除失败。' };
    }
  });

  ipcMain.handle('settings:restore-builtin-skills', (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return restoreBuiltinSkills();
    } catch (error) {
      console.error('[豆豆桌宠] 恢复内置技能失败', error);
      return { ok: false, error: '恢复内置技能失败。' };
    }
  });

  ipcMain.handle('settings:set-scale', (event, scale) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      applyPetScale(scale, { persist: true });
      publishConfigurationChanges({ skillsChanged: false, appearanceChanged: true });
      return { ok: true, appearance: getSettingsData().appearance };
    } catch (error) {
      console.error('[豆豆桌宠] 调整角色大小失败', error);
      return { ok: false, error: '角色大小调整失败。' };
    }
  });

  ipcMain.handle('settings:set-startup-state', (event, value) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return updateStartupState(value);
    } catch (error) {
      console.error('[豆豆桌宠] 修改启动状态失败', error);
      return { ok: false, error: '启动状态保存失败。' };
    }
  });

  ipcMain.handle('settings:update-auto-sleep-rule', (event, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return updateAutoSleepRule(changes);
    } catch (error) {
      console.error('[豆豆桌宠] 修改自动睡眠规则失败', error);
      return { ok: false, error: '自动睡眠规则保存失败。' };
    }
  });

  ipcMain.handle('settings:test-inactivity-flow', (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    const rule = normalizeAutoSleepRule(
      userProfile.fixedRules?.autoSleep,
      getRoleBehaviorDefaults(activeRoleId),
    );
    if (!rule.sleepLoopSkillId) {
      return { ok: false, error: '请先选择循环状态动画。' };
    }
    if (!isUsableWindow() || !mainWindow.isVisible() || mainWindow.isMinimized() || isClosedToTray) {
      return { ok: false, error: '请先让角色显示在桌面上，再测试完整流程。' };
    }
    sendToPet('pet:test-inactivity-flow', { requestedAt: Date.now() });
    return { ok: true };
  });

  ipcMain.handle('settings:update-random-behavior', (event, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return updateRandomBehaviorRule(changes);
    } catch (error) {
      console.error('[豆豆桌宠] 修改随机行为失败', error);
      return { ok: false, error: '随机行为保存失败。' };
    }
  });

  ipcMain.handle('settings:delete-random-behavior', (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return deleteRandomBehaviorRule();
    } catch (error) {
      console.error('[豆豆桌宠] 删除随机行为规则失败', error);
      return { ok: false, error: '随机行为规则删除失败。' };
    }
  });

  ipcMain.handle('settings:restore-random-behavior', (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try {
      return restoreRandomBehaviorRule();
    } catch (error) {
      console.error('[豆豆桌宠] 恢复随机行为规则失败', error);
      return { ok: false, error: '随机行为规则恢复失败。' };
    }
  });

  ipcMain.handle('settings:choose-opening-media', async (event) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return await chooseOpeningMedia(); } catch (error) {
      console.error('[豆豆桌宠] 选择开场素材失败', error);
      return { ok: false, error: '选择开场素材失败，请重试。' };
    }
  });

  ipcMain.handle('settings:create-opening-plan', (event, name) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return createOpeningPlan(name); } catch (error) {
      console.error('[豆豆桌宠] 创建开场方案失败', error);
      return { ok: false, error: '开场方案创建失败。' };
    }
  });

  ipcMain.handle('settings:update-opening-settings', (event, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return updateOpeningSettings(changes); } catch (error) {
      console.error('[豆豆桌宠] 修改开场设置失败', error);
      return { ok: false, error: '开场设置保存失败。' };
    }
  });

  ipcMain.handle('settings:update-opening-plan', (event, planId, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return updateOpeningPlan(planId, changes); } catch (error) {
      console.error('[豆豆桌宠] 修改开场方案失败', error);
      return { ok: false, error: '开场方案修改失败。' };
    }
  });

  ipcMain.handle('settings:duplicate-opening-plan', (event, planId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return duplicateOpeningPlan(planId); } catch (error) {
      console.error('[豆豆桌宠] 复制开场方案失败', error);
      return { ok: false, error: '开场方案复制失败。' };
    }
  });

  ipcMain.handle('settings:delete-opening-plan', (event, planId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return deleteOpeningPlan(planId); } catch (error) {
      console.error('[豆豆桌宠] 删除开场方案失败', error);
      return { ok: false, error: '开场方案删除失败。' };
    }
  });

  ipcMain.handle('settings:add-opening-segment', (event, planId, draft) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return addOpeningSegment(planId, draft); } catch (error) {
      console.error('[豆豆桌宠] 添加开场片段失败', error);
      return { ok: false, error: '开场片段添加失败。' };
    }
  });

  ipcMain.handle('settings:update-opening-segment', (event, planId, segmentId, changes) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return updateOpeningSegment(planId, segmentId, changes); } catch (error) {
      console.error('[豆豆桌宠] 修改开场片段失败', error);
      return { ok: false, error: '开场片段修改失败。' };
    }
  });

  ipcMain.handle('settings:replace-opening-segment', (event, planId, segmentId, draft) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return replaceOpeningSegment(planId, segmentId, draft); } catch (error) {
      console.error('[豆豆桌宠] 替换开场片段失败', error);
      return { ok: false, error: '开场片段替换失败。' };
    }
  });

  ipcMain.handle('settings:delete-opening-segment', (event, planId, segmentId) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return deleteOpeningSegment(planId, segmentId); } catch (error) {
      console.error('[豆豆桌宠] 删除开场片段失败', error);
      return { ok: false, error: '开场片段删除失败。' };
    }
  });

  ipcMain.handle('settings:reorder-opening-segments', (event, planId, segmentIds) => {
    if (!isTrustedSettingsSender(event)) return { ok: false, error: '设置窗口无效。' };
    try { return reorderOpeningSegments(planId, segmentIds); } catch (error) {
      console.error('[豆豆桌宠] 调整开场顺序失败', error);
      return { ok: false, error: '开场顺序保存失败。' };
    }
  });

  ipcMain.handle('skills:get-manifest', (event) => {
    if (!isTrustedSender(event)) return null;
    return skillManifest;
  });

  ipcMain.handle('appearance:get', (event) => {
    if (!isTrustedSender(event)) return { scale: 1, startupState: 'static' };
    return getSettingsData().appearance;
  });

  ipcMain.on('animation:state', (event, state) => {
    if (!isTrustedSender(event) || !state || typeof state.mode !== 'string') return;
    const previousSwitchState = getCharacterSwitchState();
    if (!isCharacterSwitching) currentAnimationMode = state.mode.slice(0, 40);
    animationStateHistory.push({
      at: new Date().toISOString(),
      mode: state.mode.slice(0, 40),
      skillId: typeof state.skillId === 'string' ? state.skillId.slice(0, 80) : null,
    });
    if (animationStateHistory.length > 120) animationStateHistory.shift();
    if (!isSceneMode) {
      if (['opening', 'transparent', 'sleep-enter', 'sleep-loop', 'waking'].includes(state.mode)) {
        applyPetCanvasWindowShape();
      }
      else applyNormalWindowShape();
    }
    const nextSwitchState = getCharacterSwitchState();
    if (
      previousSwitchState.allowed !== nextSwitchState.allowed ||
      previousSwitchState.busy !== nextSwitchState.busy ||
      previousSwitchState.label !== nextSwitchState.label
    ) {
      publishCharacterSwitchState();
    }
  });

  ipcMain.on('character:switch-result', (event, result) => {
    if (!isTrustedSender(event) || !result || typeof result.switchId !== 'number') return;
    if (pendingCharacterSwitch?.switchId !== result.switchId) return;
    pendingCharacterSwitch.resolve({
      ok: result.ok === true,
      error: typeof result.error === 'string' ? result.error.slice(0, 200) : null,
    });
  });

  ipcMain.on('menu:show', (event) => {
    if (isTrustedSender(event)) showPetMenu();
  });

  ipcMain.on('lifecycle:request', (event, action) => {
    if (!isTrustedSender(event)) return;
    if (!['hide', 'close-to-tray', 'home-exit'].includes(action)) return;
    requestAnimatedLifecycle(action);
  });

  ipcMain.on('window:set-mouse-passthrough', (event, enabled) => {
    if (!isTrustedSender(event)) return;
    // In normal desktop mode the native window shape owns hit testing.
    // Never let a focus/mousemove race turn the whole pet click-through.
    if (enabled && normalWindowUsesNativeShape()) {
      setMousePassthrough(false, { force: true });
      return;
    }
    setMousePassthrough(enabled);
  });

  ipcMain.on('window:pointer-probe-result', (event, result) => {
    if (!isTrustedSender(event) || !result || typeof result !== 'object') return;
    lastPointerProbeResult = {
      x: Number(result.x),
      y: Number(result.y),
      interactive: Boolean(result.interactive),
      mode: typeof result.mode === 'string' ? result.mode.slice(0, 40) : null,
    };
  });

  ipcMain.on('window:set-pet-visual-bounds', (event, bounds) => {
    if (!isTrustedSender(event) || isSceneMode || dragSession || !validVisualBounds(bounds)) return;
    petVisualBounds = {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
    };
    if (centerRoleAfterVisualBounds) {
      centerRoleAfterVisualBounds = false;
      petCanvasBounds = getInitialBounds();
      publishPetCanvasPosition();
    }
    applyNormalWindowShape();
  });

  ipcMain.handle('window:enter-scene', (event) => {
    if (!isTrustedSender(event)) return false;
    return enterSceneWindow();
  });

  ipcMain.handle('window:exit-scene', (event) => {
    if (!isTrustedSender(event)) return false;
    resetSceneWindow();
    return true;
  });

  ipcMain.on('window:drag-start', (event) => {
    if (!isTrustedSender(event) || !isUsableWindow() || isSceneMode) return;
    stopDragPolling();
    cancelDragShapeRestore();
    const point = screen.getCursorScreenPoint();
    const bounds = { ...petCanvasBounds };
    dragSession = {
      anchorPointerX: point.x,
      anchorPointerY: point.y,
      anchorWindowX: bounds.x,
      anchorWindowY: bounds.y,
      appliedX: bounds.x,
      appliedY: bounds.y,
    };
    dragOverlayActivationCount += 1;
    // The primary-display BrowserWindow has already been fixed in place since
    // startup. Starting a drag changes only the native hit region and the pet
    // canvas coordinates; there is no resize/reposition frame to flash.
    applyFullWindowShape();
    publishPetCanvasPosition({ dragging: true });
    startDragPolling();
  });

  ipcMain.on('window:drag-move', (event) => {
    if (!isTrustedSender(event) || !isUsableWindow() || !dragSession) return;
    // Renderer pointer events are only a low-latency wake-up. Coordinates are
    // always sampled globally in the main process, and the 16 ms poll keeps the
    // drag independent from pointer events generated by the moving window.
    updateDraggedWindowFromCursor();
  });

  ipcMain.on('window:drag-end', (event) => {
    if (!isTrustedSender(event)) return;
    finishWindowDrag();
  });
}

function getQaOutputDirectory() {
  if (app.isPackaged) {
    return path.join(app.getPath('temp'), 'doudou-pet-prototype-qa');
  }
  return path.join(__dirname, 'qa-prototype-current');
}

async function captureQaFrame(name) {
  if (!isUsableWindow()) return null;
  const outputDirectory = getQaOutputDirectory();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const image = await mainWindow.webContents.capturePage();
  const outputPath = path.join(outputDirectory, name);
  fs.writeFileSync(outputPath, image.toPNG());
  return outputPath;
}

async function inspectCapturedAlphaBounds() {
  if (!isUsableWindow()) return null;
  const image = await mainWindow.webContents.capturePage();
  const size = image.getSize({ scaleFactor: 1 });
  const bitmap = image.toBitmap({ scaleFactor: 1 });
  let left = size.width;
  let top = size.height;
  let right = -1;
  let bottom = -1;
  let opaquePixels = 0;
  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      const alpha = bitmap[(y * size.width + x) * 4 + 3];
      if (alpha < 8) continue;
      opaquePixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    return { imageSize: size, opaquePixels: 0, bounds: null };
  }
  return {
    imageSize: size,
    opaquePixels,
    bounds: {
      left,
      top,
      right: right + 1,
      bottom: bottom + 1,
      width: right - left + 1,
      height: bottom - top + 1,
    },
  };
}

async function inspectRendererStageBounds() {
  if (!isUsableWindow()) return null;
  return mainWindow.webContents.executeJavaScript(`(() => {
    const stage = document.querySelector('#pet-stage').getBoundingClientRect();
    const character = document.querySelector('#pet-character').getBoundingClientRect();
    return {
      stage: { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom,
        width: stage.width, height: stage.height },
      character: { left: character.left, top: character.top, right: character.right,
        bottom: character.bottom, width: character.width, height: character.height },
    };
  })()`, true);
}

async function captureSettingsQaFrame(name) {
  if (!settingsWindow || settingsWindow.isDestroyed()) return null;
  await settingsWindow.webContents.executeJavaScript(
    "document.fonts.ready.then(() => document.readyState)",
    true,
  );
  await wait(120);
  const outputDirectory = getQaOutputDirectory();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const image = await settingsWindow.webContents.capturePage();
  const outputPath = path.join(outputDirectory, name);
  fs.writeFileSync(outputPath, image.toPNG());
  return outputPath;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getQaWindowState(label) {
  return {
    label,
    visible: Boolean(isUsableWindow() && mainWindow.isVisible()),
    minimized: Boolean(isUsableWindow() && mainWindow.isMinimized()),
    closedToTray: isClosedToTray,
    sceneMode: isSceneMode,
    bounds: isUsableWindow() ? mainWindow.getBounds() : null,
  };
}

async function runPrototypeQa() {
  const outputDirectory = getQaOutputDirectory();
  fs.mkdirSync(outputDirectory, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    frames: [],
    lifecycle: [],
    geometry: {},
    skillManifest,
    animationHistory: [],
    settings: {},
    sleep: {},
    randomBehavior: {},
    opening: {},
  };
  animationStateHistory = [];

  await wait(700);
  const initialBounds = mainWindow.getBounds();
  const initialPetCanvasBounds = { ...petCanvasBounds };
  const initialWorkArea = getPrimaryWorkArea();
  report.geometry.initial = {
    windowBounds: initialBounds,
    petCanvasBounds: initialPetCanvasBounds,
    petVisualBounds,
    petVisualCenter: getPetVisualCenter(initialPetCanvasBounds),
    workArea: initialWorkArea,
  };

  const bodyPoint = {
    x: petCanvasBounds.x - initialWorkArea.x +
      (petVisualBounds.left + petVisualBounds.right) / 2,
    y: petCanvasBounds.y - initialWorkArea.y +
      (petVisualBounds.top + petVisualBounds.bottom) / 2,
  };
  const shapeContains = (point) => currentWindowShape.some((rect) => (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  ));
  report.inputRecovery = {
    nativeWindowShape: currentWindowShape,
    bodyPoint,
    bodyIsInteractive: shapeContains(bodyPoint),
    transparentCornerPassesThrough: !shapeContains({ x: 2, y: 2 }),
  };

  const alphaBeforeDragActivation = await inspectCapturedAlphaBounds();
  const shapeBeforeDragActivation = currentWindowShape.map((rect) => ({ ...rect }));
  applyFullWindowShape();
  publishPetCanvasPosition({ dragging: true });
  await wait(120);
  const alphaAfterDragActivation = await inspectCapturedAlphaBounds();
  publishPetCanvasPosition({ dragging: false });
  applyNormalWindowShape();
  await wait(80);
  report.geometry.dragStartVisualStability = {
    shapeBefore: shapeBeforeDragActivation,
    alphaBefore: alphaBeforeDragActivation,
    alphaAfter: alphaAfterDragActivation,
  };

  const activationsBeforeDoubleClick = dragOverlayActivationCount;
  const boundsBeforeDoubleClick = mainWindow.getBounds();
  const clickPoint = {
    x: Math.round(bodyPoint.x),
    y: Math.round(bodyPoint.y),
  };
  mainWindow.webContents.sendInputEvent({
    type: 'mouseDown', ...clickPoint, button: 'left', clickCount: 1,
  });
  mainWindow.webContents.sendInputEvent({
    type: 'mouseUp', ...clickPoint, button: 'left', clickCount: 1,
  });
  mainWindow.webContents.sendInputEvent({
    type: 'mouseDown', ...clickPoint, button: 'left', clickCount: 2,
  });
  mainWindow.webContents.sendInputEvent({
    type: 'mouseUp', ...clickPoint, button: 'left', clickCount: 2,
  });
  await wait(180);
  report.geometry.doubleClick = {
    activationsBefore: activationsBeforeDoubleClick,
    activationsAfter: dragOverlayActivationCount,
    boundsBefore: boundsBeforeDoubleClick,
    boundsAfter: mainWindow.getBounds(),
  };

  showSettings();
  await wait(850);
  report.settings.window = {
    visible: Boolean(settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()),
    bounds: settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow.getBounds() : null,
    frame: await captureSettingsQaFrame('00-settings.png'),
  };
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"roles\"]')?.click()",
    true,
  );
  await wait(160);
  report.settings.rolesFrame = await captureSettingsQaFrame('00-settings-roles.png');
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"appearance\"]')?.click()",
    true,
  );
  await wait(160);
  report.settings.appearanceFrame = await captureSettingsQaFrame('00-settings-appearance.png');
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"rules\"]')?.click()",
    true,
  );
  await wait(160);
  report.settings.fixedRulesFrame = await captureSettingsQaFrame('00-settings-fixed-rules.png');
  const ruleBeforeQa = { ...userProfile.fixedRules.autoSleep };
  const ruleUpdated = updateAutoSleepRule({
    ...ruleBeforeQa,
    enabled: true,
    inactivitySeconds: 60,
    wakeOnPointer: true,
  });
  const savedRuleAfterUpdate = JSON.parse(fs.readFileSync(getProfilePath(), 'utf8'))
    .fixedRules?.autoSleep;
  report.settings.fixedRules = {
    updated: ruleUpdated.ok,
    manifestDelayMs: skillManifest.behavior.inactivitySleepMs,
    profile: savedRuleAfterUpdate,
  };
  updateAutoSleepRule(ruleBeforeQa);
  const randomBehaviorBeforeQa = userProfile.randomBehaviorDeleted
    ? null
    : { ...userProfile.randomBehavior, skillIds: [...(userProfile.randomBehavior?.skillIds || [])] };
  const randomRuleUpdated = updateRandomBehaviorRule({
    enabled: true,
    intervalMinutes: 20,
    skillIds: ['spin'],
  });
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"random\"]')?.click()",
    true,
  );
  await wait(180);
  report.settings.randomBehaviorFrame = await captureSettingsQaFrame('00-settings-random-behavior.png');
  const savedRandomRule = JSON.parse(fs.readFileSync(getProfilePath(), 'utf8')).randomBehavior;
  const randomRuleDeleted = deleteRandomBehaviorRule();
  const randomRuleRestored = restoreRandomBehaviorRule();
  updateRandomBehaviorRule({ enabled: true, intervalMinutes: 20, skillIds: ['spin'] });
  report.settings.randomBehavior = {
    updated: randomRuleUpdated.ok,
    saved: savedRandomRule,
    deleted: randomRuleDeleted.ok && randomRuleDeleted.data.randomBehavior === null,
    restored: randomRuleRestored.ok && randomRuleRestored.data.randomBehavior !== null,
    manifest: skillManifest.behavior.randomBehavior,
  };
  const openingBeforeQa = JSON.parse(JSON.stringify(userProfile.opening));
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"opening\"]')?.click(); document.querySelector('#create-opening-plan')?.click()",
    true,
  );
  await wait(120);
  report.settings.openingDialogFrame = await captureSettingsQaFrame('00-settings-opening-dialog.png');
  const openingDialogOpened = await settingsWindow.webContents.executeJavaScript(
    "Boolean(document.querySelector('#text-prompt-dialog')?.open)",
    true,
  );
  const openingDialogSubmitted = await settingsWindow.webContents.executeJavaScript(
    `(() => {
      const input = document.querySelector('#text-prompt-input');
      const form = document.querySelector('#text-prompt-form');
      if (!input || !form) return false;
      input.value = 'QA开场方案';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      return true;
    })()`,
    true,
  );
  await wait(260);
  const uiOpeningPlan = userProfile.opening.plans.find((plan) => plan.name === 'QA开场方案');
  const openingPlanCreated = {
    ok: Boolean(openingDialogOpened && openingDialogSubmitted && uiOpeningPlan),
    planId: uiOpeningPlan?.id || null,
  };
  const qaOpeningSources = [];
  let qaOpeningPlanId = openingPlanCreated.planId || null;
  let firstOpeningSegmentId = null;
  let secondOpeningSegmentId = null;
  if (openingPlanCreated.ok && qaOpeningPlanId) {
    const firstToken = `qa-opening-${crypto.randomUUID()}`;
    previewFiles.set(firstToken, path.join(__dirname, 'assets', 'media', 'doudou-spin.webm'));
    const firstSegment = addOpeningSegment(qaOpeningPlanId, {
      token: firstToken,
      name: '转圈开场片段',
      durationMs: 5066,
      enabled: true,
      muted: true,
      visual: { scale: 1.05, offsetX: 0, offsetY: 0 },
    });
    firstOpeningSegmentId = firstSegment.ok
      ? getOpeningPlan(qaOpeningPlanId)?.segments.at(-1)?.id || null
      : null;
    const secondToken = `qa-opening-${crypto.randomUUID()}`;
    previewFiles.set(secondToken, path.join(__dirname, 'assets', 'media', 'doudou-idle.webm'));
    const secondSegment = addOpeningSegment(qaOpeningPlanId, {
      token: secondToken,
      name: '标准待机片段',
      durationMs: 5000,
      enabled: true,
      muted: true,
      visual: { scale: 1, offsetX: 0, offsetY: 0 },
    });
    secondOpeningSegmentId = secondSegment.ok
      ? getOpeningPlan(qaOpeningPlanId)?.segments.at(-1)?.id || null
      : null;
    const plan = getOpeningPlan(qaOpeningPlanId);
    qaOpeningSources.push(...(plan?.segments || []).map((segment) => segment.source));
    if (firstOpeningSegmentId && secondOpeningSegmentId) {
      reorderOpeningSegments(qaOpeningPlanId, [secondOpeningSegmentId, firstOpeningSegmentId]);
    }
    updateOpeningSettings({ currentPlanId: qaOpeningPlanId, playOnStartup: true });
  }
  const duplicatedOpeningPlan = qaOpeningPlanId
    ? duplicateOpeningPlan(qaOpeningPlanId)
    : { ok: false };
  const deletedOpeningCopy = duplicatedOpeningPlan.ok
    ? deleteOpeningPlan(duplicatedOpeningPlan.planId)
    : { ok: false };
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"opening\"]')?.click()",
    true,
  );
  await wait(220);
  report.settings.openingFrame = await captureSettingsQaFrame('00-settings-opening.png');
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#preview-opening-plan')?.click()",
    true,
  );
  await wait(320);
  const openingPreviewControls = await settingsWindow.webContents.executeJavaScript(
    `(() => ({
      seekEnabled: document.querySelector('#opening-preview-seek')?.disabled === false,
      pauseEnabled: document.querySelector('#toggle-opening-preview')?.disabled === false,
      stopEnabled: document.querySelector('#stop-opening-preview')?.disabled === false,
      time: document.querySelector('#opening-preview-time')?.textContent || '',
    }))()`,
    true,
  );
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#toggle-opening-preview')?.click(); document.querySelector('#stop-opening-preview')?.click(); document.querySelector('#opening-segment-list [data-action=\"edit\"]')?.click()",
    true,
  );
  await wait(420);
  const openingEditorControls = await settingsWindow.webContents.executeJavaScript(
    `(() => {
      const seek = document.querySelector('#opening-edit-seek');
      const scale = document.querySelector('#opening-scale');
      const offsetX = document.querySelector('#opening-offset-x');
      const offsetY = document.querySelector('#opening-offset-y');
      document.querySelector('#toggle-opening-edit-preview')?.click();
      scale.value = '180';
      scale.dispatchEvent(new Event('input', { bubbles: true }));
      const stageRect = document.querySelector('#opening-calibration-stage')?.getBoundingClientRect();
      const videoRect = document.querySelector('#opening-edit-preview')?.getBoundingClientRect();
      const maxScaleContained = Boolean(
        stageRect &&
        videoRect &&
        videoRect.left >= stageRect.left - 1 &&
        videoRect.top >= stageRect.top - 1 &&
        videoRect.right <= stageRect.right + 1 &&
        videoRect.bottom <= stageRect.bottom + 1
      );
      scale.value = '112';
      offsetX.value = '7';
      offsetY.value = '-5';
      for (const input of [scale, offsetX, offsetY]) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (seek && !seek.disabled) {
        seek.value = String(Math.min(Number(seek.max) || 1, 600));
        seek.dispatchEvent(new Event('input', { bubbles: true }));
        seek.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return {
        dialogOpen: document.querySelector('#opening-segment-dialog')?.open === true,
        seekEnabled: seek?.disabled === false,
        pauseEnabled: document.querySelector('#toggle-opening-edit-preview')?.disabled === false,
        scale: scale?.value,
        offsetX: offsetX?.value,
        offsetY: offsetY?.value,
        maxScaleContained,
      };
    })()`,
    true,
  );
  report.settings.openingEditorFrame = await captureSettingsQaFrame('00-settings-opening-editor.png');
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#opening-segment-form')?.requestSubmit(document.querySelector('#save-opening-segment'))",
    true,
  );
  await wait(320);
  const calibratedOpeningSegment = getOpeningPlan(qaOpeningPlanId)?.segments[0] || null;
  report.settings.opening = {
    created: openingPlanCreated.ok,
    dialogOpened: openingDialogOpened,
    dialogSubmitted: openingDialogSubmitted,
    createdThroughUi: Boolean(uiOpeningPlan),
    planId: qaOpeningPlanId,
    segmentCount: getOpeningPlan(qaOpeningPlanId)?.segments.length || 0,
    reordered: getOpeningPlan(qaOpeningPlanId)?.segments[0]?.id === secondOpeningSegmentId,
    duplicated: duplicatedOpeningPlan.ok,
    duplicateDeleted: deletedOpeningCopy.ok,
    currentPlanId: skillManifest.opening?.currentPlanId || null,
    playOnStartup: skillManifest.opening?.playOnStartup === true,
    previewControls: openingPreviewControls,
    editorControls: openingEditorControls,
    calibratedVisual: calibratedOpeningSegment?.visual || null,
  };
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-panel=\"skills\"]')?.click()",
    true,
  );
  await wait(100);
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('[data-action=\"preview\"]')?.click()",
    true,
  );
  await wait(280);
  report.settings.skillDialogFrame = await captureSettingsQaFrame('00-settings-skill-dialog.png');
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#skill-dialog')?.close()",
    true,
  );
  const initialScale = petScale;
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#scale-slider').value='80'; document.querySelector('#scale-slider').dispatchEvent(new Event('input', { bubbles: true }))",
    true,
  );
  await wait(220);
  report.settings.scale80 = { scale: petScale, bounds: mainWindow.getBounds() };
  await settingsWindow.webContents.executeJavaScript(
    "document.querySelector('#scale-slider').value='120'; document.querySelector('#scale-slider').dispatchEvent(new Event('input', { bubbles: true }))",
    true,
  );
  await wait(220);
  report.settings.scale120 = { scale: petScale, bounds: mainWindow.getBounds() };
  await settingsWindow.webContents.executeJavaScript(
    `document.querySelector('#scale-slider').value='${Math.round(initialScale * 100)}'; document.querySelector('#scale-slider').dispatchEvent(new Event('input', { bubbles: true }))`,
    true,
  );
  await wait(260);
  report.settings.scaleRestored = { scale: petScale, bounds: mainWindow.getBounds() };
  const startupStateBeforeQa = normalizeStartupState(userProfile.appearance?.startupState);
  const animatedStartupResult = updateStartupState('standard-idle');
  await wait(600);
  const animatedStartupState = await mainWindow.webContents.executeJavaScript(
    `(() => {
      const character = document.querySelector('#pet-character');
      const video = document.querySelector('#idle-video');
      return {
        animated: character?.classList.contains('is-idle-animated') === true,
        paused: video?.paused,
        source: video?.getAttribute('src') || '',
      };
    })()`,
    true,
  );
  const restoredStartupResult = updateStartupState(startupStateBeforeQa);
  await wait(260);
  const restoredStartupState = await mainWindow.webContents.executeJavaScript(
    `(() => ({
      animated: document.querySelector('#pet-character')?.classList.contains('is-idle-animated') === true,
      paused: document.querySelector('#idle-video')?.paused,
    }))()`,
    true,
  );
  report.settings.startupState = {
    animatedUpdateSaved: animatedStartupResult.ok,
    animated: animatedStartupState,
    restoredUpdateSaved: restoredStartupResult.ok,
    restoredValue: normalizeStartupState(userProfile.appearance?.startupState),
    restored: restoredStartupState,
  };
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide();

  const openingHistoryStart = animationStateHistory.length;
  await mainWindow.webContents.executeJavaScript(
    "document.querySelectorAll('video').forEach((video) => { video.defaultPlaybackRate = 6; video.playbackRate = 6; }); document.dispatchEvent(new Event('pet-qa-play-opening'))",
    true,
  );
  await wait(180);
  report.opening.shapeDuringPlayback = currentWindowShape.map((rect) => ({ ...rect }));
  report.opening.usesFullPetCanvas = currentWindowShape.some(
    (rect) => rect.width >= petWindowSize && rect.height >= petWindowSize,
  );
  await wait(360);
  report.frames.push(await captureQaFrame('00b-opening.png'));
  await wait(3000);
  report.opening.history = animationStateHistory.slice(openingHistoryStart);
  report.opening.finalMode = animationStateHistory.at(-1)?.mode || null;
  report.opening.returnedToConfiguredIdle = report.opening.finalMode === 'idle';
  userProfile.opening = normalizeOpeningConfig(openingBeforeQa);
  saveUserProfile();
  rebuildSkillManifest();
  qaOpeningSources.forEach(removeUnusedOpeningSource);
  publishConfigurationChanges({ skillsChanged: true });

  const importToken = `qa-${crypto.randomUUID()}`;
  previewFiles.set(importToken, path.join(__dirname, 'assets', 'media', 'doudou-spin.webm'));
  const imported = importSkill({
    token: importToken,
    name: 'QA导入技能',
    category: 'daily',
    type: 'transparent',
    pinned: false,
    muted: true,
    durationMs: 5066,
    visual: { scale: 0.73, offsetX: 12, offsetY: -9 },
  });
  const importedSkill = imported.ok
    ? skillManifest.skills.find((skill) => skill.name === 'QA导入技能')
    : null;
  const updated = importedSkill
    ? updateSkill(importedSkill.id, { name: 'QA已改名', category: 'interaction', pinned: true })
    : { ok: false };
  const deleted = importedSkill ? deleteSkill(importedSkill.id) : { ok: false };
  report.settings.skillManagement = {
    imported: imported.ok,
    importedSkillId: importedSkill?.id || null,
    importedVisual: importedSkill?.visual || null,
    updated: updated.ok,
    deleted: deleted.ok,
    finalSkillCount: skillManifest.skills.length,
  };

  const qaSceneSource = process.env.DOUDOU_QA_SCENE_MEDIA &&
    fs.existsSync(process.env.DOUDOU_QA_SCENE_MEDIA)
    ? path.resolve(process.env.DOUDOU_QA_SCENE_MEDIA)
    : path.join(__dirname, 'assets', 'media', 'doudou-grass.mp4');
  const sceneImportToken = `qa-scene-${crypto.randomUUID()}`;
  previewFiles.set(sceneImportToken, qaSceneSource);
  const sceneImported = importSkill({
    token: sceneImportToken,
    name: 'QA场景导入',
    category: 'scene',
    type: 'scene',
    pinned: false,
    muted: true,
    durationMs: 6042,
    visual: { scale: 1, offsetX: 0, offsetY: 0 },
  });
  const importedSceneSkill = sceneImported.ok
    ? skillManifest.skills.find((skill) => skill.name === 'QA场景导入')
    : null;
  const importedScenePath = importedSceneSkill
    ? resolveUserMediaSource(importedSceneSkill.source)
    : null;
  const copiedSceneMediaExists = Boolean(
    importedScenePath && fs.existsSync(importedScenePath),
  );
  const savedSceneProfile = JSON.parse(fs.readFileSync(getProfilePath(), 'utf8'));
  const sceneDeleted = importedSceneSkill
    ? deleteSkill(importedSceneSkill.id)
    : { ok: false };
  report.settings.sceneSkillImport = {
    imported: sceneImported.ok,
    sourceName: path.basename(qaSceneSource),
    importedSkillId: importedSceneSkill?.id || null,
    copiedMediaExists: copiedSceneMediaExists,
    savedToProfile: Boolean(
      importedSceneSkill &&
      savedSceneProfile.userSkills?.some((skill) => skill.id === importedSceneSkill.id),
    ),
    deleted: sceneDeleted.ok,
  };

  const builtinDeleted = deleteSkill('grass');
  const skillCountAfterBuiltinDelete = skillManifest.skills.length;
  const builtinRestored = restoreBuiltinSkills();
  report.settings.builtinRestore = {
    deleted: builtinDeleted.ok,
    skillCountAfterDelete: skillCountAfterBuiltinDelete,
    restored: builtinRestored.ok,
    finalSkillCount: skillManifest.skills.length,
  };
  const characterImageToken = crypto.randomUUID();
  const characterIdleToken = crypto.randomUUID();
  previewFiles.set(characterImageToken, path.join(__dirname, 'assets', 'dog.png'));
  previewFiles.set(characterIdleToken, path.join(__dirname, 'assets', 'media', 'doudou-idle.webm'));
  const characterCreated = createCharacter({
    name: 'QA小白',
    category: 'pet',
    scale: 0.92,
    idleMode: 'animated',
    imageToken: characterImageToken,
    idleToken: characterIdleToken,
  });
  const qaRoleId = characterCreated.roleId;
  const characterDetails = qaRoleId ? getRoleDetails(qaRoleId) : null;
  const characterEdited = qaRoleId
    ? updateCharacter(qaRoleId, {
        name: 'QA小白编辑版',
        category: 'other',
        scale: 1.08,
        idleMode: 'animated',
      })
    : { ok: false };
  await wait(500);
  const switchedToQaRole = qaRoleId
    ? await switchCharacter(qaRoleId, 'qa')
    : { ok: false };
  await wait(260);
  const qaRoleRendererState = await mainWindow.webContents.executeJavaScript(
    `(() => ({
      roleName: document.querySelector('#pet-character')?.getAttribute('aria-label') || '',
      image: document.querySelector('#idle-image')?.getAttribute('src') || '',
      idleSource: document.querySelector('#idle-video')?.getAttribute('src') || '',
      mode: document.querySelector('#pet-character')?.dataset.animationState || '',
    }))()`,
    true,
  );
  const switchedBackToDoudou = switchedToQaRole.ok
    ? await switchCharacter('doudou', 'qa')
    : { ok: false };
  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  for (let attempt = 0; attempt < 30 && currentAnimationMode !== 'sleep-loop'; attempt += 1) {
    await wait(100);
  }
  const sleepLoopWasReady = currentAnimationMode === 'sleep-loop';
  const switchedFromSleepLoop = sleepLoopWasReady
    ? await switchCharacter(qaRoleId, 'qa')
    : { ok: false, error: `睡眠循环没有按时开始：${currentAnimationMode}` };
  const switchedBackAfterSleepLoop = switchedFromSleepLoop.ok
    ? await switchCharacter('doudou', 'qa')
    : { ok: false };
  const qaPackagePath = path.join(outputDirectory, 'qa-character-roundtrip.doudoupet');
  let qaPackageRoundTrip = {
    exported: false,
    verified: false,
    imported: false,
    switched: false,
    deleted: false,
    error: null,
  };
  try {
    const portableQaRole = createPortableRoleProfile(qaRoleId);
    writeCharacterPackage({
      outputPath: qaPackagePath,
      appVersion: app.getVersion(),
      role: portableQaRole.role,
      profile: portableQaRole.profile,
      mediaFiles: portableQaRole.mediaFiles,
    });
    qaPackageRoundTrip.exported = fs.existsSync(qaPackagePath);
    const verifiedPackage = readCharacterPackage(qaPackagePath);
    qaPackageRoundTrip.verified =
      verifiedPackage.manifest.role.originalId === qaRoleId &&
      verifiedPackage.mediaFiles.length >= 2;
    const importedCopy = installImportedCharacterPackage(
      verifiedPackage,
      'new',
      characterIndex.roles.find((role) => role.id === qaRoleId),
    );
    qaPackageRoundTrip.imported = Boolean(importedCopy.roleId);
    const switchedToImportedCopy = await switchCharacter(importedCopy.roleId, 'qa-package');
    qaPackageRoundTrip.switched = switchedToImportedCopy.ok;
    if (switchedToImportedCopy.ok) await switchCharacter('doudou', 'qa-package');
    qaPackageRoundTrip.deleted = deleteCharacter(importedCopy.roleId).ok;
    const replacedRole = installImportedCharacterPackage(
      verifiedPackage,
      'replace',
      characterIndex.roles.find((role) => role.id === qaRoleId),
    );
    qaPackageRoundTrip.replaced = replacedRole.replaced === true;
    const switchedToReplacedRole = await switchCharacter(qaRoleId, 'qa-package-replace');
    qaPackageRoundTrip.replacedRoleLoaded = switchedToReplacedRole.ok;
    if (switchedToReplacedRole.ok) await switchCharacter('doudou', 'qa-package-replace');
  } catch (error) {
    qaPackageRoundTrip.error = String(error?.stack || error);
  }
  report.settings.characterPackage = qaPackageRoundTrip;
  const defaultChanged = qaRoleId ? setDefaultCharacter(qaRoleId) : { ok: false };
  const defaultRestored = setDefaultCharacter('doudou');
  const characterDeleted = qaRoleId ? deleteCharacter(qaRoleId) : { ok: false };
  report.settings.characterManagement = {
    created: characterCreated.ok,
    detailsReadable: characterDetails?.ok === true,
    edited: characterEdited.ok,
    switchedToCreatedRole: switchedToQaRole.ok,
    switchToCreatedRoleError: switchedToQaRole.error || null,
    switchToCreatedRoleState: switchedToQaRole.switchState || null,
    switchedBackToDoudou: switchedBackToDoudou.ok,
    switchBackError: switchedBackToDoudou.error || null,
    sleepLoopWasReady,
    switchedFromSleepLoop: switchedFromSleepLoop.ok,
    switchFromSleepLoopError: switchedFromSleepLoop.error || null,
    switchedBackAfterSleepLoop: switchedBackAfterSleepLoop.ok,
    rendererAfterSwitch: qaRoleRendererState,
    defaultChanged: defaultChanged.ok,
    defaultRestored: defaultRestored.ok,
    deleted: characterDeleted.ok,
    finalRoleCount: characterIndex.roles.length,
  };
  const savedProfile = JSON.parse(fs.readFileSync(getProfilePath(), 'utf8'));
  report.settings.persistence = {
    profileExists: fs.existsSync(getProfilePath()),
    savedScale: savedProfile.appearance?.scale,
    savedUserSkillCount: savedProfile.userSkills?.length || 0,
    remainingImportedMedia: fs.readdirSync(getRoleMediaDirectory()).length,
  };
  const topLeftBounds = clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: Number.MIN_SAFE_INTEGER,
    y: Number.MIN_SAFE_INTEGER,
  });
  report.geometry.topLeftDragLimit = {
    windowBounds: topLeftBounds,
    visibleLeft: topLeftBounds.x + petVisualBounds.left,
    visibleTop: topLeftBounds.y + petVisualBounds.top,
  };
  const bottomRightBounds = clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: Number.MAX_SAFE_INTEGER,
    y: Number.MAX_SAFE_INTEGER,
  });
  const edgeSession = {
    anchorPointerX: 1000,
    anchorPointerY: 1000,
    anchorWindowX: bottomRightBounds.x,
    anchorWindowY: bottomRightBounds.y,
  };
  const clampedBeyondEdge = getAnchoredDragBounds(edgeSession, { x: 1100, y: 1100 });
  const stationaryAtEdge = Array.from({ length: 240 }, () => (
    getAnchoredDragBounds(edgeSession, { x: 1100, y: 1100 })
  )).at(-1);
  report.geometry.edgeReverse = {
    bottomRightBounds,
    clampedBeyondEdge,
    stationaryAtEdge,
    // A one-pixel reversal after hitting the edge must move immediately;
    // there must be no accumulated overshoot to repay.
    afterOnePixelReverse: getAnchoredDragBounds(edgeSession, { x: 1099, y: 1099 }),
  };
  const topRightBounds = clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: Number.MAX_SAFE_INTEGER,
    y: Number.MIN_SAFE_INTEGER,
  });
  const topRightSession = {
    anchorPointerX: 1000,
    anchorPointerY: 1000,
    anchorWindowX: topRightBounds.x,
    anchorWindowY: topRightBounds.y,
  };
  const clampedPastTopRight = getAnchoredDragBounds(
    topRightSession,
    { x: 1100, y: 900 },
  );
  const stationaryAtTopRight = Array.from({ length: 240 }, () => (
    getAnchoredDragBounds(topRightSession, { x: 1100, y: 900 })
  )).at(-1);
  report.geometry.topRightStability = {
    topRightBounds,
    clampedPastTopRight,
    stationaryAtTopRight,
    afterOnePixelReverse: getAnchoredDragBounds(topRightSession, { x: 1099, y: 901 }),
  };

  // Render the actual pet at all four extremes inside the fixed
  // primary-display overlay. This verifies pixels, not just coordinate math.
  const qaWorkArea = getPrimaryWorkArea();
  const bottomLeftBounds = clampPetToPrimary({
    width: petWindowSize,
    height: petWindowSize,
    x: Number.MIN_SAFE_INTEGER,
    y: Number.MAX_SAFE_INTEGER,
  });
  mainWindow.setBounds(qaWorkArea, false);
  applyFullWindowShape();
  sendToPet('pet:drag-overlay', {
    active: true,
    dragging: true,
    x: bottomRightBounds.x - qaWorkArea.x,
    y: bottomRightBounds.y - qaWorkArea.y,
    size: petWindowSize,
  });
  await wait(260);
  report.geometry.dragOverlayBottomRight = {
    windowBounds: mainWindow.getBounds(),
    renderer: await inspectRendererStageBounds(),
    renderedAlpha: await inspectCapturedAlphaBounds(),
  };
  sendToPet('pet:drag-overlay', {
    active: true,
    dragging: true,
    x: topRightBounds.x - qaWorkArea.x,
    y: topRightBounds.y - qaWorkArea.y,
    size: petWindowSize,
  });
  await wait(260);
  report.geometry.dragOverlayTopRight = {
    windowBounds: mainWindow.getBounds(),
    renderer: await inspectRendererStageBounds(),
    renderedAlpha: await inspectCapturedAlphaBounds(),
  };
  sendToPet('pet:drag-overlay', {
    active: true,
    dragging: true,
    x: topLeftBounds.x - qaWorkArea.x,
    y: topLeftBounds.y - qaWorkArea.y,
    size: petWindowSize,
  });
  await wait(260);
  report.geometry.dragOverlayTopLeft = {
    windowBounds: mainWindow.getBounds(),
    renderer: await inspectRendererStageBounds(),
    renderedAlpha: await inspectCapturedAlphaBounds(),
  };
  sendToPet('pet:drag-overlay', {
    active: true,
    dragging: true,
    x: bottomLeftBounds.x - qaWorkArea.x,
    y: bottomLeftBounds.y - qaWorkArea.y,
    size: petWindowSize,
  });
  await wait(260);
  report.geometry.dragOverlayBottomLeft = {
    windowBounds: mainWindow.getBounds(),
    renderer: await inspectRendererStageBounds(),
    renderedAlpha: await inspectCapturedAlphaBounds(),
  };
  petCanvasBounds = { ...initialPetCanvasBounds };
  publishPetCanvasPosition();
  applyNormalWindowShape();
  await wait(180);
  report.frames.push(await captureQaFrame('01-idle.png'));
  sendToPet('pet:command', makeSkillCommand('idle-breath', 'qa'));
  await wait(1650);
  report.frames.push(await captureQaFrame('01b-idle-breath.png'));
  await wait(4100);
  sendToPet('pet:command', makeSkillCommand('spin', 'qa'));
  await wait(1650);
  report.frames.push(await captureQaFrame('02-spin.png'));
  await wait(4100);

  for (let run = 1; run <= 3; run += 1) {
    sendToPet('pet:command', makeSkillCommand('grass', 'qa'));
    await wait(1500);
    if (run === 1 && normalBounds && sceneBounds) {
      report.geometry.scene = {
        windowBounds: mainWindow.getBounds(),
        sceneBounds,
        windowCenter: {
          x: sceneBounds.x + sceneBounds.width / 2,
          y: sceneBounds.y + sceneBounds.height / 2,
        },
        petVisualCenter: getPetVisualCenter(normalBounds),
      };
    }
    report.frames.push(await captureQaFrame(`03-grass-${run}.png`));
    await wait(4300);
  }

  report.frames.push(await captureQaFrame('04-restored.png'));
  await wait(900);

  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  await wait(1400);
  report.frames.push(await captureQaFrame('05-sleep-enter.png'));
  report.sleep.enterMode = animationStateHistory.at(-1)?.mode || null;
  await wait(4100);
  report.frames.push(await captureQaFrame('06-sleep-loop.png'));
  report.sleep.loopMode = animationStateHistory.at(-1)?.mode || null;
  report.sleep.loopShape = currentWindowShape.map((rect) => ({ ...rect }));
  const sleepHitPoint = await mainWindow.webContents.executeJavaScript(
    `(() => {
      const rect = document.querySelector('#sleep-loop-video').getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
    true,
  );
  lastPointerProbeResult = null;
  sendToPet('pet:pointer-probe', sleepHitPoint);
  await wait(180);
  report.sleep.pointerWake = {
    point: sleepHitPoint,
    probeResult: lastPointerProbeResult,
  };
  await wait(1300);
  report.frames.push(await captureQaFrame('07-waking.png'));
  report.sleep.wakingMode = animationStateHistory.at(-1)?.mode || null;
  await wait(3100);
  report.sleep.finalMode = animationStateHistory.at(-1)?.mode || null;

  await mainWindow.webContents.executeJavaScript(
    "document.querySelectorAll('video').forEach((video) => { video.defaultPlaybackRate = 6; video.playbackRate = 6; })",
    true,
  );
  const randomHistoryStart = animationStateHistory.length;
  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  await wait(1400);
  report.randomBehavior.sleepModeBeforeTrigger = animationStateHistory.at(-1)?.mode || null;
  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-random'))",
    true,
  );
  await wait(5200);
  report.randomBehavior.history = animationStateHistory.slice(randomHistoryStart);
  report.randomBehavior.finalMode = animationStateHistory.at(-1)?.mode || null;

  updateRandomBehaviorRule({ enabled: true, intervalMinutes: 20, skillIds: ['grass'] });
  await wait(240);
  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  await wait(1400);
  const randomSceneHistoryStart = animationStateHistory.length;
  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-random-scene'))",
    true,
  );
  await wait(5200);
  report.randomBehavior.sceneHistory = animationStateHistory.slice(randomSceneHistoryStart);
  report.randomBehavior.sceneFinalMode = animationStateHistory.at(-1)?.mode || null;
  if (randomBehaviorBeforeQa) updateRandomBehaviorRule(randomBehaviorBeforeQa);
  else deleteRandomBehaviorRule();

  // Exercise the persistent overlay at the fractional alpha-derived edge.
  petCanvasBounds = { ...topLeftBounds };
  publishPetCanvasPosition();
  applyNormalWindowShape();
  await wait(180);
  report.geometry.topLeftApplied = {
    windowBounds: mainWindow.getBounds(),
    petCanvasBounds: { ...petCanvasBounds },
    visibleLeft: petCanvasBounds.x + petVisualBounds.left,
    visibleTop: petCanvasBounds.y + petVisualBounds.top,
  };
  petCanvasBounds = { ...initialPetCanvasBounds };
  publishPetCanvasPosition();
  applyNormalWindowShape();
  await wait(180);

  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  await wait(1100);
  report.sleep.beforeHideMode = animationStateHistory.at(-1)?.mode || null;
  hideToTaskbar();
  await wait(320);
  report.sleep.afterHideMode = animationStateHistory.at(-1)?.mode || null;
  report.lifecycle.push(getQaWindowState('hidden-to-taskbar'));
  showPet();
  await wait(420);
  report.lifecycle.push(getQaWindowState('restored-from-taskbar'));

  await mainWindow.webContents.executeJavaScript(
    "document.dispatchEvent(new Event('pet-qa-force-sleep'))",
    true,
  );
  await wait(1100);
  report.sleep.beforeCloseMode = animationStateHistory.at(-1)?.mode || null;
  requestAnimatedLifecycle('close-to-tray');
  await wait(LIFECYCLE_ANIMATION_MS + 180);
  report.sleep.afterCloseMode = animationStateHistory.at(-1)?.mode || null;
  report.lifecycle.push(getQaWindowState('closed-to-tray'));
  showPet();
  await wait(420);
  report.lifecycle.push(getQaWindowState('restored-from-tray'));
  report.animationHistory = animationStateHistory;

  report.completedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(outputDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  quitImmediately();
}

async function inspectRendererHitPoint(x, y) {
  if (!isUsableWindow()) return null;
  return mainWindow.webContents.executeJavaScript(
    `(() => {
      const character = document.querySelector('#pet-character');
      const image = document.querySelector('#idle-image');
      const rect = character.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawLeft = rect.left + (rect.width - drawWidth) / 2;
      const drawTop = rect.bottom - drawHeight;
      const imageX = Math.min(image.naturalWidth - 1, Math.max(0,
        Math.floor(((${Number(x)} - drawLeft) / drawWidth) * image.naturalWidth)));
      const imageY = Math.min(image.naturalHeight - 1, Math.max(0,
        Math.floor(((${Number(y)} - drawTop) / drawHeight) * image.naturalHeight)));
      const alpha = context.getImageData(imageX, imageY, 1, 1).data[3];
      return {
        point: { x: ${Number(x)}, y: ${Number(y)} },
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height },
        naturalSize: { width: image.naturalWidth, height: image.naturalHeight },
        drawRect: { left: drawLeft, top: drawTop, width: drawWidth, height: drawHeight },
        imagePoint: { x: imageX, y: imageY },
        alpha,
        devicePixelRatio: window.devicePixelRatio,
      };
    })()`,
    true,
  );
}

async function runInputQa() {
  await wait(900);
  const workArea = getPrimaryWorkArea();
  const point = {
    x: petCanvasBounds.x - workArea.x + (petVisualBounds.left + petVisualBounds.right) / 2,
    y: petCanvasBounds.y - workArea.y + (petVisualBounds.top + petVisualBounds.bottom) / 2,
  };
  const rendererInspection = await inspectRendererHitPoint(point.x, point.y);

  setMousePassthrough(true, { force: true });
  lastPointerProbeResult = null;
  sendToPet('pet:pointer-probe', point);
  await wait(120);
  const opaqueProbe = lastPointerProbeResult;

  lastPointerProbeResult = null;
  sendToPet('pet:pointer-probe', { x: 2, y: 2 });
  await wait(120);
  const transparentProbe = lastPointerProbeResult;

  const nativeShapeContainsOpaquePoint = currentWindowShape.some((rect) => (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  ));

  const stationaryShape = currentWindowShape.map((rect) => ({ ...rect }));
  const bounds = mainWindow.getBounds();
  dragSession = {
    anchorPointerX: petCanvasBounds.x,
    anchorPointerY: petCanvasBounds.y,
    anchorWindowX: petCanvasBounds.x,
    anchorWindowY: petCanvasBounds.y,
    appliedX: petCanvasBounds.x,
    appliedY: petCanvasBounds.y,
  };
  applyNormalWindowShape();
  const dragShape = currentWindowShape.map((rect) => ({ ...rect }));
  dragSession = null;
  applyNormalWindowShape();
  const restoredShape = currentWindowShape.map((rect) => ({ ...rect }));
  const dragUsesFullWindowShape = dragShape.length === 1 &&
    dragShape[0].x === 0 && dragShape[0].y === 0 &&
    dragShape[0].width >= bounds.width && dragShape[0].height >= bounds.height;
  const stationaryShapeRestored = JSON.stringify(restoredShape) === JSON.stringify(stationaryShape);

  const report = {
    rendererInspection,
    opaqueProbe,
    transparentProbe,
    nativeWindowShape: currentWindowShape,
    nativeShapeContainsOpaquePoint,
    dragShapeLifecycle: {
      stationaryShape,
      dragShape,
      restoredShape,
      dragUsesFullWindowShape,
      stationaryShapeRestored,
    },
    passed: Boolean(
      rendererInspection?.alpha >= 24 &&
      transparentProbe?.interactive === false &&
      nativeShapeContainsOpaquePoint &&
      dragUsesFullWindowShape &&
      stationaryShapeRestored
    ),
  };
  const outputDirectory = path.join(__dirname, 'qa-input-current');
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  console.log(`[豆豆桌宠 input QA] ${JSON.stringify(report)}`);
  quitImmediately();
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 840,
    minHeight: 620,
    title: '豆豆桌宠设置',
    backgroundColor: '#f5f2ec',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'doudou.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadURL('pet://app/settings.html');
  settingsWindow.once('ready-to-show', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.show();
  });
  settingsWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    console.error('[豆豆桌宠] 设置页面加载失败', { code, description, validatedURL });
  });
  settingsWindow.webContents.on('console-message', (_event, details) => {
    if (details.level >= 2) {
      console.error(`[豆豆桌宠 settings] ${details.message} (${details.sourceId}:${details.lineNumber})`);
    }
  });
  settingsWindow.on('closed', () => {
    previewFiles.clear();
    settingsWindow = null;
  });
}

function showSettings() {
  if (!settingsWindow || settingsWindow.isDestroyed()) createSettingsWindow();
  if (settingsWindow.webContents.isLoading()) return;
  if (!settingsWindow.isVisible()) settingsWindow.show();
  if (settingsWindow.isMinimized()) settingsWindow.restore();
  settingsWindow.focus();
}

function createPetWindow() {
  const workArea = getPrimaryWorkArea();
  if (!petCanvasBounds) petCanvasBounds = getInitialBounds();
  mainWindow = new BrowserWindow({
    ...workArea,
    title: '豆豆桌宠',
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    roundedCorners: false,
    icon: path.join(__dirname, 'assets', 'doudou.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL('pet://app/index.html');

  mainWindow.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    console.error('[豆豆桌宠] 页面加载失败', { code, description, validatedURL });
  });

  mainWindow.webContents.on('console-message', (_event, details) => {
    if (details.level >= 2) {
      console.error(`[豆豆桌宠 renderer] ${details.message} (${details.sourceId}:${details.lineNumber})`);
    }
  });

  mainWindow.once('ready-to-show', () => {
    // Explicitly reset the native hit-test state. The JavaScript and native
    // caches can otherwise disagree after a previous suspend/scene cycle.
    setMousePassthrough(false, { force: true });
    publishPetCanvasPosition();
    applyNormalWindowShape();
    mainWindow.show();
    if (!isPrototypeQa && !isInputQa && !isSmokeTest) startPointerProbe();
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    if (isInputQa) {
      runInputQa().catch((error) => {
        console.error('[豆豆桌宠 input QA] 运行失败', error);
        quitImmediately();
      });
    } else if (isPrototypeQa) {
      runPrototypeQa().catch((error) => {
        console.error('[豆豆桌宠 QA] 运行失败', error);
        try {
          fs.mkdirSync(getQaOutputDirectory(), { recursive: true });
          fs.writeFileSync(
            path.join(getQaOutputDirectory(), 'error.txt'),
            `${error?.stack || error}\n`,
            'utf8',
          );
        } catch (_writeError) {}
        quitImmediately();
      });
    } else if (isSmokeTest) {
      setTimeout(quitImmediately, 1200);
    }
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    requestAnimatedLifecycle('close-to-tray');
  });

  mainWindow.on('minimize', () => sendToPet('pet:suspended', { reason: 'hidden' }));
  mainWindow.on('restore', () => {
    sendToPet('pet:resumed', { source: 'taskbar' });
    brieflyBringToFront();
  });
  mainWindow.on('blur', () => {
    if (isUsableWindow()) mainWindow.setAlwaysOnTop(false);
  });
  mainWindow.on('closed', () => {
    stopDragPolling();
    cancelDragShapeRestore();
    dragSession = null;
    stopPointerProbe();
    mainWindow = null;
  });
}

app.on('second-instance', () => showPet());

app.whenReady().then(() => {
  bundledSkillManifest = loadSkillManifest();
  const characterStore = initializeCharacterStore({
    userDataPath: app.getPath('userData'),
    roleName: bundledSkillManifest.roleName || '豆豆',
    thumbnail: bundledSkillManifest.standardPose?.image || 'assets/dog.png',
  });
  characterIndex = characterStore.index;
  activeRoleId = characterIndex.defaultRoleId;
  userProfile = loadUserProfile();
  rebuildSkillManifest();
  saveUserProfile();
  installPetProtocol();
  installIpcHandlers();
  createPetWindow();
  createTray();
  installPowerMonitorHandlers();

  app.on('activate', () => {
    if (!isUsableWindow()) createPetWindow();
    showPet();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  stopDragPolling();
  cancelDragShapeRestore();
  stopPointerProbe();
  clearTimeout(lifecycleTimer);
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
});

// The tray owns the application lifetime. Closing or hiding the pet window
// must not terminate Electron; only the explicit exit actions do that.
app.on('window-all-closed', () => {});
