/* Local replacement for YouTube Playables' optional save and lifecycle API. */
(() => {
  const storageKey = 'hungry-shark-evolution-youtube-save-v1';
  const listeners = { pause: [], resume: [], audio: [] };
  function safeRead() {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  }
  function safeWrite(value) {
    try { localStorage.setItem(storageKey, String(value)); } catch (error) {
      console.warn('Unable to save game locally:', error);
    }
  }
  window.ytgame = {
    IN_PLAYABLES_ENV: false,
    game: {
      loadData: () => Promise.resolve(safeRead()),
      saveData: value => { safeWrite(value); return Promise.resolve(); },
      firstFrameReady: () => {},
      gameReady: () => {}
    },
    system: {
      isAudioEnabled: () => true,
      onPause: callback => listeners.pause.push(callback),
      onResume: callback => listeners.resume.push(callback),
      onAudioEnabledChange: callback => listeners.audio.push(callback)
    },
    health: { logWarning: () => {}, logError: () => {} },
    engagement: { sendScore: () => Promise.resolve() }
  };
  document.addEventListener('visibilitychange', () => {
    for (const callback of listeners[document.hidden ? 'pause' : 'resume']) callback();
  });
})();
