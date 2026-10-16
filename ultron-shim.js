(function () {
  try {
    console.log('[ULTRON] shim arrancando, contexto:', window === top ? 'TOP' : 'IFRAME');

    // ── createElement: CORS + bloqueo ytgame ──
    var _create = document.createElement.bind(document);
    document.createElement = function (tag) {
      var el = _create(tag);
      var t = String(tag).toLowerCase();
      if (t === 'img') {
        try { if (!el.crossOrigin) el.crossOrigin = 'anonymous'; } catch (e) {}
      }
      if (t === 'script') {
        var _src = '';
        Object.defineProperty(el, 'src', {
          get: function () { return _src; },
          set: function (v) {
            if (typeof v === 'string' && /ytgame\.js/i.test(v)) return;
            _src = v;
            el.setAttribute('src', v);
          },
          configurable: true
        });
      }
      return el;
    };

    // ── appendChild: bloquear scripts ytgame.js ──
    var _append = Element.prototype.appendChild;
    Element.prototype.appendChild = function (c) {
      if (c && c.tagName === 'SCRIPT' && c.src && /ytgame\.js/i.test(c.src)) return c;
      return _append.call(this, c);
    };

    // ── CORS en imágenes ──
    var srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (srcDesc) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: function () { return srcDesc.get.call(this); },
        set: function (v) {
          try { if (!this.crossOrigin) this.crossOrigin = 'anonymous'; } catch (e) {}
          srcDesc.set.call(this, v);
        },
        configurable: true
      });
    }
    var coDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'crossOrigin');
    if (coDesc) {
      Object.defineProperty(HTMLImageElement.prototype, 'crossOrigin', {
        get: function () { return coDesc.get.call(this); },
        set: function (v) { coDesc.set.call(this, v || 'anonymous'); },
        configurable: true
      });
    }
    var _sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if (this.tagName === 'IMG' && String(n).toLowerCase() === 'src') {
        try { if (!this.crossOrigin) this.crossOrigin = 'anonymous'; } catch (e) {}
      }
      return _sa.call(this, n, v);
    };
    var _Image = window.Image;
    window.Image = function (w, h) {
      var img = new _Image(w, h);
      try { if (!img.crossOrigin) img.crossOrigin = 'anonymous'; } catch (e) {}
      return img;
    };
    window.Image.prototype = _Image.prototype;

    // ── API del shim ──
    var P = function (v) { return function () { return Promise.resolve(v); }; };
    var N = function () {};
    var SAVE = P({ data: '', checksum: '' });
    var api = {
      game: {
        firstFrameReady: N, gameReady: N,
        loadData: SAVE, saveData: P(), sendScore: P(), log: N,
        getLanguage: P('en'),
        getSafeArea: P({ top: 0, left: 0, right: 0, bottom: 0 })
      },
      system: {
        onPause: N, onResume: N, onStateChange: N,
        isAudioEnabled: P(true), onAudioEnabledChange: N
      },
      engagement: { sendScore: P(), openStore: P() },
      environment: { getEnvironment: P({}) },
      health: { logError: N, logWarning: N, logInfo: N },
      ads: { requestInterstitialAd: P(), requestRewardedAd: P({ status: 'closed' }) }
    };

    // ── Proxy recursivo con auto-stub ──
    function wrap(o, p) {
      return new Proxy(o, {
        get: function (t, k) {
          if (k === 'then') return undefined;
          if (typeof k === 'symbol') return undefined;
          var v = t[k];
          if (v !== undefined) {
            if (typeof v === 'function') return v;
            if (typeof v === 'object' && v !== null) return wrap(v, p + '.' + String(k));
            return v;
          }
          var stub = function () { return Promise.resolve({ data: '', checksum: '' }); };
          return wrap(stub, p + '.' + String(k));
        },
        apply: function () { return Promise.resolve({ data: '', checksum: '' }); }
      });
    }

    // ── Instalar en window ──
    var s = wrap(api, 'ytgame');
    try {
      Object.defineProperty(window, 'ytgame', {
        get: function () { return s; },
        set: function () {},
        configurable: false,
        enumerable: true
      });
    } catch (e) {
      window.ytgame = s;
    }
    console.log('[ULTRON] shim instalado, window.ytgame =', typeof window.ytgame);

    // ── Watchdog ──
    var _checkCount = 0;
    setInterval(function () {
      if (window.ytgame !== s) {
        try {
          Object.defineProperty(window, 'ytgame', {
            get: function () { return s; },
            set: function () {},
            configurable: false,
            enumerable: true
          });
          console.log('[ULTRON] ytgame reinstalado (watchdog #' + (++_checkCount) + ')');
        } catch (e) {
          try { window.ytgame = s; } catch (e2) {}
        }
      }
    }, 50);

  } catch (e) {
    console.error('[ULTRON] shim error:', e);
  }
})();
