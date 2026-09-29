// Background music fallback for the web build.
//
// Why this file exists: the Unity build inside bin/ contains NO audio asset at all
// (no AudioClip data in game.data), so the game code (the "MusicControll" script) has nothing
// to play and the game framework keeps logging
// "DefaultPauseTemplate: Pause ... by ApplicationFocus, there are 0 sources.".
// Until the music clip is restored in the Unity project and the WebGL build is regenerated,
// this module plays a music track from the web layer.
//
// Configuration (lib/runtimeData.js):
//   fallbackMusicURL    - path of the track, "" disables this module.
//   fallbackMusicVolume - volume, from 0 to 1.
//
// The module switches itself off when the Unity build starts playing any audio,
// so it never plays on top of the game music once the build has its own audio.
const backgroundMusic = {

    url: '',
    volume: 0.6,
    element: null,
    started: false,
    disabled: false,

    initialize: function () {
        console.log('Background music fallback called.');

        if (typeof runtimeData === 'undefined' || runtimeData == null) {
            console.warn('Background music fallback: runtimeData is not available.');
            return;
        }

        this.url = runtimeData.fallbackMusicURL != null ? runtimeData.fallbackMusicURL : '';
        this.volume = runtimeData.fallbackMusicVolume != null ? runtimeData.fallbackMusicVolume : 0.6;

        if (this.url === '') {
            console.log('Background music fallback is disabled.');
            return;
        }

        this.watchUnityAudio();

        let element = document.createElement('audio');
        element.src = this.url;
        element.loop = true;
        element.preload = 'auto';
        element.volume = this.volume;
        element.addEventListener('error', this.onError.bind(this));
        element.addEventListener('playing', this.onPlaying.bind(this));
        document.body.appendChild(element);
        this.element = element;

        // Browsers only allow audible playback after a user gesture.
        window.addEventListener('pointerdown', this.onUserGesture.bind(this));
        window.addEventListener('mousedown', this.onUserGesture.bind(this));
        window.addEventListener('touchstart', this.onUserGesture.bind(this));
        window.addEventListener('keydown', this.onUserGesture.bind(this));

        // Keep the track in sync with the document visibility, like the game does with its pause.
        document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));

        this.play();
    },

    play: function () {
        if (this.disabled === true || this.element == null) {
            return;
        }
        try {
            let promise = this.element.play();
            if (promise != null && typeof promise.catch === 'function') {
                promise.catch(() => {
                    // Autoplay is blocked until the first user interaction, onUserGesture handles it.
                });
            }
        }
        catch (exception) {
            console.warn('Background music fallback: playback failed.', exception);
        }
    },

    onUserGesture: function () {
        if (this.started === true) {
            return;
        }
        this.started = true;
        console.log('Background music fallback: user gesture detected.');
        this.play();
    },

    onVisibilityChange: function () {
        if (this.disabled === true || this.element == null) {
            return;
        }
        if (document.visibilityState === 'hidden') {
            this.element.pause();
        }
        else {
            this.play();
        }
    },

    onPlaying: function () {
        console.log('Background music fallback is playing: ' + this.url);
    },

    onError: function () {
        this.disabled = true;
        console.warn('Background music fallback: the track "' + this.url + '" could not be loaded. '
            + 'Put the music file in the build or set fallbackMusicURL to "" in lib/runtimeData.js.');
    },

    // Watches the AudioContext created by the Unity build: as soon as the game plays a sound,
    // the fallback is removed because the build already has its own audio.
    watchUnityAudio: function () {
        try {
            let originalContext = window.AudioContext || window.webkitAudioContext;
            if (originalContext == null) {
                return;
            }
            let module = this;
            let wrappedContext = function (...args) {
                let context = new originalContext(...args);
                try {
                    let createBufferSource = context.createBufferSource.bind(context);
                    context.createBufferSource = function () {
                        let node = createBufferSource();
                        let start = node.start.bind(node);
                        node.start = function (...startArgs) {
                            module.onUnityAudioDetected();
                            return start(...startArgs);
                        };
                        return node;
                    };
                }
                catch (exception) {
                    console.warn('Background music fallback: unity audio detection failed.', exception);
                }
                return context;
            };
            wrappedContext.prototype = originalContext.prototype;
            window.AudioContext = wrappedContext;
            window.webkitAudioContext = wrappedContext;
        }
        catch (exception) {
            console.warn('Background music fallback: unity audio detection could not be installed.', exception);
        }
    },

    onUnityAudioDetected: function () {
        if (this.disabled === true) {
            return;
        }
        this.disabled = true;
        console.log('Background music fallback stopped: the Unity build is playing audio.');
        if (this.element != null) {
            this.element.pause();
            this.element.remove();
            this.element = null;
        }
    },

    // Manual control, useful while the in-game mute button cannot drive this track.
    setMuted: function (muted) {
        if (this.element == null) {
            return;
        }
        this.element.muted = muted === true;
        console.log('Background music fallback mute: ' + this.element.muted);
    },

    setVolume: function (volume) {
        if (this.element == null) {
            return;
        }
        this.element.volume = volume;
        console.log('Background music fallback volume: ' + this.element.volume);
    },

};
