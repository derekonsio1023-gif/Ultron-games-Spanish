#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_game.py - Reparador automatico para builds WebGL de Unity exportadas para
Yandex Games (plantilla HTML5 + lib/yandexGamesWrapper.js).

Errores que corrige automaticamente:

  1) "index.html:1 Uncaught (in promise) TypeError: Failed to register a
     ServiceWorker ... A bad HTTP response code (404) was received when fetching
     the script. ('http://127.0.0.1:5588/lib/serviceWorker.js')"
     -> Falta el archivo lib/serviceWorker.js: se genera uno valido.

  2) "yandexGamesWrapper.js:26 Uncaught ReferenceError: YaGames is not defined"
     -> sdk.js solo define window.YaGames cuando la pagina corre dentro de un
        iframe de Yandex. Al probar en local (http://127.0.0.1) el global no
        existe y el wrapper revienta. Se instala un SDK simulado en memoria
        (lib/localDevSdk.js) que solo se activa fuera del iframe.

  3) "SDK initialization outside of frame"
     -> Aviso de sdk.js, inofensivo. Al detectar que YaGames ya esta disponible
        el wrapper deja de volver a cargar sdk.js en local, con lo que el aviso
        desaparece y se evita la carga doble del SDK.

  4) Bugs del wrapper que impiden arrancar el juego:
     - "resolve(refreshBannerStatus())" sin "this." (ReferenceError).
     - 'console.error("Invoke interstitial failed.", error)' (identificador
       inexistente dentro del catch).
     - getScoreTable(): "data[x].name = ..." sobre un objeto vacio
       (TypeError: Cannot set properties of undefined) -> ahora construye la
       lista de entradas.
     - La cadena resolvePayments -> resolveSaves -> resolveFlags ->
       resolveLeaderboards no tenia .catch: si cualquier etapa fallaba el
       readyCallback nunca se invocaba y el juego se quedaba en la pantalla de
       carga. Ahora cada etapa es tolerante a fallos y la aplicacion arranca
       siempre.

Uso (desde la carpeta del juego):

    python fix_game.py                 # diagnostica y repara todo
    python fix_game.py --check         # solo diagnostico, no escribe nada
    python fix_game.py --server        # repara y levanta servidor local (puerto 5588)
    python fix_game.py --server --port 8080
    python fix_game.py --revert        # deshace todo (restaura los .bak)
    python fix_game.py --skip wrapper,sdkpath

