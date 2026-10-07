"""Servidor local Gamer's Mod: MIME + Brotli correctos. Uso: python serve_gamersmod.py [puerto]"""
import http.server, sys, urllib.parse
from pathlib import Path
BASE = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5588
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(BASE), **k)
    def do_GET(self):
        rel = urllib.parse.unquote(urllib.parse.urlparse(self.path).path.lstrip("/"))
        f = BASE / rel
        if f.is_file() and f.suffix == ".br":
            data = f.read_bytes()
            ctype = "application/octet-stream"
            if rel.endswith(".wasm.br"): ctype = "application/wasm"
            elif rel.endswith(".js.br"): ctype = "application/javascript"
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Encoding", "br")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()
    def guess_type(self, path):
        if path.endswith(".bundle"): return "application/octet-stream"
        if path.endswith(".wasm"): return "application/wasm"
        if path.endswith(".hash"): return "text/plain"
        if path.endswith(".bin"): return "application/octet-stream"
        return super().guess_type(path)
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()
if __name__ == "__main__":
    print(f"Sirviendo {BASE} en http://127.0.0.1:{PORT}/index.html")
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H) as s:
        s.serve_forever()
