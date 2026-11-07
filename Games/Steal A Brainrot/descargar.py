import os
import re
import sys
import requests
import http.server
import socketserver
from urllib.parse import urlparse, unquote

# ==========================================
# ⚙️ CONFIGURACIÓN
# ==========================================
PORT = 5588
ARCHIVO_URLS = "log.txt" # Nombre del archivo con tus enlaces

# ==========================================
# 1. DESCARGADOR MASIVO (A PRUEBA DE BALAS)
# ==========================================
def descargar_archivos():
    print(f"⬇️  Iniciando descarga masiva desde '{ARCHIVO_URLS}'...\n")
    
    if not os.path.exists(ARCHIVO_URLS):
        print(f"❌ Error: No se encontró '{ARCHIVO_URLS}'.")
        return

    with open(ARCHIVO_URLS, 'r', encoding='utf-8') as f:
        lineas = f.readlines()

    urls_limpias = set()
    for linea in lineas:
        # Busca CUALQUIER cosa que empiece por http:// o https:// y no tenga espacios
        match = re.search(r'https?://[^\s\'"\)]+', linea)
        if match:
            urls_limpias.add(match.group(0).strip())

    print(f"🔍 Se encontraron {len(urls_limpias)} URLs válidas (ignorando la basura del log).\n")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    for i, url in enumerate(urls_limpias, 1):
        # Decodificamos la URL (%7C -> |, %20 -> espacio)
        url_decoded = unquote(url)
        path_decoded = urlparse(url_decoded).path.lstrip('/')
        
        if not path_decoded:
            continue # Si la URL no tiene ruta, la saltamos
            
        # Separamos la ruta
        partes_ruta = path_decoded.split('/')
        
        # SANEAMIENTO DE CARPETAS Y ARCHIVO
        # Reemplazamos caracteres prohibidos en Windows (| : * ? " < >) por "_"
        partes_limpias = [re.sub(r'[\\/*?:"<>|]', "_", p) for p in partes_ruta]
        
        # Volvemos a unir la ruta limpia
        ruta_local = os.path.join(*partes_limpias)
        
        # Crear carpetas (ahora son seguras)
        directorio = os.path.dirname(ruta_local)
        if directorio:
            os.makedirs(directorio, exist_ok=True)
        
        nombre_archivo = os.path.basename(ruta_local)
        
        # Si ya existe y no está vacío, lo saltamos
        if os.path.exists(ruta_local) and os.path.getsize(ruta_local) > 0:
            print(f"[{i}/{len(urls_limpias)}] ⏭️  Ya existe: {nombre_archivo}")
            continue
            
        print(f"[{i}/{len(urls_limpias)}] ⬇️  Descargando: {nombre_archivo}")
        
        try:
            # requests codifica los espacios sin alterar los escapes %xx que ya tenga la URL.
            r = requests.get(url, headers=headers, stream=True, timeout=15)
            
            if r.status_code == 200:
                with open(ruta_local, 'wb') as f_out:
                    for chunk in r.iter_content(chunk_size=8192):
                        f_out.write(chunk)
                print(f"      ✅ Guardado.")
            else:
                print(f"      ❌ Error {r.status_code}: No encontrado en Poki.")
        except Exception as e:
            print(f"      ❌ Error de red: {e}")
            
    print("\n🎉 Descarga terminada.")

# ==========================================
# 2. SERVIDOR MÁGICO (EL QUE ARREGLA LOS 404)
# ==========================================
class ServidorMagico(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        if path.endswith('.js'): return 'application/javascript'
        if path.endswith('.wasm'): return 'application/wasm'
        if path.endswith('.glb'): return 'model/gltf-binary'
        if path.endswith('.mp3'): return 'audio/mpeg'
        return super().guess_type(path)

    def translate_path(self, path):
        # Quitar cache-buster
        path = path.split('?')[0] 
        # Decodificar %7C y %20
        path = unquote(path)      
        
        # TRUCO: Sanear TODA la ruta para que coincida con los archivos que descargamos
        partes_ruta = path.split('/')
        partes_limpias = [re.sub(r'[\\/*?:"<>|]', "_", p) for p in partes_ruta]
        path_sanitizado = '/'.join(partes_limpias)
        
        return super().translate_path(path_sanitizado)

def iniciar_servidor():
    print(f"\n🌐 Servidor Mágico corriendo en: http://127.0.0.1:{PORT}")
    print("   Deja esta ventana abierta. Abre el juego en el navegador.")
    print("   Pulsa Ctrl+C para detenerlo.\n")
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), ServidorMagico) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Servidor detenido.")

# ==========================================
# INICIO
# ==========================================
if __name__ == "__main__":
    sys.stdout.reconfigure(errors="replace")
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        iniciar_servidor()
    else:
        descargar_archivos()