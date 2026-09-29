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
		// Player fields.
		this.playerLogin = false;
		// Wrapper initialization.
		console.log("Wrapper initialization started.");
			try {
				// Detect if we are running inside the Yandex Games iframe (production) or locally (development).
				const inYandexFrame = (window.self !== window.top);

				// Handler común: se ejecuta cuando el SDK real carga O cuando falla.
				const handleSdkAvailable = () => {
					if (typeof window.YaGames === 'undefined') {
						console.warn("[Wrapper] YaGames no está definido (probablemente fuera del iframe de Yandex). Activando mock local.");
						window.YaGames = createLocalMockYaGames();
					}
					YaGames.init().then(ysdk => {
						console.log("SDK initialized successfully.");
						this.wrapperSDK = ysdk;
						// Cache payments.
						this.resolvePayments().then(() => {
							console.log("SDK payments resolved successfully.");
							// Cache saves.
							this.resolveSaves().then(() => {
								console.log("SDK saves resolved successfully.");
								this.resolveFlags().then(() => {
									console.log("SDK flags resolved successfully.");
									this.resolvePlayer().then(player => {
										console.log("SDK player resolved successfully.");
										if (player.getMode() === 'lite') {
											this.playerLogin = false;
										} else {
											this.playerLogin = true;
										}
										this.resolveLeaderboards().then(() => {
											console.log("SDK leaderboards resolved successfully.");
											console.log("Wrapper initialization completed.");
											this.invokeInterstitial();
											readyCallback();
										});
									});
								});
							});
						});
					}).catch((exception) => {
						console.error("Wrapper initialization failed.", exception);
						readyCallback();
					});
				};

				if (inYandexFrame) {
					// Production: load the official Yandex Games SDK from inside the platform iframe.
					let script = document.createElement("script");
					script.src = runtimeData.yandexGamesSDK;
					script.onload = handleSdkAvailable;
					// Si el script ni siquiera carga (red caída, bloqueado), también arrancamos.
					script.onerror = () => {
						console.warn("[Wrapper] No se pudo cargar el SDK de Yandex. Activando mock local.");
						handleSdkAvailable();
					};
					document.body.appendChild(script);
				}
				else {
					// Local development: never request sdk.js (it does not exist outside the Yandex iframe).
					console.log("[Wrapper] Fuera del iframe de Yandex. Usando mock local.");
					handleSdkAvailable();
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
						},
						// Called when an error occurs. The error object is passed to the callback function.
						onError: (error) => {
							console.error("Interstitial event: onError.", error);
							this.interstitialVisible = false;
							application.publishEvent("OnInterstitialEvent", "Error");
						},
						// Called when the network connection is lost (switching to offline mode).
						onOffline: () => {
							console.log("Interstitial event: onOffline.");
							application.publishEvent("OnInterstitialEvent", "Offline");
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
					application.publishEvent("ScorePlatformEvent", leaderboard.score);
				}).catch(exception => {
					console.error("Get score failed.", exception);
					application.publishEvent("ScorePlatformEvent", "Error");
				});
			});
		}
		catch (exception) {
			console.error("Get score failed.", exception);
			application.publishEvent("ScorePlatformEvent", "Error");
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
					// application.publishEvent("OnScoreValueError", "Error");
				});
			});
		}
		catch (exception) {
			console.error("Get score failed.", exception);
			// application.publishEvent("OnScoreValueError", "Error");
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
						let arrayData = {
							name: entry.player.publicName,
							position: entry.rank,
							score: entry.score,
							pictureURL: entry.player.getAvatarSrc("medium")
						};
						dataArray.push(arrayData);
					}
					let jsonString = JSON.stringify(dataArray);
					console.log("Get score table success.", jsonString);
					application.publishEvent("ScoreTablePlatformEvent", jsonString);
				}).catch(exception => {
					this.onScoreTableError(exception);
				});
			}).catch(exception => {
				this.onScoreTableError(exception);
			});
		} catch (exception) {
			this.onScoreTableError(exception);
		}
	}

	onScoreTableError(exception) {
		console.error("Get score table failed.", exception);
		application.publishEvent("ScoreTablePlatformEvent", "Error");
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

	// Player login methods.

	invokePlayerLogin() {
		console.log("Invoke player login called.");
		this.resolvePlayer().then(player => {
			if (player.getMode() === 'lite') {
				// Player is not authorized.
				console.log("Player is not authorized.");
				this.wrapperSDK.auth.openAuthDialog().then(() => {
					// Player is authorized.
					console.log("Player is authorized.");
					application.publishEvent("LoginPlatformEvent", "Success");
				}).catch(() => {
					// Player is not authorized.
					console.log("Player is not authorized.");
					application.publishEvent("LoginPlatformEvent", "Error");
				});
			}
			else {
				// Player is already authorized.
				console.log("Player is already authorized.");
				application.publishEvent("LoginPlatformEvent", "Success");
			}
		});
	}

}