Todos los archivos modificados se guardan con el sufijo .bak antes de tocarlos.
"""

import argparse
import functools
import http.server
import os
import re
import shutil
import sys
import webbrowser
from pathlib import Path

TOOL_TAG = "[fix_game.py]"
MARKER_SW = "fix_game.py: service worker generado por la herramienta"
MARKER_SDK = "fix_game.py: SDK de desarrollo local"
MARKER_HTML = "ensureLocalDevSdk"

FIX_IDS = ("sw", "sdk", "html", "wrapper", "sdkpath")

# Codigos de color ANSI (se desactivan si la consola no los soporta).
_COLORS = {"ok": "\033[92m", "warn": "\033[93m", "err": "\033[91m",
           "info": "\033[96m", "dim": "\033[90m", "end": "\033[0m"}


def colorize(enabled):
    if not enabled:
        for key in _COLORS:
            _COLORS[key] = ""

class Report(object):
    """Acumula los resultados del diagnostico y de las reparaciones."""

    def __init__(self):
        self.fixed = []
        self.problems = []
        self.notes = []

    @staticmethod
    def _line(tag, color, message):
        return "  {c}{tag}{e} {m}".format(c=color, tag=tag, e=_COLORS["end"], m=message)

    def ok(self, message):
        print(self._line("[ OK ]", _COLORS["ok"], message))

    def warn(self, message):
        print(self._line("[WARN]", _COLORS["warn"], message))
        self.problems.append(message)

    def fail(self, message):
        print(self._line("[FAIL]", _COLORS["err"], message))
        self.problems.append(message)

    def info(self, message):
        print(self._line("[INFO]", _COLORS["info"], message))

    def fixed_item(self, message):
        print(self._line("[FIX ]", _COLORS["ok"], message))
        self.fixed.append(message)

    def note(self, message):
        print(self._line("[NOTE]", _COLORS["dim"], message))
        self.notes.append(message)

    def skipped(self, message):
        print(self._line("[SKIP]", _COLORS["warn"], message))


def read_text_file(path):
    """Lee un archivo de texto preservando bytes no UTF-8 (surrogateescape)."""
    data = path.read_bytes()
    bom = data.startswith(b"\xef\xbb\xbf")
    if bom:
        data = data[3:]
    try:
        return data.decode("utf-8"), bom
    except UnicodeDecodeError:
        return data.decode("utf-8", "surrogateescape"), bom


def write_text_file(path, text, bom=False):
    data = text.encode("utf-8", "surrogateescape")
    if bom:
        data = b"\xef\xbb\xbf" + data
    path.write_bytes(data)


def detect_newline(text):
    crlf = text.count("\r\n")
    lf = text.count("\n") - crlf
    return "\r\n" if crlf > lf else "\n"


def backup(path):
    """Crea <archivo>.bak si no existe todavia. Devuelve la ruta del backup."""
    backup_path = path.with_name(path.name + ".bak")
    if not backup_path.exists():
        shutil.copy2(str(path), str(backup_path))
    return backup_path


def restore(path):
    """Restaura <archivo>.bak sobre <archivo> y elimina el backup."""
    backup_path = path.with_name(path.name + ".bak")
    if backup_path.exists():
        shutil.copy2(str(backup_path), str(path))
        backup_path.unlink()
        return True
    return False


def human_size(num_bytes):
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024.0 or unit == "GB":
            return "{0:.2f} {1}".format(value, unit) if unit != "B" else "{0} B".format(int(value))
        value /= 1024.0

# ---------------------------------------------------------------------------
# Archivos generados por la herramienta
# ---------------------------------------------------------------------------

SERVICE_WORKER_JS = """// ---------------------------------------------------------------------------
// lib/serviceWorker.js
// (generado por fix_game.py: service worker generado por la herramienta)
//
// index.html registra este archivo con:
//     navigator.serviceWorker.register("lib/serviceWorker.js");
// En las builds reempaquetadas suele faltar y la consola muestra:
//     "A bad HTTP response code (404) was received when fetching the script".
//
// Esta version es intencionadamente conservadora: NO cachea nada (la cache de
// assets la gestiona Unity con su propio UnityCache/IndexedDB), solo limpia
// caches antiguas y toma el control de la pagina. Asi el registro deja de
// fallar sin riesgo de servir una version obsoleta del juego.
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "whos-your-baby";

self.addEventListener("install", () => {
    // Activa esta version sin esperar a que se cierren las pestanas antiguas.
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => {
                if (key.indexOf(CACHE_PREFIX) === 0) {
                    return caches.delete(key);
                }
                return Promise.resolve(false);
            }));
        }
        catch (exception) {
            console.warn("Service worker cache cleanup failed.", exception);
        }
        await self.clients.claim();
        console.log("Service worker activated (no caching mode).");
    })());
});

// Al no registrar un manejador de 'fetch' el navegador sigue haciendo las
// peticiones de red normales: cero riesgo de contenido obsoleto.
"""

LOCAL_DEV_SDK_JS = """// ---------------------------------------------------------------------------
// lib/localDevSdk.js
// (generado por fix_game.py: SDK de desarrollo local)
//
// El sdk.js oficial solo define window.YaGames cuando la pagina corre dentro de
// un iframe de Yandex Games. Si abres la build con un servidor local
// (http://127.0.0.1:5588) el global no existe y lib/yandexGamesWrapper.js falla
// con:
//     "Uncaught ReferenceError: YaGames is not defined"
//
// Este modulo instala un SDK simulado en memoria SOLO cuando la pagina no esta
// dentro de un iframe, de modo que puedes probar el juego en local. Dentro de
// Yandex Games no se instala nada y se usa el SDK real.
//
// Todo lo simulado: anuncios (se cierran sin mostrarse), compras (deshabilitadas),
// guardado (en memoria) y leaderboards (vacios).
// ---------------------------------------------------------------------------

