const application = (function () {

    let canvas = document.querySelector("#unity-canvas");
    let loadingBar = document.querySelector("#unity-loading-bar");
    let progressBarFull = document.querySelector("#unity-progress-bar-full");

    function bannerException(message, type) {
        if (type == "error") {
            console.error(message);
            return;
        }
        console.warn(message);
    }

    let config = {
        arguments: [],
        dataUrl: runtimeData.dataURL,
        frameworkUrl: runtimeData.frameworkURL,
        workerUrl: runtimeData.workerURL,
        codeUrl: runtimeData.codeURL,
        symbolsUrl: runtimeData.symbolsURL,
        streamingAssetsUrl: runtimeData.streamingURL || "StreamingAssets",
        companyName: runtimeData.companyName,
        productName: runtimeData.productName,
        productVersion: runtimeData.productVersion,
        showBanner: bannerException,
    };

    let instance = null;

    return {

        initialize: function () {
            let script = document.createElement("script");
            script.src = runtimeData.loaderURL;
            script.onload = () => {
                createUnityInstance(canvas, config, (progress) => {
                    progressBarFull.style.width = 100 * progress + "%";
                }).then((unityInstance) => {
                    instance = unityInstance;
                    loadingBar.style.display = "none";
                    
                    // Force audio initialization after Unity instance is ready
                    setTimeout(() => {
                        try {
                            if (unityInstance && unityInstance.Module) {
                                const audioContext = unityInstance.Module.AudioContext || 
                                                   unityInstance.Module.SDL2?.audioContext ||
                                                   unityInstance.Module.WebAudio?.audioContext;
                                if (audioContext && audioContext.state === 'suspended') {
                                    audioContext.resume().then(() => {
                                        console.log('Unity AudioContext forced resume');
                                    }).catch(e => {
                                        console.warn('Failed to resume Unity AudioContext:', e);
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn('Audio initialization check failed:', e);
                        }
                    }, 500);
                    
                    if (runtimeData.debugMode == true) {
                        diagnosticsIcon.style.display = "block";
                        diagnosticsIcon.style.position = "fixed";
                        diagnosticsIcon.style.bottom = "10px";
                        diagnosticsIcon.style.right = "0px";
                        canvas.after(diagnosticsIcon);
                        diagnosticsIcon.onclick = () => {
                            unityDiagnostics.openDiagnosticsDiv(unityInstance.GetMetricsInfo);
                        };
                    }
                }).catch((message) => {
                    console.error(message);
                    alert(message);
                });
            };
            document.body.appendChild(script);
        },

        publishEvent(methodName, stringValue) {
            if (instance == null || instance == undefined) return;
            instance.SendMessage("JSCallbacks", methodName, stringValue);
        },

        isMobile() {
            return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        },

    }

})();