function initializeWrapper() {
	if (typeof window !== 'undefined') {
		window.yandexGamesWrapper = new YandexGamesWrapper(() => {
			// Application initialization on wrapper ready callback.
			application.initialize();
		});
	}
}

// Local mock of the Yandex Games SDK.
// It is created ONLY when the wrapper runs outside the Yandex Games iframe (local development),
// so the game can be tested locally without the "sdk.js" 404 of the platform loader.
// In production (inside the Yandex iframe) window.YaGames is defined by the official SDK
// and this mock is never used.
function createLocalMockYaGames() {
	const mockLog = (message, ...args) => console.log("[Mock] " + message, ...args);

	// Language reported by the mock (browser language, "en" as fallback).
	let mockLanguage = "en";
	try {
		if (typeof navigator !== "undefined" && navigator.language != null) {
			mockLanguage = navigator.language.split("-")[0];
		}
	}
	catch (exception) {
		console.warn("[Mock] Language resolving failed.", exception);
	}

	// Player data, purchases and safe storage are kept in memory during the session.
	const mockPlayerData = {};
	const mockPurchases = [];
	const mockSafeStorage = {};
	const mockCatalog = [
		{ id: "mock_product_1", title: "Mock product 1", priceValue: "1", priceCurrencyCode: "USD" },
		{ id: "mock_product_2", title: "Mock product 2", priceValue: "5", priceCurrencyCode: "USD" }
	];

	// Player object returned by the mock.
	const mockPlayer = {
		getName: () => "MockPlayer",
		getUniqueID: () => "mock-player-id",
		getMode: () => "lite",
		getPhoto: () => "",
		getData: (keys) => {
			mockLog("player.getData()", keys);
			let data = {};
			if (Array.isArray(keys)) {
				for (let x = 0; x < keys.length; x++) {
					if (mockPlayerData[keys[x]] != null) {
						data[keys[x]] = mockPlayerData[keys[x]];
					}
				}
			}
			return Promise.resolve(data);
		},
		setData: (data, flush) => {
			mockLog("player.setData()", data, "flush:", flush === true);
			for (let key in data) {
				mockPlayerData[key] = data[key];
			}
			return Promise.resolve();
		},
		getStats: () => Promise.resolve({}),
		setStats: (stats) => {
			mockLog("player.setStats()", stats);
			return Promise.resolve();
		},
		getInventory: () => Promise.resolve([])
	};
	// SDK object resolved by the mock YaGames.init() call.
	const mockSdk = {

		environment: {
			i18n: {
				lang: mockLanguage,
				tld: "com"
			},
			app: {
				id: "mock-app-id"
			},
			browser: {
				lang: mockLanguage
			},
			payload: ""
		},

		features: {
			LoadingAPI: {
				ready: () => {
					mockLog("features.LoadingAPI.ready()");
				}
			},
			GameplayAPI: {
				start: () => {
					mockLog("features.GameplayAPI.start()");
				},
				stop: () => {
					mockLog("features.GameplayAPI.stop()");
				}
			}
		},

		getPlayer: (options) => {
			mockLog("getPlayer()", options);
			return Promise.resolve(mockPlayer);
		},

		getPayments: (options) => {
			mockLog("getPayments()", options);
			return Promise.resolve({
				purchase: (productTag) => {
					mockLog("payments.purchase()", productTag);
					mockPurchases.push({ productID: productTag, purchaseToken: "mock-purchase-token" });
					return Promise.resolve({ productID: productTag, purchaseToken: "mock-purchase-token" });
				},
				getPurchases: () => {
					mockLog("payments.getPurchases()");
					return Promise.resolve(mockPurchases.slice());
				},
				getCatalog: () => {
					mockLog("payments.getCatalog()");
					return Promise.resolve(mockCatalog.slice());
				},
				consumePurchase: (purchaseToken) => {
					mockLog("payments.consumePurchase()", purchaseToken);
					return Promise.resolve();
				}
			});
		},

		getLeaderboards: () => {
			mockLog("getLeaderboards()");
			return Promise.resolve({
				setLeaderboardScore: (scoreTag, scoreValue) => {
					mockLog("leaderboards.setLeaderboardScore()", scoreTag, scoreValue);
					return Promise.resolve();
				},
				// The mock player has no leaderboard entry, so this call is rejected, like in the real SDK.
				getLeaderboardPlayerEntry: (scoreTag) => {
					mockLog("leaderboards.getLeaderboardPlayerEntry()", scoreTag);
					return Promise.reject(new Error("[Mock] The player has no entry in the leaderboard: " + scoreTag));
				},
				getLeaderboardEntries: (scoreTag, options) => {
					mockLog("leaderboards.getLeaderboardEntries()", scoreTag, options);
					return Promise.resolve({ entries: [] });
				},
				getLeaderboards: () => {
					mockLog("leaderboards.getLeaderboards()");
					return Promise.resolve([]);
				}
			});
		},

		getFlags: (options) => {
			mockLog("getFlags()", options);
			return Promise.resolve({});
		},

		auth: {
			openAuthDialog: () => {
				mockLog("auth.openAuthDialog()");
				return Promise.resolve();
			}
		},

		adv: {
			showFullscreenAdv: ({ callbacks } = {}) => {
				mockLog("adv.showFullscreenAdv()");
				if (callbacks && callbacks.onOpen) {
					callbacks.onOpen();
				}
				// The interstitial ad closes 100 ms later, like the real one.
				setTimeout(() => {
					if (callbacks && callbacks.onClose) {
						callbacks.onClose(true);
					}
				}, 100);
			},
			showRewardedVideo: ({ callbacks } = {}) => {
				mockLog("adv.showRewardedVideo()");
				if (callbacks && callbacks.onOpen) {
					callbacks.onOpen();
				}
				// The rewarded video is watched and closes 100 ms later, like the real one.
				setTimeout(() => {
					if (callbacks && callbacks.onRewarded) {
						callbacks.onRewarded();
					}
					if (callbacks && callbacks.onClose) {
						callbacks.onClose();
					}
				}, 100);
			},
			getBannerAdvStatus: () => {
				mockLog("adv.getBannerAdvStatus()");
				return Promise.resolve({ stickyAdvIsShowing: false, reason: "" });
			},
			showBannerAdv: () => {
				mockLog("adv.showBannerAdv()");
				return Promise.resolve();
			},
			hideBannerAdv: () => {
				mockLog("adv.hideBannerAdv()");
				return Promise.resolve();
			}
		},

		feedback: {
			canReview: () => {
				mockLog("feedback.canReview()");
				return Promise.resolve({ value: false, reason: "The review dialog is not available in the local mock." });
			},
			requestReview: () => {
				mockLog("feedback.requestReview()");
				return Promise.resolve({ feedbackSent: false });
			}
		},

		shortcut: {
			canShowPrompt: () => Promise.resolve({ canShow: false }),
			showPrompt: () => {
				mockLog("shortcut.showPrompt()");
				return Promise.resolve({ outcome: "rejected" });
			}
		},

		screen: {
			fullscreen: {
				status: "off",
				request: () => {
					mockLog("screen.fullscreen.request()");
					return Promise.resolve();
				},
				exit: () => {
					mockLog("screen.fullscreen.exit()");
					return Promise.resolve();
				}
			}
		},

		safeStorage: {
			set: (key, value) => {
				mockLog("safeStorage.set()", key, value);
				mockSafeStorage[key] = value;
				return Promise.resolve();
			},
			get: (key) => {
				mockLog("safeStorage.get()", key);
				return mockSafeStorage[key] != null ? Promise.resolve(mockSafeStorage[key]) : Promise.resolve(null);
			},
			getKeys: () => Promise.resolve(Object.keys(mockSafeStorage)),
			remove: (key) => {
				mockLog("safeStorage.remove()", key);
				delete mockSafeStorage[key];
				return Promise.resolve();
			},
			clear: () => {
				mockLog("safeStorage.clear()");
				for (let key of Object.keys(mockSafeStorage)) {
					delete mockSafeStorage[key];
				}
				return Promise.resolve();
			}
		}
	};

	// The real SDK exposes YaGames.init(), which resolves the SDK object.
	return {
		init: () => {
			mockLog("YaGames.init()");
			return Promise.resolve(mockSdk);
		}
	};
}
