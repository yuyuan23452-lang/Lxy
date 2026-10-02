const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_STATE_ANCHOR,
  formatInactivityDuration,
  getInactivityRuleReferences,
  normalizeInactivityRule,
} = require('./inactivity-flow');

test('legacy sleep settings migrate to the generic inactivity flow', () => {
  const rule = normalizeInactivityRule(null, {
    autoSleepEnabled: true,
    inactivitySleepMs: 30_000,
    sleepEnterSkillId: 'enter',
    sleepLoopSkillId: 'loop',
    wakeSkillId: 'recover',
  });
  assert.equal(rule.enabled, true);
  assert.equal(rule.inactivitySeconds, 30);
  assert.equal(rule.sleepEnterSkillId, 'enter');
  assert.equal(rule.sleepLoopSkillId, 'loop');
  assert.equal(rule.wakeSkillId, 'recover');
  assert.deepEqual(rule.anchor, DEFAULT_STATE_ANCHOR);
});

test('optional transition animations may be empty but the loop is retained', () => {
  const rule = normalizeInactivityRule({
    enabled: true,
    inactivitySeconds: 3_600,
    sleepEnterSkillId: '',
    sleepLoopSkillId: 'quiet-loop',
    wakeSkillId: '',
  });
  assert.equal(rule.inactivitySeconds, 3_600);
  assert.equal(rule.sleepEnterSkillId, '');
  assert.equal(rule.sleepLoopSkillId, 'quiet-loop');
  assert.equal(rule.wakeSkillId, '');
});

test('duration and references are suitable for user-facing validation', () => {
  const rule = normalizeInactivityRule({
    enabled: true,
    inactivitySeconds: 125,
    sleepEnterSkillId: 'enter',
    sleepLoopSkillId: 'loop',
    wakeSkillId: '',
  });
  assert.equal(formatInactivityDuration(rule.inactivitySeconds), '2 分 5 秒');
  assert.deepEqual(
    getInactivityRuleReferences(rule).map((item) => item.phase),
    ['enter', 'loop'],
  );
});
