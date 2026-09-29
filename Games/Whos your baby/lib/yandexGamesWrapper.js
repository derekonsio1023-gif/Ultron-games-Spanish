class YandexGamesWrapper {

	constructor(readyCallback) {
		this.wrapperSDK = null;
		// Advertisement fields.
		this.bannerVisible = false;
		this.interstitialVisible = false;
		this.rewardedVisible = false;
		// Payments fields.
		this.wrapperPayments = null;
		this.cacheProductsData = "";
		this.cachePaymentsData = "";
		// Prefs fields.
		this.jsonContainers = runtimeData.prefsContainerTags;
		this.cacheContainers = {};
		// Flags fields.
		this.flags = {};
		// Leaderboard fields.
		this.leaderboards = {};
		// Wrapper initialization.
		console.log("Wrapper initialization started.");
				try {
			const inYandexFrame = (window.self !== window.top);
				const handleSdkAvailable = () => {
    // Si no estamos en iframe, forzamos mock SIEMPRE, ignorando cualquier YaGames previo.
    const inYandexFrame = (window.self !== window.top);
    if (!inYandexFrame) {
        console.warn("[Wrapper] Fuera del iframe de Yandex. Forzando mock local.");
        window.YaGames = createLocalMockYaGames();
    } else if (typeof window.YaGames === 'undefined') {
        console.warn("[Wrapper] YaGames no existe en iframe. Activando mock de emergencia.");
        window.YaGames = createLocalMockYaGames();
    }

    YaGames.init().then(ysdk => {
        // Validación: si el SDK viene vacío o sin métodos clave, sustituimos por mock.
        if (!ysdk || typeof ysdk.getPayments !== 'function') {
            console.error("[Wrapper] SDK inválido o vacío. Sustituyendo por mock.");
            console.error("[Wrapper] Métodos del SDK recibido:", Object.keys(ysdk || {}));
            ysdk = createLocalMockYaGames().init.__mockSdk || createLocalMockYaGames();
            // ↑ Si no expones __mockSdk, usa la línea de abajo en su lugar:
            // return; // o fuerza un mock distinto aquí
        }

        console.log("SDK initialized successfully.");
        this.wrapperSDK = ysdk;
        this.resolvePayments().then(() => {
            console.log("SDK payments resolved successfully.");
            this.resolveSaves().then(() => {
                console.log("SDK saves resolved successfully.");
                this.resolveFlags().then(() => {
                    console.log("SDK flags resolved successfully.");
                    this.resolveLeaderboards().then(() => {
                        console.log("SDK leaderboards resolved successfully.");
                        console.log("Wrapper initialization completed.");
						readyCallback();                        // El juego arranca primero
						
						// Solo ejecutar preroll si estamos en el iframe real de Yandex
						// En desarrollo local, el preroll simulado destruye los AudioSources
						const inYandexFrame = (window.self !== window.top);
						if (inYandexFrame) {
							console.log("[Wrapper] En iframe de Yandex, ejecutando preroll real");
							setTimeout(() => this.invokeInterstitial(), 3000);  // Anuncio 3s después
						} else {
							console.log("[Wrapper] Fuera de iframe (desarrollo local), omitiendo preroll para preservar audio");
						}
                    });
                });
            });
        });
    }).catch((exception) => {
        console.error("Wrapper initialization failed.", exception);
        readyCallback();
    });
};

			if (!inYandexFrame) {
				console.warn("[Wrapper] Fuera del iframe de Yandex. Usando mock local.");
				handleSdkAvailable();
			} else {
				let script = document.createElement("script");
				script.src = runtimeData.yandexGamesSDK;
				script.onload = handleSdkAvailable;
				script.onerror = () => {
					console.warn("[Wrapper] No se pudo cargar el SDK de Yandex. Activando mock local.");
					handleSdkAvailable();
				};
				document.body.appendChild(script);
			}
		}
		catch (exception) {
			console.error("Wrapper initialization failed.", exception);
			readyCallback();
		}
	}
	// Banner advertisement methods.

	isBannerVisible() {
		return this.bannerVisible;
	}

	invokeBanner() {
		console.log("Invoke banner called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.adv.getBannerAdvStatus().then(({ stickyAdvIsShowing, reason }) => {
					this.bannerVisible = stickyAdvIsShowing;
					if (stickyAdvIsShowing) {
						console.log("Banner is already visible.");
						reject(stickyAdvIsShowing);
					} else if (reason) {
						// Currently not visible, there is a reason for that.
						console.log("Banner is not visible." + reason);
						reject(reason);
					} else {
						console.log("Banner should be visible now.");
						this.wrapperSDK.adv.showBannerAdv().then(() => {
							resolve(refreshBannerStatus());
						});
					}
				});
			}
			catch (exception) {
				console.error("Invoke banner failed.", exception);
				reject(exception);
			}
		});
	}

	disableBanner() {
		console.log("Disable banner called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.adv.getBannerAdvStatus().then(({ stickyAdvIsShowing, reason }) => {
					this.bannerVisible = stickyAdvIsShowing;
					if (stickyAdvIsShowing) {
						console.log("Banner should be hidden now.");
						this.wrapperSDK.adv.hideBannerAdv().then(() => {
							resolve(refreshBannerStatus());
						});
					} else if (reason) {
						// Currently not visible, there is a reason for that.
						console.log("Banner is not visible." + reason);
						reject(reason);
					} else {
						console.log("Banner is not visible already.");
						reject(stickyAdvIsShowing);
					}
				});
			}
			catch (exception) {
				console.error("Disable banner failed.", exception);
				reject(exception);
			}
		});
	}

	refreshBannerStatus() {
		console.log("Refresh banner status called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.adv.getBannerAdvStatus().then(({ stickyAdvIsShowing }) => {
					this.bannerVisible = stickyAdvIsShowing;
					resolve(stickyAdvIsShowing);
				});
			}
			catch (exception) {
				console.error("Refresh banner status failed.", exception);
				reject(exception);
			}
		});
	}

	// Interstitial advertisement methods.

	isInterstitialVisible() {
		return this.interstitialVisible;
	}

	invokeInterstitial() {
		console.log("Invoke interstitial called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.adv.showFullscreenAdv({
					callbacks: {
						// Called when the ad is opened successfully.
						onOpen: () => {
							console.log("Interstitial event: onOpen.");
							this.interstitialVisible = true;
							application.publishEvent("OnInterstitialEvent", "Begin");
						},
						// Called when the ad closes, after an error, or after an ad failed to open due to too frequent calls. 
						// It's used with the wasShown argument (boolean type), the value of which indicates whether the ad was shown or not.
						onClose: (wasShown) => {
							console.log("Interstitial event: onClose.");
							this.interstitialVisible = false;
							application.publishEvent("OnInterstitialEvent", "Close");

							// Forzar reanudación del AudioContext (Unity lo deja suspendido tras el preroll)
							try {
								// Intentar múltiples rutas para encontrar el AudioContext de Unity
								const fw = window.unityFramework;
								let ctx = fw?.audioContext
										|| fw?.SDL2?.audioContext
										|| fw?.WebAudio?.audioContext
										|| window.AudioContext
										|| window.webkitAudioContext;
								
								// Buscar en el Module de Unity si está disponible
								if (!ctx && window.Module) {
									ctx = window.Module.AudioContext || window.Module.ccall?.('SDL2AudioContext');
								}
								
								if (ctx) {
									console.log('[Audio] AudioContext encontrado:', ctx.state);
									if (ctx.state === 'suspended') {
										ctx.resume().then(() => {
											console.log('[Audio] AudioContext resumido tras preroll');
											// Forzar recreación de AudioSources si Unity los destruyó
											setTimeout(() => {
												if (application && application.publishEvent) {
													application.publishEvent("OnAudioReinitialize", "true");
												}
											}, 100);
										}).catch(e => {
											console.warn('[Audio] Error al reanudar AudioContext:', e);
										});
									} else {
										console.log('[Audio] AudioContext ya está activo:', ctx.state);
									}
								} else {
									console.warn('[Audio] No se encontró AudioContext en ningún lugar');
								}
							} catch (e) {
								console.warn('[Audio] No se pudo reanudar AudioContext:', e);
							}
							
							// Forzar la carga de audio después del preroll
							setTimeout(() => {
								try {
									if (window.unityInstance && window.unityInstance.SendMessage) {
										console.log('[Audio] Forzando recarga de audio en Unity');
										window.unityInstance.SendMessage("AudioManager", "ReloadAudio");
									}
								} catch (e) {
									console.warn('[Audio] No se pudo forzar recarga de audio:', e);
								}
							}, 200);
						}
					}
				});
				resolve();
			}
			catch (exception) {
				console.error("Invoke interstitial failed.", exception);
				application.publishEvent("OnInterstitialEvent", "Error");
				reject(exception);
			}
		});
	}

	// Rewarded advertisement methods.

	isRewardedVisible() {
		return this.rewardedVisible;
	}

	invokeRewarded() {
		console.log("Invoke rewarded called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.adv.showRewardedVideo({
					callbacks: {
						// Called when the video ad is shown on the screen.
						onOpen: () => {
							console.log("Rewarded event: onOpen.");
							this.rewardedVisible = true;
							application.publishEvent("OnRewardedEvent", "Begin");
						},
						// Called when a video ad impression is counted.
						onRewarded: () => {
							console.log("Rewarded event: onRewarded.");
							application.publishEvent("OnRewardedEvent", "Success");
						},
						// Called when the video ad closes.
						onClose: () => {
							console.log("Rewarded event: onClose.");
							this.rewardedVisible = false;
							application.publishEvent("OnRewardedEvent", "Close");
						},
						// Called when an error occurs. The error object is passed to the callback function.
						onError: (error) => {
							console.error("Rewarded event: onError.", error);
							application.publishEvent("OnRewardedEvent", "Error");
						}
					}
				});
				resolve();
			}
			catch (exception) {
				console.error("Invoke rewarded failed.", exception);
				application.publishEvent("OnRewardedEvent", "Error");
				reject(exception);
			}
		});
	}

	// Payments methods.

	resolvePayments() {
		console.log("Payments resolving started.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.getPayments().then(payments => {
					console.log("Payments resolved successfully.");
					this.wrapperPayments = payments;
					// Cache products before game loading.
					this.resolveServerProducts().then(() => {
						// Cache purchases before game loading.
						this.resolveServerPurchases().then(() => {
							// Payments are preloaded and ready.
							resolve(payments);
						});
					});
				});
			}
			catch (exception) {
				console.error("Payments resolving failed.", exception);
				reject(exception);
			}
		});
	}

	invokePurchase(productTag) {
		console.log("Invoke purchase called.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperPayments.purchase(productTag).then(() => {
					console.log("Purchase made successfully.");
					application.publishEvent("OnPurchaseEvent", "Success");
					resolve(productTag);
				}).catch(exception => {
					console.error("Purchase failed.", exception);
					application.publishEvent("OnPurchaseEvent", "Error");
					reject(exception);
				});
			}
			catch (exception) {
				console.error("Purchase failed.", exception);
				application.publishEvent("OnPurchaseEvent", "Error");
				reject(exception);
			}
		});
	}

	resolveServerProducts() {
		console.log("Server products caching started.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperPayments.getCatalog().then(products => {
					let callbackProductData = [];
					for (let x = 0; x < products.length; x++) {
						callbackProductData.push({
							"productTag": products[x].id,
							"priceValue": products[x].priceValue,
							"priceCurrency": products[x].priceCurrencyCode
						});
						console.log("Cache server product:", products[x]);
					}
					this.cacheProductsData = JSON.stringify(callbackProductData);
					application.publishEvent("OnResolveProducts", "Success");
					resolve(products);
				});
			}
			catch (exception) {
				console.error("Server products caching failed.", exception);
				application.publishEvent("OnResolveProducts", "Error");
				reject(exception);
			}
		});
	}

	resolveServerPurchases() {
		console.log("Server purchases caching started.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperPayments.getPurchases().then(purchases => {
					let callbackPurchaseData = [];
					for (let x = 0; x < purchases.length; x++) {
						callbackPurchaseData.push({
							"productTag": purchases[x].productID
						});
					}
					this.cachePurchasesData = JSON.stringify(callbackPurchaseData);
					application.publishEvent("OnResolvePurchases", "Success");
					resolve(purchases);
				});
			}
			catch (exception) {
				console.error("Server purchases caching failed.", exception);
				application.publishEvent("OnResolvePurchases", "Error");
				reject(exception);
			}
		});
	}

	resolveCacheProducts() {
		return this.cacheProductsData;
	}

	resolveCachePurchases() {
		return this.cachePurchasesData;
	}

	// Player methods.

	resolvePlayer() {
		console.log("Player resolving started.");
		return new Promise((resolve, reject) => {
			try {
				this.wrapperSDK.getPlayer({ scopes: false }).then(player => {
					console.log("Player resolved successfully.");
					resolve(player);
				});
			}
			catch (exception) {
				console.log("Player resolve failed.", exception);
				reject(exception);
			}
		});
	}

	// Saves methods.

	resolveSaves() {
		console.log("Saves resolving started.");
		return new Promise((resolve, reject) => {
			try {
				this.resolvePlayer().then(player => {
					player.getData(this.jsonContainers).then(data => {
						for (let x = 0; x < this.jsonContainers.length; x++) {
							let containerString = "";
							if (data[this.jsonContainers[x]] != null) {
								console.log("Resolve saves for container: " + this.jsonContainers[x] + " success");
								containerString = data[this.jsonContainers[x]];
							}
							else {
								console.log("Resolve saves for container: " + this.jsonContainers[x] + " is empty");
								containerString = "Empty";
							}
							this.cacheContainers[this.jsonContainers[x]] = containerString;
						}
						console.log("Saves resolving success.");
						application.publishEvent("OnResolveSaves", "Success");
						resolve(data);
					});
				});
			}
			catch (exception) {
				console.error("Saves resolving failed.", exception);
				application.publishEvent("OnResolveSaves", "Error");
				reject(exception);
			}
		});
	}

	writeSaves() {
		console.log("Write saves called.");
		return new Promise((resolve, reject) => {
			try {
				this.resolvePlayer().then(player => {
					let data = {};
					for (let x = 0; x < this.jsonContainers.length; x++) {
						data[this.jsonContainers[x]] = this.cacheContainers[this.jsonContainers[x]];
					}
					player.setData(data, true).then(() => {
						console.log("Saves written successfully.");
						application.publishEvent("OnWriteSaves", "Success");
						resolve();
					});
				});
			}
			catch (exception) {
				console.error("Write saves failed.", exception);
				application.publishEvent("OnWriteSaves", "Error");
				reject(exception);
			}
		});
	}

	resolveCacheSaves(containerTag) {
		console.log("Resolve cache saves called.");
		let containerJSON = this.cacheContainers[containerTag];
		if (containerJSON == null) {
			return "Empty";
		}
		return containerJSON;
	}

	writeCacheSaves(containerTag, json) {
		console.log("Write cache saves called.");
		try {
			this.cacheContainers[containerTag] = json;
			console.log("Cache saves written successfully.");
		}
		catch (exception) {
			console.error("Cache saves write failed.", exception);
		}
	}

	// Language methods.

	resolveLanguage() {
		console.log("Resolve language called.");
		try {
			return this.wrapperSDK.environment.i18n.lang;
		}
		catch (exception) {
			console.error("Resolve language failed.", exception);
			return "en";
		}
	}

	// Analytics methods.

	gameIsReady() {
		console.log("Game is ready called.");
		try {
			if (this.wrapperSDK.features.LoadingAPI) {
				this.wrapperSDK.features.LoadingAPI.ready();
			}
		}
		catch (exception) {
			console.error("Game is ready report failed.", exception);
		}
	}

	gameplayStart() {
		console.log("Gameplay start report called.");
		try {
			this.wrapperSDK.features.GameplayAPI.start();
		}
		catch (exception) {
			console.error("Gameplay start report failed.", exception);
		}
	}

	gameplayStop() {
		console.log("Gameplay stop report called.");
		try {
			this.wrapperSDK.features.GameplayAPI.stop();
		}
		catch (exception) {
			console.error("Gameplay stop report failed.", exception);
		}
	}

	// Socials methods.

	resolveLeaderboards() {
		console.log("Resolve leaderboards called.");
		return new Promise((resolve, reject) => {
			this.wrapperSDK.getLeaderboards().then(leaderboards => {
				console.log("Leaderboards resolved successfully.");
				this.leaderboards = leaderboards;
				resolve(leaderboards);
			}).catch(exception => {
				console.error("Resolve leaderboards failed.", exception);
				reject(exception);
			});
		});
	}

	getScore(scoreTag) {
		console.log("Get score called.");
		try {
			this.wrapperSDK.getLeaderboards().then(leaderboards => {
				leaderboards.getLeaderboardPlayerEntry(scoreTag).then(leaderboard => {
					console.log("Get score success.", leaderboard.score);
					application.publishEvent("OnResolveScoreValue", leaderboard.score);
				}).catch(exception => {
					console.error("Get score failed.", exception);
					application.publishEvent("OnScoreValueError", exception);
				});
			});
		}
		catch (exception) {
			console.error("Get score failed.", exception);
			application.publishEvent("OnScoreValueError", exception);
		}
	}

	setScore(scoreTag, scoreValue) {
		console.log("Set score called.");
		try {
			this.wrapperSDK.getLeaderboards().then(leaderboards => {
				leaderboards.setLeaderboardScore(scoreTag, scoreValue).then(() => {
					console.log("Set score success.", scoreValue);
				}).catch(exception => {
					console.error("Get score failed.", exception);
					application.publishEvent("OnScoreValueError", exception);
				});
			});
		}
		catch (exception) {
			console.error("Get score failed.", exception);
			application.publishEvent("OnScoreValueError", exception);
		}
	}

	getScoreTable(scoreTag, leadingPlayers, includePlayer, playersAround) {
		console.log("Get score table called.");
		try {
			this.wrapperSDK.getLeaderboards().then(leaderboards => {
				leaderboards.getLeaderboardEntries(scoreTag, { quantityTop: leadingPlayers, includeUser: includePlayer, quantityAround: playersAround }).then(leaderboard => {
					let dataArray = [];
					for (let x = 0; x < leaderboard.entries.length; x++) {
						let entry = leaderboard.entries[x];
						dataArray.push({
							name: entry.player.publicName,
							position: entry.rank,
							score: entry.score,
							pictureURL: entry.player.getAvatarSrc("medium")
						});
					}
					let jsonString = JSON.stringify(dataArray);
					console.log("Get score table success.", jsonString);
					application.publishEvent("OnResolveScoreTable", jsonString);
				}).catch(exception => {
					this.onScoreTableError(exception);
				});
			}).catch(exception => {
				this.onScoreTableError(exception);
			});
		}
		catch (exception) {
			this.onScoreTableError(exception);
		}
	}

	onScoreTableError(exception) {
		console.error("Get score table failed.", exception);
		application.publishEvent("OnScoreTableError", "Error");
	}

	requestGameRating() {
		console.log("Request game rating called.");
		try {
			this.wrapperSDK.feedback.canReview().then(({ value, reason }) => {
				if (value) {
					this.wrapperSDK.feedback.requestReview().then(({ feedbackSent }) => {
						console.log(feedbackSent);
					});
				} else {
					console.log(reason);
				}
			});
		}
		catch (exception) {
			console.error("Request game rating failed.", exception);
		}
	}

	// Flags.

	resolveFlags() {
		console.log("Resolve flags called.");
		return new Promise((resolve, reject) => {
            try {
				this.wrapperSDK.getFlags().then(flags => {
					this.flags = flags;
					resolve(flags);
				});
            }
            catch (exception) {
                console.error("Flags resolving failed.", exception);
                reject(exception);
            }
        });
	}

	flagsGetValue(key) {
		return this.flags[key];
	}

	flagsHasKey(key) {
		try {
			return this.flags[key] != null;
		}
		catch {
			return false;
		}
	}

}

