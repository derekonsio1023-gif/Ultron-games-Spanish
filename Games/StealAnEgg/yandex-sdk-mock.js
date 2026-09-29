// yandex-sdk-mock.js
// Mock del SDK de Yandex Games SOLO para desarrollo local.
// En producción (dentro de Yandex) este archivo NO debe cargarse.

(function () {
  if (window.YaGames) return; // ya existe, no tocar

  console.warn('[YaGames MOCK] Usando SDK simulado para desarrollo local');

  const noop = () => Promise.resolve();

  const mockSdk = {
    environment: {
      i18n: { lang: 'es', tld: 'com' },
      app:  { id: 'mock-app-id' },
      browser: {},
      payload: ''
    },
    getPlayer: () => Promise.resolve({
      getName: () => 'TestPlayer',
      getUniqueID: () => 'mock-uid-123',
      getMode: () => 'lite',
      getPhoto: () => '',
      setData: noop,
      getData: () => Promise.resolve({}),
      getStats: () => Promise.resolve([])
    }),
    getPayments: () => Promise.resolve({
      purchase: () => Promise.resolve({ purchaseToken: 'mock' }),
      getPurchases: () => Promise.resolve([]),
      getCatalog: () => Promise.resolve([]),
      consumePurchase: noop
    }),
    getLeaderboards: () => Promise.resolve({
      setLeaderboardScore: noop,
      getLeaderboardEntries: () => Promise.resolve({ entries: [] }),
      getLeaderboards: () => Promise.resolve([])
    }),
    getStorage: () => Promise.resolve({
      set: noop,
      get: () => Promise.resolve({}),
      getKeys: () => Promise.resolve([]),
      remove: noop,
      clear: noop
    }),
    auth: { openAuthDialog: noop },
    adv: {
      showFullscreenAdv: ({ callbacks } = {}) => {
        console.log('[YaGames MOCK] showFullscreenAdv');
        callbacks?.onClose?.(true);
        callbacks?.onOpen?.();
        callbacks?.onError?.(new Error('mock'));
      },
      showRewardedVideo: ({ callbacks } = {}) => {
        console.log('[YaGames MOCK] showRewardedVideo');
        callbacks?.onOpen?.();
        callbacks?.onRewarded?.();
        callbacks?.onClose?.();
      },
      getBannerAdvStatus: () => Promise.resolve({ stickyAdvIsShowing: false, reason: '' }),
      showBannerAdv: noop,
      hideBannerAdv: noop
    },
    feedback: {
      canReview: () => Promise.resolve(false),
      requestReview: noop
    },
    shortcut: {
      canShowPrompt: () => Promise.resolve({ canShow: false }),
      showPrompt: noop
    },
    screen: {
      fullscreen: {
        status: 'off',
        request: noop,
        exit: noop
      }
    },
    safeStorage: {
      set: noop,
      get: () => Promise.resolve(null)
    }
  };

  // La API real expone `YaGames.init()` que devuelve una promesa con el sdk
  window.YaGames = {
    init: () => Promise.resolve(mockSdk)
  };
})();