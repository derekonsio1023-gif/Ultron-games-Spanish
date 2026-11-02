import os
import re
import requests
from urllib.parse import urlparse, unquote

# ==========================================
# ⚙️ CONFIGURACIÓN (SOLO CAMBIA ESTO)
# ==========================================

# 1. URL base del CDN del juego (lo que va ANTES de la ruta del archivo)
# Ejemplo: "https://7790bf07-c062-4243-b1ea-519fd772ad1b.gdn.poki.com/a4c4765b-31a3-4f3a-98f8-7b44259544fb/"
BASE_URL = "https://7790bf07-c062-4243-b1ea-519fd772ad1b.gdn.poki.com/a4c4765b-31a3-4f3a-98f8-7b44259544fb/"

# 2. Nombre del archivo de log (debe estar en la misma carpeta que este script)
LOG_FILE = "log.txt"

# ==========================================

def extraer_urls_404(contenido):
    """Extrae todas las URLs locales que dieron error 404 en el log."""
    urls = []
    # Buscamos líneas que contengan "404 (Not Found)" y una URL de 127.0.0.1 o localhost
    for linea in contenido.splitlines():
        if "404 (Not Found)" in linea or "Failed to load resource" in linea:
            # Buscamos la URL. Capturamos todo hasta el primer espacio o comilla.
            match = re.search(r'https?://(?:127\.0\.0\.1|localhost):\d+/[^\s"\')]+', linea)
            if match:
                url = match.group(0)
                # Limpiamos posibles caracteres extra al final
                url = url.rstrip(')"\'')
                urls.append(url)
    return urls

def main():
    print("🛡️  Iniciando descarga segura de recursos faltantes...\n")
    
    if not os.path.exists(LOG_FILE):
        print(f"❌ Error: No se encontró '{LOG_FILE}' en esta carpeta.")
        print("Asegúrate de guardar el log de DevTools con ese nombre.")
        return

    with open(LOG_FILE, 'r', encoding='utf-8') as f:
        contenido = f.read()

    urls = extraer_urls_404(contenido)
    # Eliminar duplicados manteniendo el orden (opcional)
    urls = list(dict.fromkeys(urls))
    total = len(urls)
    
    if total == 0:
        print("⚠️ No se encontraron URLs con error 404 en el log.")
        return

    print(f"🔍 Se encontraron {total} recursos únicos que faltan.")
    print("-" * 60)

    descargados = 0
    saltados = 0
    errores = 0

    for i, url in enumerate(urls, 1):
        # Parsear la URL para obtener la ruta (sin parámetros ?t=...)
        parsed = urlparse(url)
        path = parsed.path  # Ej: /Merge%20Blast/files/assets/... o /Merge%20Blast/2601229.json
        
        # Dividir la ruta en segmentos. El primer segmento después de la raíz
        # es el nombre de la carpeta del juego (ej: "Merge%20Blast").
        segmentos = path.strip('/').split('/')
        if len(segmentos) < 2:
            # Si no hay subcarpeta, no podemos saber qué quitar. Saltamos.
            continue
        
        # La ruta relativa es todo menos el primer segmento (el nombre del juego)
        ruta_relativa = '/'.join(segmentos[1:])
        # Decodificar los %20 y otros caracteres especiales para el nombre local
        ruta_relativa = unquote(ruta_relativa)
        
        # Construir la URL remota (CDN + ruta relativa)
        url_remota = BASE_URL + ruta_relativa
        
        # Ruta local: la misma ruta relativa (el script está dentro de la carpeta del juego)
        ruta_local = ruta_relativa
        
        # Comprobar si el archivo ya existe
        if os.path.exists(ruta_local):
            print(f"[{i}/{total}] ⏭️  Ya existe: {ruta_local}")
            saltados += 1
            continue
        
        # Crear directorios necesarios
        directorio = os.path.dirname(ruta_local)
        if directorio:
            os.makedirs(directorio, exist_ok=True)
        
        print(f"[{i}/{total}] ⬇️  Descargando: {ruta_local}")
        
        try:
            r = requests.get(url_remota, stream=True, timeout=15)
            if r.status_code == 200:
                with open(ruta_local, 'wb') as f_out:
                    for chunk in r.iter_content(chunk_size=8192):
                        f_out.write(chunk)
                descargados += 1
            else:
                print(f"   ❌ Error {r.status_code}: No encontrado en el servidor remoto.")
                print(f"      URL intentada: {url_remota}")
                errores += 1
        except Exception as e:
            print(f"   ❌ Error de conexión: {e}")
            errores += 1

    print("-" * 60)
    print("✅ ¡Proceso terminado!")
    print(f"📊 Resumen:")
    print(f"   - Descargados: {descargados}")
    print(f"   - Omitidos (ya existían): {saltados}")
    print(f"   - Errores (no encontrados en CDN): {errores}")

if __name__ == "__main__":
    main()