const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('petAPI', {
  getSkillManifest: () => ipcRenderer.invoke('skills:get-manifest'),
  getAppearance: () => ipcRenderer.invoke('appearance:get'),
  showContextMenu: () => ipcRenderer.send('menu:show'),
  requestLifecycle: (action) => ipcRenderer.send('lifecycle:request', action),
  setMousePassthrough: (enabled) => {
    ipcRenderer.send('window:set-mouse-passthrough', Boolean(enabled));
  },
  reportPointerProbe: (result) => ipcRenderer.send('window:pointer-probe-result', result),
  setPetVisualBounds: (bounds) => ipcRenderer.send('window:set-pet-visual-bounds', bounds),
  reportAnimationState: (state) => ipcRenderer.send('animation:state', state),
  reportCharacterSwitch: (result) => ipcRenderer.send('character:switch-result', result),
  enterScene: () => ipcRenderer.invoke('window:enter-scene'),
  exitScene: () => ipcRenderer.invoke('window:exit-scene'),
  beginDrag: () => ipcRenderer.send('window:drag-start'),
  dragTo: () => ipcRenderer.send('window:drag-move'),
  endDrag: () => ipcRenderer.send('window:drag-end'),
  onCommand: (callback) => subscribe('pet:command', callback),
  onSkillManifestUpdated: (callback) => subscribe('skills:updated', callback),
  onAppearanceChanged: (callback) => subscribe('pet:appearance', callback),
  onCharacterSwitch: (callback) => subscribe('pet:switch-character', callback),
  onPointerProbe: (callback) => subscribe('pet:pointer-probe', callback),
  onDragOverlay: (callback) => subscribe('pet:drag-overlay', callback),
  onSceneLayout: (callback) => subscribe('pet:scene-layout', callback),
  onTestInactivityFlow: (callback) => subscribe('pet:test-inactivity-flow', callback),
  onPrepareLifecycle: (callback) => subscribe('pet:prepare-lifecycle', callback),
  onSuspended: (callback) => subscribe('pet:suspended', callback),
  onResumed: (callback) => subscribe('pet:resumed', callback),
});
