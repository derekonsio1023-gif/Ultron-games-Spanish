import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, unquote, urlsplit

import requests


BASE_URL = "https://a99f6b9c-94c4-42a5-a418-02269a08a74a.gdn.poki.com/d31f0c43-9c44-4049-bebc-e6a37f524a12/"
ARCHIVO_CONFIG = "config.json"
NUMERO_DESCARGAS_SIMULTANEAS = 8
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def md5_archivo(ruta):
    digest = hashlib.md5()
    with open(ruta, "rb") as archivo:
        for bloque in iter(lambda: archivo.read(65536), b""):
            digest.update(bloque)
    return digest.hexdigest()


def preparar_descargas(config):
    descargas = []

    for asset_id, asset in config.get("assets", {}).items():
        archivo = asset.get("file") or {}
        ruta_url = archivo.get("url")
        if not isinstance(ruta_url, str) or not ruta_url.startswith("files/assets/"):
            continue

        partes_url = unquote(urlsplit(ruta_url).path).lstrip("/").split("/")
        partes_locales = [
            re.sub(r'[\\/*?:"<>|]', "_", parte)
            for parte in partes_url
        ]
        ruta_local = os.path.join(*partes_locales)
        nombre = archivo.get("filename")
        if not nombre or len(partes_url) < 2:
            print(f"⚠️  Metadatos incompletos para el asset {asset_id}; se omite.")
            continue

        version = partes_url[-2]
        ruta_remota = f"files/assets/{asset_id}/{version}/{quote(nombre, safe='')}"
        tamano = archivo.get("size")
        hash_esperado = archivo.get("hash")

        if os.path.isfile(ruta_local) and os.path.getsize(ruta_local) == tamano:
            if not hash_esperado or md5_archivo(ruta_local) == hash_esperado:
                continue

        descargas.append((asset_id, ruta_local, ruta_remota, tamano, hash_esperado))

    return descargas


def descargar_asset(asset):
    asset_id, ruta_local, ruta_remota, tamano_esperado, hash_esperado = asset
    ruta_temporal = ruta_local + ".download"
    digest = hashlib.md5()
    tamano = 0

    try:
        os.makedirs(os.path.dirname(ruta_local), exist_ok=True)
        response = requests.get(
            BASE_URL + ruta_remota,
            headers=HEADERS,
            stream=True,
            timeout=(10, 30),
        )
        response.raise_for_status()

        with response, open(ruta_temporal, "wb") as archivo:
            for bloque in response.iter_content(chunk_size=65536):
                if bloque:
                    archivo.write(bloque)
                    digest.update(bloque)
                    tamano += len(bloque)

        hash_real = digest.hexdigest()
        if tamano != tamano_esperado or (
            hash_esperado and hash_real != hash_esperado
        ):
            raise ValueError(
                f"verificación fallida (tamaño {tamano}/{tamano_esperado}, "
                f"MD5 {hash_real}/{hash_esperado})"
            )

        os.replace(ruta_temporal, ruta_local)
        return asset_id, True, ruta_local, ""
    except (OSError, requests.RequestException, ValueError) as error:
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)
        return asset_id, False, ruta_local, str(error)


def main():
    if not os.path.isfile(ARCHIVO_CONFIG):
        raise FileNotFoundError(f"No se encontró '{ARCHIVO_CONFIG}'.")

    with open(ARCHIVO_CONFIG, "r", encoding="utf-8") as archivo:
        config = json.load(archivo)

    descargas = preparar_descargas(config)
    if not descargas:
        print("✅ Todos los recursos locales están descargados y verificados.")
        return

    print(f"⬇️  Descargando {len(descargas)} recursos que faltan...")
    correctos = 0
    fallidos = []

    with ThreadPoolExecutor(max_workers=NUMERO_DESCARGAS_SIMULTANEAS) as executor:
        trabajos = [executor.submit(descargar_asset, asset) for asset in descargas]
        for numero, trabajo in enumerate(as_completed(trabajos), 1):
            asset_id, correcto, ruta_local, error = trabajo.result()
            if correcto:
                correctos += 1
            else:
                fallidos.append((asset_id, ruta_local, error))
                print(f"❌ Asset {asset_id}: {error}")

            if numero % 25 == 0 or numero == len(descargas):
                print(f"   Progreso: {numero}/{len(descargas)}")

    print(f"\n✅ Descargados y verificados: {correctos}")
    print(f"❌ No se pudieron descargar: {len(fallidos)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(errors="replace")
    main()
