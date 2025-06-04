#!/usr/bin/env python3
import os
import subprocess
import time
import json
from datetime import datetime, timezone
from urllib.parse import urlencode

# --------------- CONFIGURACIÓN LOCAL ---------------
# Leer loc/can/lado desde mi_config.json
CONFIG_PATH = "/home/isaac/CanchaX_LadoY/codigo_base/mi_config.json"

# Carpeta local donde están los videos generados por la Pi
VIDEO_DIR = "/home/isaac/CanchaX_LadoY/codigo_base/final_cam"

# Archivo local que registra cuáles ya subimos
REGISTRO_PATH = "/home/isaac/CanchaX_LadoY/codigo_base/subidos.txt"

# Ruta al JSON local que mantendrá el listado de videos vigentes
JSON_LOCAL = "/home/isaac/CanchaX_LadoY/codigo_base/videos_recientes.json"

# Dropbox: carpeta base donde subimos todo: “Puntazo/Locaciones/loc/can/lado/”
DROPBOX_BASE = "dropbox:Puntazo/Locaciones"

# Tiempo de retención: borrar videos > 8 horas
RETENTION_HOURS = 8

def load_config():
    """Carga loc, can y lado desde mi_config.json."""
    with open(CONFIG_PATH, "r") as f:
        conf = json.load(f)
    return conf["loc"], conf["can"], conf["lado"]

def obtener_ultimo_video_local():
    """
    Busca el archivo local video_final_*.mp4 más reciente 
    en VIDEO_DIR y devuelve su ruta completa; si no hay nada, retorna None.
    """
    archivos = [f for f in os.listdir(VIDEO_DIR)
                if f.startswith("video_final_") and f.endswith(".mp4")]
    if not archivos:
        return None
    rutas = [os.path.join(VIDEO_DIR, f) for f in archivos]
    rutas.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    return rutas[0]

def rclone_copy(origen, destino):
    """
    Lanza 'rclone copy origen destino'; retorna True si tuvo éxito.
    """
    cmd = ["rclone", "copy", origen, destino]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] rclone copy falló: {e.stderr.decode().strip()}")
        return False

def rclone_lsjson(ruta_dropbox):
    """
    Retorna la lista de objetos JSON de rclone lsjson para la ruta dada.
    Cada objeto tiene campos como 'Name', 'Size', 'ModTime'.
    """
    cmd = ["rclone", "lsjson", ruta_dropbox]
    try:
        res = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return json.loads(res.stdout.decode())
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] rclone lsjson falló: {e.stderr.decode().strip()}")
        return []

def rclone_delete(ruta_dropbox):
    """
    Borra un archivo en Dropbox (ruta completa).
    """
    cmd = ["rclone", "delete", ruta_dropbox]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"[OK] Borrado en Dropbox: {ruta_dropbox}")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] rclone delete falló: {e.stderr.decode().strip()}")

def build_dropbox_paths(loc, can, lado, filename=None):
    """
    Construye la ruta base en Dropbox para este loc/can/lado.
    Si se pasa filename, devuelve la ruta completa: 
      dropbox:Puntazo/Locaciones/loc/can/lado/filename
    Sino, solo la carpeta: dropbox:Puntazo/Locaciones/loc/can/lado
    """
    carpeta = f"{DROPBOX_BASE}/{loc}/{can}/{lado}"
    if filename:
        return f"{carpeta}/{filename}"
    return carpeta

