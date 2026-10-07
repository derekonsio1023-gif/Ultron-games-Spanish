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

        // 1) Cualquier AssetBundle -> carpeta local (por nombre de archivo)
        if (clean.slice(-7) === '.bundle') {
            var bundlename = basename(removePlaceholders(stripQuery(url)));
            if (bundlename && bundlename.slice(-7).toLowerCase() === '.bundle') {
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
