// Mock del SDK de Yandex Games para ejecución local
(function () {
  const mockPlayer = {
    getData: function () { return Promise.resolve({}); },
    setData: function () { return Promise.resolve(); },
    getName: function () { return ""; },
    getMode: function () { return "lite"; },
    getUniqueID: function () { return ""; },
    getPhoto: function () { return ""; },
    isLoggedIn: function () { return false; }
  };

  const mockYsdk = {
    getPlayer: function () { return Promise.resolve(mockPlayer); },
    features: { LoadingAPI: { ready: function () {} } },
    adv: {
      showFullscreenAdv: function (opts) { if (opts && opts.callbacks && opts.callbacks.onClose) opts.callbacks.onClose(); },
      showRewardedVideo: function (opts) { if (opts && opts.callbacks && opts.callbacks.onClose) opts.callbacks.onClose(); }
    },
    environment: { i18n: { lang: "es", tld: "com" } },
    deviceInfo: { type: "desktop" },
    screen: { fullscreen: false },
    feedback: { canReview: function () { return Promise.resolve(false); } },
    shortcut: { canShowPrompt: function () { return Promise.resolve(false); } }
  };

  window.YaGames = {
    init: function () { return Promise.resolve(mockYsdk); },
    deviceInfo: { type: "desktop" },
    environment: { i18n: { lang: "es" } }
  };

  console.log("[Mock] YaGames SDK listo");
})();