def upload_and_cleanup():
    # 1. Cargar config
    loc, can, lado = load_config()
    dropbox_folder = build_dropbox_paths(loc, can, lado)

    # 2. Asegurarse de que subidos.txt existe
    os.makedirs(VIDEO_DIR, exist_ok=True)
    if not os.path.exists(REGISTRO_PATH):
        open(REGISTRO_PATH, "w").close()

    # 3. Leer registro de subidos
    with open(REGISTRO_PATH, "r+") as reg:
        subidos = set(linea.strip() for linea in reg if linea.strip())

        # 4. Buscar último video local
        ultimo_local = obtener_ultimo_video_local()
        if not ultimo_local:
            print("[INFO] No hay videos en carpeta local.")
            return

        nombre_local = os.path.basename(ultimo_local)
        if nombre_local in subidos:
            print(f"[INFO] '{nombre_local}' ya fue subido anteriormente.")
        else:
            # 5. Copiar localmente como “ultimo.mp4”
            ruta_fijo = os.path.join(VIDEO_DIR, "ultimo.mp4")
            try:
                if os.path.exists(ruta_fijo):
                    os.remove(ruta_fijo)
                subprocess.run(["cp", ultimo_local, ruta_fijo], check=True)
            except Exception as e:
                print(f"[ERROR] No se pudo copiar a ultimo.mp4: {e}")
                return

            # 6. Intentar subir los archivos (histórico + ultimo.mp4)
            while True:
                print(f"[INFO] Subiendo '{nombre_local}' e 'ultimo.mp4' a Dropbox...")
                # Subir histórico
                exito1 = rclone_copy(ultimo_local, dropbox_folder)
                # Subir fijo
                exito2 = rclone_copy(ruta_fijo, dropbox_folder)
                if exito1 and exito2:
                    print(f"[OK] '{nombre_local}' y 'ultimo.mp4' subidos correctamente.")
                    # Registrar en subidos.txt
                    reg.write(nombre_local + "\n")
                    reg.flush()
                    break
                else:
                    print("[WARN] Falló la subida. Reintentando en 60 s...")
                    time.sleep(60)

        # 7. Ahora generamos el JSON local (videos_recientes.json)
        #  - Listar contenido de la carpeta en Dropbox
        dropbox_list = rclone_lsjson(dropbox_folder)
        #  - Filtrar solo archivos .mp4, calcular edad y borrar > 8 h
        ahora = datetime.now(timezone.utc)
        vigentes = []
        for entry in dropbox_list:
            name = entry.get("Name")
            if not name.lower().endswith(".mp4"):
                continue
            modtime = datetime.fromisoformat(entry.get("ModTime").replace("Z","+00:00"))
            edad_horas = (ahora - modtime).total_seconds() / 3600.0
            ruta_dropbox_archivo = f"{dropbox_folder}/{name}"
            if edad_horas > RETENTION_HOURS:
                # Borrar en Dropbox
                print(f"[INFO] '{name}' tiene {edad_horas:.2f} h, borrando...")
                rclone_delete(ruta_dropbox_archivo)
            else:
                # Construir enlace de compartir de rclone
                cmd_link = ["rclone", "link", ruta_dropbox_archivo]
                res = subprocess.run(cmd_link, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if res.returncode == 0:
                    url_share = res.stdout.decode().strip()
                    # Agregar al listado
                    vigentes.append({
                        "nombre": name,
                        "url": url_share
                    })
                else:
                    print(f"[WARN] No pude obtener link para '{name}'")

        # Escribir JSON local
        json_obj = {
            "videos": vigentes,
            "generado_el": datetime.now(timezone.utc).isoformat()
        }
        with open(JSON_LOCAL, "w") as jf:
            json.dump(json_obj, jf, indent=2)
        print(f"[OK] JSON local generado en '{JSON_LOCAL}' con {len(vigentes)} videos.")
        # 8. Subir también el JSON a Dropbox:
        ruta_json_dropbox = build_dropbox_paths(loc, can, lado, "videos_recientes.json")
        print(f"[INFO] Subiendo JSON a Dropbox: {ruta_json_dropbox}")
        if rclone_copy(JSON_LOCAL, ruta_json_dropbox):
            print(f"[OK] JSON subido a Dropbox en '{ruta_json_dropbox}'")
        else:
            print(f"[ERROR] No se pudo subir JSON a '{ruta_json_dropbox}'")


if __name__ == "__main__":
    upload_and_cleanup()
