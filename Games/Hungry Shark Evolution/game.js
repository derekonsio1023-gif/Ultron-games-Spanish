/* Bootstrap for the self-hosted Unity build. No remote game API is required. */
(() => {
  const canvas = document.getElementById('unity-canvas');
  const overlay = document.getElementById('overlay');
  const play = document.getElementById('play');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const fullscreen = document.getElementById('fullscreen');
  let instance;
  let started = false;
  const blobs = [];

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    if (instance?.Module?.setCanvasSize) instance.Module.setCanvasSize(width, height, false);
  }
  async function assetBlob(path, type) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const content = response.headers.get('Content-Encoding') === 'gzip'
      ? await response.arrayBuffer()
      : await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const url = URL.createObjectURL(new Blob([content], { type }));
    blobs.push(url);
    return url;
  }
  async function start() {
    if (started) return;
    started = true;
    play.hidden = true;
    progress.hidden = false;
    status.textContent = 'Loading game files…';
    try {
      resize();
      const [dataUrl, frameworkUrl, codeUrl] = await Promise.all([
        assetBlob('Build/hseyoutube.data.gz', 'application/octet-stream'),
        assetBlob('Build/hseyoutube.framework.js.gz', 'application/javascript'),
        assetBlob('Build/hseyoutube.wasm.gz', 'application/wasm')
      ]);
      status.textContent = 'Starting the ocean…';
      instance = await createUnityInstance(canvas, {
        dataUrl, frameworkUrl, codeUrl,
        streamingAssetsUrl: 'StreamingAssets',
        companyName: 'Future Games Of London',
        productName: 'Hungry Shark',
        productVersion: '13.7.2',
        matchWebGLToCanvasSize: true,
        devicePixelRatio: window.devicePixelRatio || 1,
        autoSyncPersistentDataPath: true,
        showBanner: (message, type) => console[type === 'error' ? 'error' : 'warn'](message)
      }, value => { progress.value = value; });
      window.unityInstance = instance;
      overlay.hidden = true;
      resize();
      canvas.focus();
    } catch (error) {
      console.error('Hungry Shark failed to start:', error);
      status.textContent = `Unable to start the game: ${error.message}`;
      started = false;
      play.hidden = false;
    }
  }
  play.addEventListener('click', start);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.getElementById('game').requestFullscreen();
    } catch (error) { console.warn('Fullscreen unavailable:', error); }
    resize();
  });
  window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  resize();
})();
