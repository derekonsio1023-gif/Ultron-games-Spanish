/* =========================================================================
 *  Gamer's Mod - Offline Addressables redirect
 * -------------------------------------------------------------------------
 *  El juego (Unity WebGL + Addressables) intenta cargar su catalogo y sus
 *  AssetBundles desde una ruta remota "version dependent" que no puede
 *  resolver, por lo que terminaba pidiendo:
 *
 *      StreamingAssets/aa/catalog.bin            -> 404
 *      {RemoteAddressablesPath.RemoteURL}/xxx.bundle
 *
 *  Este script intercepta fetch() y XMLHttpRequest y redirige TODAS las
 *  peticiones de Addressables (.bundle y catalog*.bin/.hash) a la carpeta
 *  local "itsjasonstudiobasebacket/GamersMod/Adressables/1.4/".
 *
 *  Resultado: el juego funciona 100% offline, sin depender de carga externa.
 * ========================================================================= */
(function () {
    'use strict';

    // Carpeta LOCAL que contiene catalog_0.1.0.bin/.hash y los .bundle
    var LOCAL_AA = 'itsjasonstudiobasebacket/GamersMod/Adressables/1.4/';

    // Mapa alias: nombre largo del catalogo -> fichero corto disponible en local.
    // Verificado por contenido (Backgrounds/GameNews/AssetConfiguration/backrooms/Male07/crowbar/...).
    // NOTA: flatgrass NO existe en local. Se mapea temporalmente a backrooms para
    // que el juego arranque en un mapa jugable en vez de quedarse en "Can't load selected map".
    var ALIAS = {
        'common_assets_assets__game__so_ui_backgrounds.asset_72d0267a4608114b2637a3c4e9e7b65d.bundle': 'commonasset2.bundle',
        'common_assets_assets__game__so_ui_updatenews__gamenews.asset_67c220397c0da803a2e113bf21526930.bundle': 'commonasset1.bundle',
        'configs_assets_assets__game__so_gameassets_assetconfiguration_1_4.asset_dcf1ce30cf1f90b90ea24ec34b331e84.bundle': 'configsassets.bundle',
        'maps_scenes_assets__game_maps_backrooms_backrooms.unity_b11431c2f4bb0d38ec5f6416204636e5.bundle': 'mapsscenesasstes.bundle',
        'maps_scenes_assets__game_maps_gm_flatgrass_gm_flatgrass.unity_dda70ca904c0d0a8e08a6d82202e97d8.bundle': 'mapsscenesasstes.bundle',
        'playermodels_assets_assets__game_prefabs_gameassets_playermodels_male07_pm_male07_dataholder.prefab_939d3e849768c35916d3c3eef36d8a5f.bundle': 'playermodelsassets.bundle',
        'weapons_base_assets_assets__game_prefabs_gameassets_weapons_base_crowbar.prefab_157527c5f1d5b5290801e734a84434f0.bundle': 'weapons_base_crowbar.prefab.bundle',
        'weapons_base_assets_assets__game_prefabs_gameassets_weapons_base_gravitygun.prefab_91e7eafda8d7a4d0bf5ca38e0299c389.bundle': 'weapons_base_gravitygun.prefab.bundle',
        'weapons_base_assets_assets__game_prefabs_gameassets_weapons_base_physgun.prefab_0b435d887561c333b2b34ae95e3d25ec.bundle': 'weapons_base_physgun.bundle',
        'weapons_base_assets_assets__game_prefabs_gameassets_weapons_base_toolgun.prefab_4def15e5f51348ae9b0c636575647b77.bundle': 'weapons_base_toolgun.bundle',
        '0eff098cdc127729560ebd6f8d91601c_unitybuiltinassets_1e8b50180a2f5c3c709840e54fa600af.bundle': '0eff098cdc127729560ebd6f8d91601c_monoscripts_3f53ed8be35d6c2187dc7811e1d7c603.bundle'
    };

    function getBase() {
        try {
            return new URL(LOCAL_AA, document.baseURI).href;
        } catch (e) {
            return LOCAL_AA;
        }
    }

    function stripQuery(url) {
        return url.split('#')[0].split('?')[0];
    }

    // Quita placeholders sin resolver: %7BRemoteAddressablesPath.RemoteURL%7D / {RemoteAddressablesPath.RemoteURL}
    function removePlaceholders(url) {
        return url
            .replace(/%7B[^%]*?%7D/gi, '')
            .replace(/\{[^}]*\}/g, '');
    }

    function basename(url) {
        var i = url.lastIndexOf('/');
        return i >= 0 ? url.slice(i + 1) : url;
    }

    function rewrite(url) {
        if (typeof url !== 'string' || url.length === 0) {
            return url;
        }

        var clean = stripQuery(url).toLowerCase();

        // 1) Cualquier AssetBundle -> carpeta local (por nombre de archivo, con alias corto si existe)
        if (clean.slice(-7) === '.bundle') {
            var bundlename = basename(removePlaceholders(stripQuery(url)));
            if (bundlename && bundlename.slice(-7).toLowerCase() === '.bundle') {
                var aliased = ALIAS[bundlename] || ALIAS[bundlename.toLowerCase()];
                if (aliased) {
                    return getBase() + aliased;
                }
                return getBase() + bundlename;
            }
        }

        // 2) Ficheros de catalogo remotos (catalog_0.1.0.bin / catalog_0.1.0.hash ...)
        var name = basename(removePlaceholders(stripQuery(url))).toLowerCase();
        var isCatalogFile = name.indexOf('catalog') === 0 &&
            (name.slice(-4) === '.bin' || name.slice(-5) === '.hash');
        if (isCatalogFile && clean.indexOf('/streamingassets/aa/') === -1) {
            return getBase() + name;
        }

        return url;
    }

    // ---------------- fetch ----------------
    var originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (originalFetch) {
        window.fetch = function (input, init) {
            try {
                if (typeof input === 'string') {
                    var mapped = rewrite(input);
                    if (mapped !== input) {
                        console.log('[offline-addressables] fetch ->', mapped);
                        input = mapped;
                    }
                } else if (input && typeof input === 'object' && typeof input.url === 'string') {
                    var mappedReq = rewrite(input.url);
                    if (mappedReq !== input.url) {
                        console.log('[offline-addressables] fetch(Request) ->', mappedReq);
                        input = new Request(mappedReq, input);
                    }
                }
            } catch (e) {
                console.warn('[offline-addressables] fetch rewrite failed:', e);
            }
            return originalFetch(input, init);
        };
    }

    // ------------- XMLHttpRequest (respaldo) -------------
    if (window.XMLHttpRequest && XMLHttpRequest.prototype.open) {
        var originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            var args = Array.prototype.slice.call(arguments);
            try {
                var mapped = rewrite(url);
                if (mapped !== url) {
                    console.log('[offline-addressables] xhr ->', mapped);
                    args[1] = mapped;
                }
            } catch (e) { /* noop */ }
            return originalOpen.apply(this, args);
        };
    }

    console.log('[offline-addressables] activo. Base local =', getBase());
})();