const MOCK_FLAG = "__localDevYandexSdkInstalled";

function createMockPlayer() {
    const storage = {};
    const player = {
        get name() { return "Local Player"; },
        get publicName() { return "Local Player"; },
        getAvatarSrc() { return ""; },
        getMode() { return "lite"; },
        getPayingStatus() { return Promise.resolve("unknown"); },
        getData(keys) {
            const data = {};
            const list = Array.isArray(keys) ? keys : [];
            for (let index = 0; index < list.length; index++) {
                if (Object.prototype.hasOwnProperty.call(storage, list[index])) {
                    data[list[index]] = storage[list[index]];
                }
            }
            console.log("[localDevSdk] player.getData", JSON.stringify(data));
            return Promise.resolve(data);
        },
        setData(data) {
            const values = data || {};
            Object.keys(values).forEach(function (key) {
                storage[key] = values[key];
            });
            console.log("[localDevSdk] player.setData", JSON.stringify(values));
            return Promise.resolve();
        },
        setStats() { return Promise.resolve(); },
        getStats() { return Promise.resolve({}); }
    };
    return player;
}

function createMockSdk() {
    const player = createMockPlayer();
    const mockPlayerEntry = {
        player: player,
        rank: 0,
        score: 0,
        getAvatarSrc() { return ""; }
    };
    const mock = {
        environment: {
            i18n: {
                lang: (navigator.language || "en").split("-")[0],
                t: function (key) { return key; }
            },
            app: { id: "local-dev" }
        },
        deviceInfo: {
            type: "desktop",
            isMobile: function () { return false; },
            isTablet: function () { return false; },
            isDesktop: function () { return true; },
            isTV: function () { return false; }
        },
        adv: {
            getBannerAdvStatus: function () {
                return Promise.resolve({ stickyAdvIsShowing: false, reason: "LOCAL_DEV" });
            },
            showBannerAdv: function () { return Promise.resolve(); },
            hideBannerAdv: function () { return Promise.resolve(); },
            showFullscreenAdv: function (options) {
                const callbacks = (options && options.callbacks) || {};
                window.setTimeout(function () {
                    // wasShown = false: no hay anuncio real que mostrar.
                    if (callbacks.onClose) callbacks.onClose(false);
                }, 0);
                return Promise.resolve();
            },
            showRewardedVideo: function (options) {
                const callbacks = (options && options.callbacks) || {};
                window.setTimeout(function () {
                    if (callbacks.onOpen) callbacks.onOpen();
                    if (callbacks.onRewarded) callbacks.onRewarded();
                    if (callbacks.onClose) callbacks.onClose();
                }, 0);
                return Promise.resolve();
            }
        },
        getPayments: function () {
            return Promise.resolve({
                getCatalog: function () { return Promise.resolve([]); },
                getPurchases: function () { return Promise.resolve([]); },
                purchase: function () {
                    return Promise.reject(new Error("Local development: purchases are disabled."));
                }
            });
        },
        getPlayer: function () { return Promise.resolve(player); },
        getFlags: function () { return Promise.resolve({}); },
        getLeaderboards: function () {
            return Promise.resolve({
                getLeaderboardEntries: function () { return Promise.resolve({ entries: [] }); },
                getLeaderboardPlayerEntry: function () { return Promise.resolve(mockPlayerEntry); },
                setLeaderboardScore: function () { return Promise.resolve(); }
            });
        },
        feedback: {
            canReview: function () { return Promise.resolve({ value: false, reason: "LOCAL_DEV" }); },
            requestReview: function () { return Promise.resolve({ feedbackSent: false }); }
        },
        features: {
            LoadingAPI: { ready: function () { console.log("[localDevSdk] LoadingAPI.ready"); } },
            GameplayAPI: {
                start: function () { console.log("[localDevSdk] GameplayAPI.start"); },
                stop: function () { console.log("[localDevSdk] GameplayAPI.stop"); }
            }
        },
        isAvailableMethod: function () { return Promise.resolve(false); },
        auth: {
            openAuthDialog: function () { return Promise.resolve(); }
        }
    };
    return mock;
}