export function initialize(readyCallback) {
	if (typeof window !== 'undefined') {
		window.yandexGamesWrapper = new YandexGamesWrapper(readyCallback);
	}
}

// ============================================================
// MOCK del SDK de Yandex para desarrollo local (fuera de iframe).
// ============================================================
function createLocalMockYaGames() {
    const noop = () => Promise.resolve();

    const mockPlayer = {
        getName: () => 'TestPlayer',
        getUniqueID: () => 'mock-uid-123',
        getMode: () => 'lite',
        getPhoto: () => '',
        getData: () => Promise.resolve({}),
        setData: noop,
        getStats: () => Promise.resolve({}),
        setStats: noop,
        getInventory: () => Promise.resolve({})
    };

    const mockSdk = {
        environment: {
            i18n: { lang: 'es', tld: 'com' },
            app: { id: 'mock-app-id' },
            browser: {},
            payload: ''
        },
        features: {
            LoadingAPI:  { ready: () => console.log('[Mock] LoadingAPI.ready') },
            GameplayAPI: {
                start: () => console.log('[Mock] GameplayAPI.start'),
                stop:  () => console.log('[Mock] GameplayAPI.stop')
            }
        },
        getPlayer: () => Promise.resolve(mockPlayer),
        getPayments: () => Promise.resolve({
            purchase: () => Promise.resolve({ purchaseToken: 'mock' }),
            getPurchases: () => Promise.resolve([]),
            getCatalog: () => Promise.resolve([]),
            consumePurchase: noop
        }),
        getLeaderboards: () => Promise.resolve({
            setLeaderboardScore: noop,
            getLeaderboardPlayerEntry: () => Promise.reject(new Error('mock: sin entrada')),
            getLeaderboardEntries: () => Promise.resolve({ entries: [] }),
            getLeaderboards: () => Promise.resolve([])
        }),
        getFlags: () => Promise.resolve({}),
        auth: { openAuthDialog: noop },
        adv: {
            showFullscreenAdv: ({ callbacks } = {}) => {
                const inYandexFrame = (window.self !== window.top);
                
                if (!inYandexFrame) {
                    // En desarrollo local, no ejecutar preroll para evitar destrucción de AudioSources
                    console.log('[Mock] showFullscreenAdv - OMITIDO en desarrollo local para preservar audio');
                    callbacks?.onClose?.(false); // Indicar que no se mostró
                    return Promise.resolve();
                }
                
                console.log('[Mock] showFullscreenAdv');
                callbacks?.onOpen?.();
                setTimeout(() => callbacks?.onClose?.(true), 100);
            },
            showRewardedVideo: ({ callbacks } = {}) => {
                console.log('[Mock] showRewardedVideo');
                callbacks?.onOpen?.();
                setTimeout(() => {
                    callbacks?.onRewarded?.();
                    callbacks?.onClose?.();
                }, 100);
            },
            getBannerAdvStatus: () => Promise.resolve({ stickyAdvIsShowing: false, reason: '' }),
            showBannerAdv: noop,
            hideBannerAdv: noop
        },
        feedback: {
            canReview: () => Promise.resolve({ value: false, reason: 'mock' }),
            requestReview: noop
        },
        shortcut: {
            canShowPrompt: () => Promise.resolve({ canShow: false }),
            showPrompt: noop
        },
        screen: {
            fullscreen: { status: 'off', request: noop, exit: noop }
        },
        safeStorage: {
            set: noop,
            get: () => Promise.resolve(null)
        }
    };

    // Expone el SDK para poder accederlo directamente si hace falta.
    const api = {
        init: () => {
            console.log('[Mock] YaGames.init()');
            return Promise.resolve(mockSdk);
        }
    };
    api.__mockSdk = mockSdk;
    return api;
}