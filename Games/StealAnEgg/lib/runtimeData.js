const runtimeData = (function () {

    return {

        // Basic information.
        companyName: "DefaultCompany",
        productName: "BrainrotTsunami",
        productVersion: "1.6",
        sdkVersion: "3.19.12+merge4",
        productDescription: "",

        // File references.
        buildURL: "bin",
        loaderURL: "bin/Steal an Egg_Web_YandexGames.loader.js",
        dataURL: "bin/Steal an Egg_Web_YandexGames.data.br",
        frameworkURL: "bin/Steal an Egg_Web_YandexGames.framework.js.br",
        workerURL: "",
        codeURL: "bin/Steal an Egg_Web_YandexGames.wasm.br",
        symbolsURL: "",
        streamingURL: "streaming",

        // Visual information.
        logoType: "LOGO_TYPE",
        iconTextureName: "StealAnEggIcon-2.png",
        backgroundTextureName: "background_1280x720.png",

        // Aspect ratio.
        desktopAspectRatio: -1,
        mobileAspectRatio: -1,

        // Debug mode.
        debugMode: false,
        rotationLockType : "LandscapeOnly",

        // Prefs.
        prefsContainerTags: [ "json-data" ],

        // Platform specific scripts.
        wrapperScript: "yandexGamesWrapper.js",

        // Background music fallback (web layer music, used while the Unity build has no audio clips).
        fallbackMusicURL: "audio/music.ogg",
        fallbackMusicVolume: 0.6,

        // YandexGames.
        yandexGamesSDK: "/sdk.js",

        // Yandex Ads Network.
        yandexGameId: "",
        yandexBannerId: "",
        yandexInterstitialDesktopId: "",
        yandexInterstitialMobileId: "",
        yandexRewardedDesktopId: "",
        yandexRewardedMobileId: "",

        // GameDistribution.
        gameDistributionId: "",
        gameDistributionPrefix: "mirragames_",

        // CrazyGames.
        crazyGamesXSollaProjectId: "",

        // Ads by Google.
        googleAdsClient: "",
        googleAdsChannel: "",
        googleAdsTest: true,

        // GamePush.
        gamepushProjectId: "",
        gamepushToken: "",

    }

})();