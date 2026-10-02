const INACTIVITY_MIN_SECONDS = 5;
const INACTIVITY_MAX_SECONDS = 60 * 60;

const DEFAULT_STATE_ANCHOR = Object.freeze({
  mode: 'bottom-center',
  x: 0.5,
  y: 1,
});

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function readSkillId(rule, key, fallback = '') {
  if (rule && Object.prototype.hasOwnProperty.call(rule, key)) {
    return typeof rule[key] === 'string' ? rule[key].slice(0, 80) : '';
  }
  return typeof fallback === 'string' ? fallback.slice(0, 80) : '';
}

function normalizeStateAnchor(anchor) {
  return {
    mode: 'bottom-center',
    x: clampNumber(anchor?.x, 0, 1, DEFAULT_STATE_ANCHOR.x),
    y: clampNumber(anchor?.y, 0, 1, DEFAULT_STATE_ANCHOR.y),
  };
}

function normalizeInactivityRule(rule, behavior = {}) {
  const fallbackSeconds = clampNumber(
    Number(behavior?.inactivitySleepMs) / 1000,
    INACTIVITY_MIN_SECONDS,
    INACTIVITY_MAX_SECONDS,
    30,
  );
  const fallbackEnabled = behavior?.autoSleepEnabled === true;
  return {
    enabled: rule && Object.prototype.hasOwnProperty.call(rule, 'enabled')
      ? rule.enabled === true
      : fallbackEnabled,
    inactivitySeconds: Math.round(clampNumber(
      rule?.inactivitySeconds,
      INACTIVITY_MIN_SECONDS,
      INACTIVITY_MAX_SECONDS,
      fallbackSeconds,
    )),
    sleepEnterSkillId: readSkillId(rule, 'sleepEnterSkillId', behavior?.sleepEnterSkillId),
    sleepLoopSkillId: readSkillId(rule, 'sleepLoopSkillId', behavior?.sleepLoopSkillId),
    wakeSkillId: readSkillId(rule, 'wakeSkillId', behavior?.wakeSkillId),
    wakeOnPointer: rule?.wakeOnPointer !== false,
    anchor: normalizeStateAnchor(rule?.anchor || behavior?.stateAnchor),
  };
}

function getInactivityRuleReferences(rule) {
  return [
    { phase: 'enter', label: '无互动流程：进入动画', skillId: rule?.sleepEnterSkillId || '' },
    { phase: 'loop', label: '无互动流程：循环动画', skillId: rule?.sleepLoopSkillId || '' },
    { phase: 'recover', label: '无互动流程：恢复动画', skillId: rule?.wakeSkillId || '' },
  ].filter((item) => item.skillId);
}

function formatInactivityDuration(totalSeconds) {
  const seconds = Math.round(clampNumber(
    totalSeconds,
    INACTIVITY_MIN_SECONDS,
    INACTIVITY_MAX_SECONDS,
    30,
  ));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}

module.exports = {
  DEFAULT_STATE_ANCHOR,
  INACTIVITY_MAX_SECONDS,
  INACTIVITY_MIN_SECONDS,
  formatInactivityDuration,
  getInactivityRuleReferences,
  normalizeInactivityRule,
  normalizeStateAnchor,
};
