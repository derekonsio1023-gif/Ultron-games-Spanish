import os
import sys

try:
    import brotli
except ImportError:
    print("❌ Falta el módulo 'brotli'. Instálalo con:  pip install brotli")
    sys.exit(1)


# ---------- Detección de formato por magic bytes ----------

def detect_format(data: bytes) -> str:
    if len(data) < 4:
        return "desconocido"

    if data[:4] == b'\x00asm':
        return "wasm"
    if data[:2] == b'\x1f\x8b':
        return "gzip"
    if data[:4] == b'PK\x03\x04':
        return "zip"
    if data[:7] == b'\x89PNG\r\n\x1a\n':
        return "png"

    # Intentar ver si es texto
    try:
        sample = data[:512].decode('utf-8', errors='strict')
        low = sample.lower()
        if '<html' in low or '<!doctype' in low:
            return "html"
        if 'function' in low or 'var ' in low or 'const ' in low or 'import ' in low:
            return "js"
        # Texto imprimible mayoritario
        printable = sum(1 for c in sample if c.isprintable() or c in '\r\n\t')
        if printable / max(len(sample), 1) > 0.9:
            return "texto"
    except UnicodeDecodeError:
        pass

    return "binario"


# ---------- Validación según el nombre esperado ----------

def validate(original_name: str, data: bytes) -> tuple[bool, str]:
    name = original_name.lower()
    fmt = detect_format(data)

    if 'wasm' in name:
        if fmt == "wasm":
            return True, f"WASM válido (magic \\0asm)"
        return False, f"Se esperaba WASM pero se detectó: {fmt}"

    if 'js' in name or 'framework' in name:
        if fmt in ("js", "html", "texto"):
            return True, f"Texto/JS válido (detectado: {fmt})"
        return False, f"Se esperaba JS pero se detectó: {fmt}"

    if 'data' in name:
        # game.data suele ser un archivo binario; a veces contiene gzip interno
        if fmt == "gzip":
            return True, "Binario con gzip interno (normal en game.data)"
        if fmt in ("wasm", "js", "html"):
            return False, f"¡Ojo! Se esperaba binario pero se detectó: {fmt}"
        return True, f"Binario válido (detectado: {fmt})"

    # Nombre desconocido: solo reportamos
    return True, f"Formato detectado: {fmt}"


# ---------- Intento de descompresión Brotli ----------

def try_brotli(data: bytes):
    try:
        return brotli.decompress(data), None
    except Exception as e:
        return None, str(e)


# ---------- Función principal ----------

def smart_decompress(filepath: str) -> str | None:
    print(f"\n📂 Procesando: {filepath}")

    if not os.path.isfile(filepath):
        print(f"❌ El archivo no existe.")
        return None

    with open(filepath, 'rb') as f:
        original = f.read()

    print(f"   Tamaño original : {len(original):,} bytes")
    fmt_orig = detect_format(original)
    print(f"   Formato original: {fmt_orig}")

    # 1) ¿Ya está descomprimido?
    if fmt_orig in ("wasm", "js", "html", "zip", "png", "gzip"):
        # Heurística: si empieza con magic conocido, no está en Brotli
        print("   ⚠️  El archivo ya parece estar DESCOMPRIMIDO. Se usará tal cual.")
        result = original
    else:
        result, err = try_brotli(original)
        if result is None:
            print(f"   ⚠️  Brotli falló: {err}")
            print("   ℹ️  Puede que ya esté descomprimido o no sea Brotli.")
            result = original
        else:
            print(f"   ✅ Brotli OK. Tamaño descomprimido: {len(result):,} bytes")

    # 2) Validar contenido
    ok, msg = validate(os.path.basename(filepath), result)
    print(f"   {'✅' if ok else '❌'} {msg}")

    if not ok:
        resp = input("   ¿Guardar de todas formas? (s/N): ").strip().lower()
        if resp != 's':
            print("   ⏭️  Omitido.")
            return None

    # 3) Salida: quitamos el .br si lo tiene
    out_path = filepath[:-3] if filepath.lower().endswith('.br') else filepath + '.out'

    # Evitar sobrescribir sin avisar
    if os.path.exists(out_path):
        resp = input(f"   '{out_path}' ya existe. ¿Sobrescribir? (s/N): ").strip().lower()
        if resp != 's':
            base, ext = os.path.splitext(out_path)
            out_path = f"{base}_nuevo{ext}"
            print(f"   Guardando como: {out_path}")

    with open(out_path, 'wb') as f:
        f.write(result)

    print(f"   💾 Guardado en: {out_path}")
    return out_path


# ---------- CLI ----------

def main():
    print("=" * 55)
    print("  Descompresor inteligente Unity WebGL (.br)")
    print("=" * 55)
    print("\n¿Qué quieres descomprimir?\n")
    print("   1) Framework.js.br")
    print("   2) game.wasm.br")
    print("   3) game.data.br")
    print("   4) Otra ruta personalizada")
    print("   0) Salir\n")

    choice = input("Elige una opción: ").strip()

    opciones = {
        '1': 'Framework.js.br',
        '2': 'game.wasm.br',
        '3': 'game.data.br',
    }

    if choice == '0':
        return
    if choice in opciones:
        filepath = opciones[choice]
    elif choice == '4':
        filepath = input("Ruta del archivo: ").strip().strip('"').strip("'")
    else:
        print("❌ Opción no válida.")
        return

    smart_decompress(filepath)
    print("\n✨ Listo.")


if __name__ == "__main__":
    main()