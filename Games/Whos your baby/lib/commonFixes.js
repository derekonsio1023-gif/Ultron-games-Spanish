// Disable unwanted page scroll.
window.addEventListener("wheel", (event) => event.preventDefault(), {
    passive: false,
});

// Disable unwanted key events.
window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", " "].includes(event.key)) {
        event.preventDefault();
    }
});

// This is a fix for handling visibility change
// on webview, it�s for an issue reported for Samsung App.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState) {
        if (document.visibilityState === "hidden") {
            application.publishEvent("OnWebDocumentPause", "True");
        }
        else if (document.visibilityState === "visible") {
            application.publishEvent("OnWebDocumentPause", "False");
        }
    }
});

// Audio initialization fix for Unity WebGL
// This ensures AudioContext is unlocked and audio can play
(function() {
    let audioInitialized = false;
    let audioContext = null;
    
    function unlockAudio() {
        if (audioInitialized) return;
        
        // Try to unlock AudioContext on user interaction
        const unlockAudioContext = async () => {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    // Create and resume audio context
                    audioContext = new AudioContext();
                    
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                        console.log('AudioContext unlocked successfully');
                    }
                    
                    // Create a silent sound to fully unlock audio
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0; // Silent
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.start();
                    oscillator.stop(0.01);
                    
                    audioInitialized = true;
                    console.log('Audio fully initialized with silent sound');
                }
            } catch (e) {
                console.warn('Failed to unlock AudioContext:', e);
            }
        };
        
        // Unlock on first user interaction
        const events = ['click', 'touchstart', 'keydown', 'mousedown'];
        events.forEach(event => {
            document.addEventListener(event, unlockAudioContext, { once: true });
        });
        
        // Also try to unlock on page load
        window.addEventListener('load', () => {
            setTimeout(unlockAudioContext, 1000);
        });
    }
    
    unlockAudio();
    
    // Force audio initialization when Unity instance is ready
    window.addEventListener('load', () => {
        // Add a click listener to the unity container to force audio unlock
        const unityContainer = document.getElementById('unity-container');
        if (unityContainer) {
            unityContainer.addEventListener('click', async () => {
                try {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext && (!audioContext || audioContext.state === 'suspended')) {
                        audioContext = audioContext || new AudioContext();
                        await audioContext.resume();
                        console.log('AudioContext forced unlock on click');
                    }
                } catch (e) {
                    console.warn('Failed to force audio unlock:', e);
                }
            });
        }
    });
    
    // Patch Unity's audio loading to handle missing sounds gracefully
    const originalLog = console.error;
    console.error = function(...args) {
        if (typeof args[0] === 'string' && args[0].includes('Trying to get length of sound which is not loaded')) {
            console.warn('Audio loading issue detected - sound file may be missing or not loaded yet');
            return; // Suppress this specific error
        }
        originalLog.apply(console, args);
    };
    
    // Add audio context monitoring
    setInterval(() => {
        if (audioContext && audioContext.state === 'suspended') {
            console.warn('AudioContext is suspended, attempting to resume...');
            audioContext.resume().catch(e => console.warn('Failed to resume AudioContext:', e));
        }
    }, 5000);
})();