// Instala el SDK simulado. Devuelve true si lo ha instalado en esta llamada.
export function ensureLocalDevSdk() {
    if (typeof window === "undefined") {
        return false;
    }
    // Dentro de un iframe (Yandex Games) el SDK real esta disponible: no tocar nada.
    if (window !== window.top) {
        return false;
    }
    if (window[MOCK_FLAG] === true) {
        return false;
    }
    if (typeof window.YaGames !== "undefined" && window.YaGames !== null) {
        // Ya hay un YaGames real cargado (por ejemplo desde una version de la
        // plataforma que lo inyecta): no lo sobrescribimos.
        return false;
    }
    window[MOCK_FLAG] = true;
    window.YaGames = {
        init: function () {
            console.warn("[localDevSdk] Mock YaGames SDK initialized (local development mode).");
            return Promise.resolve(createMockSdk());
        },
        deviceInfo: {
            type: "desktop",
            isMobile: function () { return false; },
            isTablet: function () { return false; },
            isDesktop: function () { return true; },
            isTV: function () { return false; }
        }
    };
    console.warn("[localDevSdk] El juego NO se esta ejecutando dentro de Yandex Games. " +
        "Se ha instalado un SDK simulado: anuncios, compras, guardado y leaderboards " +
        "funcionan en memoria. Este archivo no afecta a la version publicada.");
    return true;
}

// Indica si el SDK simulado esta instalado.
export function isLocalDevSdkEnabled() {
    return typeof window !== "undefined" && window[MOCK_FLAG] === true;
}

