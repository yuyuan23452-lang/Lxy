const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('settingsAPI', {
  getData: () => ipcRenderer.invoke('settings:get-data'),
  getCharacter: (roleId) => ipcRenderer.invoke('settings:get-character', roleId),
  chooseCharacterImage: () => ipcRenderer.invoke('settings:choose-character-image'),
  chooseCharacterIdle: () => ipcRenderer.invoke('settings:choose-character-idle'),
  createCharacter: (draft) => ipcRenderer.invoke('settings:create-character', draft),
  updateCharacter: (roleId, draft) => ipcRenderer.invoke('settings:update-character', roleId, draft),
  setDefaultCharacter: (roleId) => ipcRenderer.invoke('settings:set-default-character', roleId),
  switchCharacter: (roleId) => ipcRenderer.invoke('settings:switch-character', roleId),
  deleteCharacter: (roleId) => ipcRenderer.invoke('settings:delete-character', roleId),
  exportCharacterPackage: (roleId) => ipcRenderer.invoke('settings:export-character-package', roleId),
  importCharacterPackage: () => ipcRenderer.invoke('settings:import-character-package'),
  chooseSkillMedia: () => ipcRenderer.invoke('settings:choose-skill-media'),
  discardPreview: (token) => ipcRenderer.send('settings:discard-preview', token),
  importSkill: (draft) => ipcRenderer.invoke('settings:import-skill', draft),
  updateSkill: (skillId, changes) => ipcRenderer.invoke('settings:update-skill', skillId, changes),
  getSkillUsage: (skillId) => ipcRenderer.invoke('settings:get-skill-usage', skillId),
  deleteSkill: (skillId) => ipcRenderer.invoke('settings:delete-skill', skillId),
  restoreBuiltinSkills: () => ipcRenderer.invoke('settings:restore-builtin-skills'),
  setScale: (scale) => ipcRenderer.invoke('settings:set-scale', scale),
  setStartupState: (value) => ipcRenderer.invoke('settings:set-startup-state', value),
  updateAutoSleepRule: (changes) => ipcRenderer.invoke('settings:update-auto-sleep-rule', changes),
  testInactivityFlow: () => ipcRenderer.invoke('settings:test-inactivity-flow'),
  updateRandomBehavior: (changes) => ipcRenderer.invoke('settings:update-random-behavior', changes),
  deleteRandomBehavior: () => ipcRenderer.invoke('settings:delete-random-behavior'),
  restoreRandomBehavior: () => ipcRenderer.invoke('settings:restore-random-behavior'),
  chooseOpeningMedia: () => ipcRenderer.invoke('settings:choose-opening-media'),
  createOpeningPlan: (name) => ipcRenderer.invoke('settings:create-opening-plan', name),
  updateOpeningSettings: (changes) => ipcRenderer.invoke('settings:update-opening-settings', changes),
  updateOpeningPlan: (planId, changes) => ipcRenderer.invoke('settings:update-opening-plan', planId, changes),
  duplicateOpeningPlan: (planId) => ipcRenderer.invoke('settings:duplicate-opening-plan', planId),
  deleteOpeningPlan: (planId) => ipcRenderer.invoke('settings:delete-opening-plan', planId),
  addOpeningSegment: (planId, draft) => ipcRenderer.invoke('settings:add-opening-segment', planId, draft),
  updateOpeningSegment: (planId, segmentId, changes) => ipcRenderer.invoke('settings:update-opening-segment', planId, segmentId, changes),
  replaceOpeningSegment: (planId, segmentId, draft) => ipcRenderer.invoke('settings:replace-opening-segment', planId, segmentId, draft),
  deleteOpeningSegment: (planId, segmentId) => ipcRenderer.invoke('settings:delete-opening-segment', planId, segmentId),
  reorderOpeningSegments: (planId, segmentIds) => ipcRenderer.invoke('settings:reorder-opening-segments', planId, segmentIds),
  onCharacterSwitchState: (callback) => subscribe('settings:character-switch-state', callback),
  onDataChanged: (callback) => subscribe('settings:data-changed', callback),
});