export default { ensureLocalDevSdk, isLocalDevSdkEnabled };
"""

# ---------------------------------------------------------------------------
# Parcheo de lib/yandexGamesWrapper.js
# ---------------------------------------------------------------------------

WRAPPER_INIT_RE = re.compile(r"[ \t]*// Wrapper initialization\..*?\r?\n[ \t]*\}\r?\n", re.S)
WRAPPER_METHODS_ANCHOR = "// Banner advertisement methods."
WRAPPER_SCORE_TABLE_RE = re.compile(
    r"let data = \{\};\r?\n([ \t]*)for \(let x = 0; x < leaderboard\.entries\.length; x\+\+\) \{\r?\n"
    r"[ \t]*let entry = leaderboard\.entries\[x\];\r?\n"
    r"[ \t]*data\[x\]\.name = [^\r\n]*\r?\n"
    r"[ \t]*data\[x\]\.position = [^\r\n]*\r?\n"
    r"[ \t]*data\[x\]\.score = [^\r\n]*\r?\n"
    r"[ \t]*data\[x\]\.pictureURL = [^\r\n]*\r?\n"
    r"[ \t]*\}", re.S)


def build_wrapper_init(base, unit, nl, base_levels=2):
    """Genera el bloque de inicializacion robusto del constructor del wrapper."""
    def L(level):
        return unit * (base_levels + level - 2)

    lines = [
        base + "// Wrapper initialization.",
        base + "// " + TOOL_TAG + " Evita que el readyCallback se invoque mas de una vez.",
        base + "this.applicationInitialized = false;",
        base + 'console.log("Wrapper initialization started.");',
        base + "try {",
        base + L(3) + "// " + TOOL_TAG + " El SDK ya esta disponible: o el cargador real de",
        base + L(3) + "// Yandex Games dentro del iframe, o el SDK simulado instalado por",
        base + L(3) + "// lib/localDevSdk.js. Volver a cargarlo imprime \"The SDK Loader was",
        base + L(3) + "// loaded more than once\" y en local no define window.YaGames.",
        base + L(3) + 'if (typeof YaGames !== "undefined" && YaGames !== null && typeof YaGames.init === "function") {',
        base + L(4) + "this.initializeSDK(readyCallback);",
        base + L(4) + "return;",
        base + L(3) + "}",
        base + L(3) + 'let script = document.createElement("script");',
        base + L(3) + "script.src = runtimeData.yandexGamesSDK;",
        base + L(3) + "script.onload = () => {",
        base + L(4) + "// " + TOOL_TAG + " sdk.js solo define window.YaGames dentro de un iframe",
        base + L(4) + '// de Yandex Games ("SDK initialization outside of frame"). Fuera de el',
        base + L(4) + "// hay que arrancar el juego igualmente en vez de lanzar una",
        base + L(4) + '// "Uncaught ReferenceError: YaGames is not defined".',
        base + L(4) + 'if (typeof YaGames === "undefined" || YaGames === null || typeof YaGames.init !== "function") {',
        base + L(5) + 'console.error("YaGames is not defined: the Yandex Games SDK is only available inside a game frame.");',
        base + L(5) + "this.initializeApplication(readyCallback);",
        base + L(5) + "return;",
        base + L(4) + "}",
        base + L(4) + "this.initializeSDK(readyCallback);",
        base + L(3) + "};",
        base + L(3) + "script.onerror = () => {",
        base + L(4) + "// " + TOOL_TAG + " Arranca el juego aunque el sdk.js no se pueda descargar.",
        base + L(4) + 'console.error("The Yandex Games SDK script could not be loaded: " + runtimeData.yandexGamesSDK);',
        base + L(4) + "this.initializeApplication(readyCallback);",
        base + L(3) + "};",
        base + L(3) + "document.body.appendChild(script);",
        base + "}",
        base + "catch (exception) {",
        base + L(3) + "// Initiate application loading anyway.",
        base + L(3) + 'console.error("Wrapper initialization failed.", exception);',
        base + L(3) + "this.initializeApplication(readyCallback);",
        base + "}",
        unit * (base_levels - 1) + "}",
    ]
    return nl.join(lines) + nl

def build_wrapper_methods(base, unit, nl, base_levels=1):
    """Genera los metodos nuevos que se anaden a la clase del wrapper."""
    def L(level):
        return unit * (base_levels + level - 2)

    lines = [
        base + "// " + TOOL_TAG + " Ejecuta las etapas del SDK sin bloquear la carga del juego.",
        base + "// Antes, si una etapa fallaba (compras, guardado, flags o leaderboards), la",
        base + "// cadena de promesas se rompia, readyCallback nunca se invocaba y el juego",
        base + "// se quedaba en la pantalla de carga para siempre.",
        base + "runSDKStages(stages) {",
        base + L(3) + "return stages.reduce((chain, stage) => chain.then(() => {",
        base + L(4) + "return Promise.resolve().then(() => stage.action()).catch(exception => {",
        base + L(5) + 'console.error("SDK stage failed: " + stage.name, exception);',
        base + L(4) + "});",
        base + L(3) + "}), Promise.resolve());",
        base + "}",
        "",
        base + "// " + TOOL_TAG + " Punto unico de arranque de la aplicacion.",
        base + "initializeApplication(readyCallback) {",
        base + L(3) + "if (this.applicationInitialized === true) {",
        base + L(4) + "return;",
        base + L(3) + "}",
        base + L(3) + "this.applicationInitialized = true;",
        base + L(3) + "// " + TOOL_TAG + " Un fallo del anuncio nunca debe impedir que arranque el juego.",
        base + L(3) + "try {",
        base + L(4) + "Promise.resolve(this.invokeInterstitial()).catch(exception => {",
        base + L(5) + 'console.warn("Interstitial advertisement was skipped.", exception);',
        base + L(4) + "});",
        base + L(3) + "}",
        base + L(3) + "catch (exception) {",
        base + L(4) + 'console.warn("Interstitial advertisement was skipped.", exception);',
        base + L(3) + "}",
        base + L(3) + "readyCallback();",
        base + "}",
        "",
        base + "// " + TOOL_TAG + " Inicializa el SDK y resuelve sus etapas en secuencia,",
        base + "// continuando siempre con la carga del juego.",
        base + "initializeSDK(readyCallback) {",
        base + L(3) + "YaGames.init().then(ysdk => {",
        base + L(4) + 'console.log("SDK initialized successfully.");',
        base + L(4) + "this.wrapperSDK = ysdk;",
        base + L(4) + "return this.runSDKStages([",
        base + L(5) + '{ name: "payments", action: () => this.resolvePayments() },',
        base + L(5) + '{ name: "saves", action: () => this.resolveSaves() },',
        base + L(5) + '{ name: "flags", action: () => this.resolveFlags() },',
        base + L(5) + '{ name: "leaderboards", action: () => this.resolveLeaderboards() }',
        base + L(4) + "]);",
        base + L(3) + "}).then(() => {",
        base + L(4) + 'console.log("Wrapper initialization completed.");',
        base + L(4) + "this.initializeApplication(readyCallback);",
        base + L(3) + "}).catch(exception => {",
        base + L(4) + "// Initiate application loading anyway.",
        base + L(4) + 'console.error("Wrapper initialization failed.", exception);',
        base + L(4) + "this.initializeApplication(readyCallback);",
        base + L(3) + "});",
        base + "}",
        "",
    ]
    return nl.join(lines)

def patch_wrapper_text(text):
    """Aplica todas las correcciones al wrapper. Devuelve (texto, cambios)."""
    changes = []
    nl = detect_newline(text)

    if TOOL_TAG in text and "runSDKStages" in text:
        return text, changes

    # 1) Inicializacion del SDK robusta (bloque del constructor).
    match = WRAPPER_INIT_RE.search(text)
    if match:
        base = re.match(r"[ \t]*", match.group(0)).group(0)
        unit = "\t" if "\t" in base else "    "
        base_levels = max(1, len(base) // len(unit))
        replacement = build_wrapper_init(base, unit, nl, base_levels)
        text = text[:match.start()] + replacement + text[match.end():]
        changes.append("constructor: YaGames no definido / SDK ya cargado / onerror")

    # 2) Metodos nuevos (runSDKStages, initializeApplication, initializeSDK).
    if WRAPPER_METHODS_ANCHOR in text and "runSDKStages" not in text:
        method_line = re.compile(r"([ \t]*)" + re.escape(WRAPPER_METHODS_ANCHOR))
        found = method_line.search(text)
        if found:
            base = found.group(1)
            unit = "\t" if "\t" in base else "    "
            base_levels = max(1, len(base) // len(unit))
            methods = build_wrapper_methods(base, unit, nl, base_levels)
            text = text[:found.start()] + methods + text[found.start():]
            changes.append("metodos: runSDKStages / initializeApplication / initializeSDK")

    # 3) resolve(refreshBannerStatus()) -> resolve(this.refreshBannerStatus()).
    if "resolve(refreshBannerStatus());" in text:
        text = text.replace("resolve(refreshBannerStatus());", "resolve(this.refreshBannerStatus());")
        changes.append("banner: resolve(refreshBannerStatus()) -> this.refreshBannerStatus()")

    # 4) Variable inexistente dentro del catch de invokeInterstitial.
    broken = 'console.error("Invoke interstitial failed.", error);'
    if broken in text:
        text = text.replace(broken, 'console.error("Invoke interstitial failed.", exception);')
        changes.append("interstitial: variable 'error' -> 'exception'")

    # 5) getScoreTable() escribia en un objeto vacio (TypeError).
    score_match = WRAPPER_SCORE_TABLE_RE.search(text)
    if score_match:
        indent = score_match.group(1)
        inner = indent + "\t"
        replacement = nl.join([
            indent + "let data = [];",
            indent + "for (let x = 0; x < leaderboard.entries.length; x++) {",
            inner + "let entry = leaderboard.entries[x];",
            inner + "data.push({",
            inner + "\t" + '"name": entry.player.publicName,',
            inner + "\t" + '"position": entry.rank,',
            inner + "\t" + '"score": entry.score,',
            inner + "\t" + '"pictureURL": entry.player.getAvatarSrc("medium")',
            inner + "});",
            indent + "}",
        ])
        text = text[:score_match.start()] + replacement + text[score_match.end():]
        changes.append("leaderboards: getScoreTable() construye la lista de entradas")

    return text, changes

INDEX_HOOK_RE = re.compile(r"(async function initializeWrapper\(\) \{\r?\n)([ \t]*)(if \(runtimeData\.wrapperScript)")


def patch_index_html_text(text):
    """Inserta la llamada al SDK de desarrollo local dentro de initializeWrapper."""
    changes = []
    if MARKER_HTML in text:
        return text, changes
    match = INDEX_HOOK_RE.search(text)
    if not match:
        return text, changes
    indent = match.group(2)
    unit = "\t" if "\t" in indent else "    "
    nl = detect_newline(text)
    lines = [
        indent + "// " + TOOL_TAG + " SDK local de desarrollo: evita el error",
        indent + '// "Uncaught ReferenceError: YaGames is not defined" cuando el juego',
        indent + "// se prueba fuera del iframe de Yandex Games (por ejemplo en localhost).",
        indent + "// Dentro de Yandex Games esta llamada no hace absolutamente nada.",
        indent + "try {",
        indent + unit + 'const localDevSdk = await import("./lib/localDevSdk.js");',
        indent + unit + "localDevSdk.ensureLocalDevSdk();",
        indent + "}",
        indent + "catch (exception) {",
        indent + unit + 'console.warn("Local development SDK is not available.", exception);',
        indent + "}",
        "",
    ]
    hook = nl.join(lines)
    text = text[:match.start(2)] + hook + text[match.start(2):]
    changes.append("initializeWrapper(): importa y activa lib/localDevSdk.js")
    return text, changes


SDK_PATH_RE = re.compile(r'(yandexGamesSDK\s*:\s*")/sdk\.js(")')


def patch_runtime_data_text(text):
    """Hace relativa la ruta del SDK (funciona tambien bajo un subdirectorio)."""
    changes = []
    if SDK_PATH_RE.search(text):
        text = SDK_PATH_RE.sub(r"\1sdk.js\2", text)
        changes.append('yandexGamesSDK: "/sdk.js" -> "sdk.js" (ruta relativa)')
    return text, changes

RUNTIME_KEYS = ("loaderURL", "dataURL", "frameworkURL", "workerURL", "codeURL",
                "symbolsURL", "streamingURL", "wrapperScript", "yandexGamesSDK",
                "debugMode", "logoType", "prefsContainerTags")


def parse_runtime_data(text):
    """Extrae las rutas y opciones relevantes definidas en runtimeData.js."""
    values = {}
    for key in RUNTIME_KEYS:
        match = re.search(r"^\s*" + key + r"\s*:\s*(.+?),?\s*$", text, re.M)
        if match:
            values[key] = match.group(1).strip().rstrip(",").strip()
    return values


def unquote(value):
    if value is None:
        return ""
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def patch_file(root, rel_path, patcher, rep, apply_changes):
    """Aplica un patcher de texto a un archivo, con copia de seguridad."""
    path = root / rel_path
    if not path.exists():
        rep.fail("No se encuentra el archivo " + rel_path)
        return False
    text, bom = read_text_file(path)
    new_text, changes = patcher(text)
    if not changes:
        rep.info(rel_path + ": sin cambios necesarios")
        return False
    if not apply_changes:
        for change in changes:
            rep.warn(rel_path + ": pendiente de reparar -> " + change)
        return False
    backup(path)
    write_text_file(path, new_text, bom)
    for change in changes:
        rep.fixed_item(rel_path + ": " + change)
    rep.note("Copia de seguridad creada: " + rel_path + ".bak")
    return True


def create_file(root, rel_path, content, marker, rep, apply_changes, what):
    """Crea un archivo generado por la herramienta (idempotente)."""
    path = root / rel_path
    if path.exists():
        text, _ = read_text_file(path)
        if marker in text:
            rep.info(rel_path + ": ya existe y es de la herramienta")
        else:
            rep.warn(rel_path + ": ya existe un archivo propio con ese nombre; no se toca")
        return False
    if not apply_changes:
        rep.warn("Falta " + rel_path + " (" + what + ")")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    write_text_file(path, content)
    rep.fixed_item("Creado " + rel_path + " (" + what + ")")
    return True

ASSET_KEYS = (("loaderURL", "loader"), ("dataURL", "datos"), ("frameworkURL", "framework"),
              ("codeURL", "wasm"), ("workerURL", "worker"), ("symbolsURL", "symbols"))


def check_asset_files(root, values, rep):
    """Comprueba los archivos referenciados en runtimeData.js."""
    missing = []
    compressed = []
    plain = []
    for key, label in ASSET_KEYS:
        raw = unquote(values.get(key, ""))
        if raw == "":
            continue
        path = root / raw.replace("/", os.sep)
        if not path.exists():
            rep.fail("Falta el archivo del build ({0}): {1}".format(label, raw))
            missing.append(raw)
            continue
        size = human_size(path.stat().st_size)
        head = path.read_bytes()[:8]
        if raw.lower().endswith(".gz") or raw.lower().endswith(".br"):
            if head[:2] == b"\x1f\x8b":
                rep.ok("{0} ({1}) -> gzip real".format(raw, size))
                compressed.append(raw)
            else:
                rep.ok("{0} ({1}) -> contenido SIN comprimir (extension {2})".format(
                    raw, size, raw.rsplit(".", 1)[-1]))
                plain.append((raw, head))
        else:
            rep.ok("{0} ({1})".format(raw, size))
    for raw, head in plain:
        expected = None
        if raw.endswith(".data.gz"):
            expected = b"UnityWeb"
        elif raw.endswith(".wasm.gz"):
            expected = b"\x00asm"
        if expected is not None and head[:len(expected)] != expected:
            rep.warn("{0}: el contenido no parece un {1} valido (cabecera {2})".format(
                raw, "UnityWebData" if expected == b"UnityWeb" else "WebAssembly", head.hex()))
    if plain:
        rep.warn("Los archivos terminados en .gz NO estan comprimidos: el servidor web NO "
                 "debe enviar la cabecera 'Content-Encoding: gzip' para ellos (el loader de "
                 "Unity fallaria al interpretarlos). El servidor incluido en esta herramienta "
                 "(--server) ya lo hace bien.")
    if compressed:
        rep.warn("Los archivos .gz SI estan comprimidos de verdad: el servidor DEBE enviar "
                 "'Content-Encoding: gzip' (o servirlos con el loader en modo fallback).")
    return missing


def check_streaming(root, values, rep):
    raw = unquote(values.get("streamingURL", ""))
    if raw == "" or raw.lower() == "streamingassets":
        return
    path = root / raw.replace("/", os.sep)
    if path.exists():
        rep.ok("Carpeta de streaming assets: " + raw)
    else:
        rep.note("No existe la carpeta '" + raw + "' (normal si el build no usa streaming assets)")


def check_sdk_script(root, values, rep):
    raw = unquote(values.get("yandexGamesSDK", ""))
    if raw == "":
        rep.fail("runtimeData.yandexGamesSDK esta vacio: el wrapper no cargara ningun SDK")
        return
    rel = raw.lstrip("/").replace("/", os.sep)
    path = root / rel
    if path.exists():
        size = human_size(path.stat().st_size)
        if raw.startswith("/"):
            rep.warn('yandexGamesSDK vale "{0}" (ruta absoluta): solo funciona si el juego se '
                     "sirve desde la raiz del dominio. Se recomienda una ruta relativa.".format(raw))
        else:
            rep.ok('SDK local encontrado en "{0}" ({1})'.format(raw, size))
        return
    rep.fail('No se encuentra el SDK "{0}" a partir de la carpeta del juego'.format(raw))

# --- END OF CHUNK ---
