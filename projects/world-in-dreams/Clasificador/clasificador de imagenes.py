import csv, ctypes, json, os, re, shutil, subprocess, threading, unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# ================= CONFIGURA AQUÍ =================
CARPETA = r"D:\AI\Game_References"                 # imágenes sin clasificar
DESTINO = r"D:\AI\Game_References\Clasificadas"    # aquí se crea el árbol de carpetas
MODELO  = "opencode-go/deepseek-v4.1-flash"        # lista completa: opencode models
ESFUERZO = "high"    # este modelo admite: "low" | "high" | "max"  ("" = el de OpenCode)
MODO    = "mover"   # "probar" = solo CSV | "copiar" | "mover"
LIMITE  = 20          # None = todas
HILOS   = 5          # imágenes procesadas a la vez
MOSTRAR_OCULTAS = True   # quita el atributo "oculto" a las imágenes copiadas/movidas

# Árbol de carpetas. Las llaves {...} son segmentos que rellena la IA.
# {} = carpeta final (donde acaban las imágenes)
ARBOL = {
    "anime": {
        "personajes": {
            "{especie}": {
                "masculino": {
                    "normal": {},
                    "erotica": {},
                    "sexual": {},
                },
                "femenino": {
                    "normal": {},
                    "erotica": {},
                    "sexual": {},
                },
            },
        },
        "animales": {
            "{especie}": {},
        },
        "escenarios": {
            "interior": {},
            "exterior": {},
        },
        "otros": {},
    },
    "realista": {},
}

# Qué debe escribir la IA en cada llave {...}
VARIABLES = {
    "especie": ("especie o tipo (orco, elfo, goblin, dragon, humano, lobo, gato, caballo...), "
                "en singular, en minúsculas y sin tildes"),
}

# Opcional: aclara las carpetas dudosas (la clave es la ruta completa, tal como aparece en el árbol)
DESCRIPCIONES = {
    "anime/personajes/{especie}/masculino/normal": "personaje masculino sin contenido sexual ni erótico",
    "anime/personajes/{especie}/masculino/erotica": "personaje masculino con contenido erótico (desnudos, insinuaciones sexuales...)",
    "anime/personajes/{especie}/masculino/sexual": "personaje masculino con contenido sexual explícito (penetración, sexo oral...)",
    "anime/personajes/{especie}/femenino/normal": "personaje femenino sin contenido sexual ni erótico",
    "anime/personajes/{especie}/femenino/erotica": "personaje femenino con contenido erótico (desnudos, insinuaciones sexuales...)",
    "anime/personajes/{especie}/femenino/sexual": "personaje femenino con contenido sexual explícito (penetración, sexo oral...)",
    "anime/animales/{especie}": "animal; la llave {especie} indica de qué animal se trata",
    "anime/escenarios/interior": "escenario interior (habitación, cueva, taberna...)",
    "anime/escenarios/exterior": "escenario exterior (bosque, ciudad, montaña...)",
    "anime/otros": "cualquier imagen que no encaje en las demás carpetas",
}

# Carpetas "abiertas": además de la carpeta final, la IA puede crear una subcarpeta.
# Clave = ruta de una carpeta final del árbol; valor = qué debe significar la subcarpeta.
ABIERTAS = {
    "anime/otros": "subcategoría de la imagen (mapa, objeto, interfaz...)",
}
INSTRUCCIONES = ("Mira la imagen y elige la carpeta que mejor la describe. "
                 "Si hay varios personajes, elige el más prominente.")
# ==================================================

EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 10 * 1024 * 1024   # OpenCode no adjunta archivos de más de 10 MiB
TIEMPO_MAX = 180               # segundos por imagen


def buscar_opencode() -> str:
    shim = shutil.which("opencode")
    if not shim:
        raise SystemExit("No se encuentra OpenCode. Instálalo o revisa el PATH.")
    exe = Path(shim).parent / "node_modules" / "@opencode" / "cli" / "bin" / "opencode.exe"
    return str(exe) if exe.exists() else shim


OPENCODE = buscar_opencode()
MODELO_RUN = f"{MODELO}#{ESFUERZO}" if ESFUERZO else MODELO


def hojas(arbol, prefijo=""):
    for nombre, hijos in arbol.items():
        ruta = f"{prefijo}/{nombre}" if prefijo else nombre
        if hijos:
            yield from hojas(hijos, ruta)
        else:
            yield ruta


RUTAS = list(hojas(ARBOL))
LLAVE = re.compile(r"\{([^{}]+)\}")


def variables_de(ruta: str):
    """[(prefijo, llave), ...] para cada {...} de la ruta."""
    return [(ruta[:m.start()].rstrip("/"), m.group(1)) for m in LLAVE.finditer(ruta)]


# ---- validación de la configuración: mejor fallar aquí que a mitad de la tanda ----
for _r in RUTAS:
    for _m in LLAVE.finditer(_r):
        _antes, _despues = _r[:_m.start()], _r[_m.end():]
        if (_antes and not _antes.endswith("/")) or (_despues and not _despues.startswith("/")):
            raise SystemExit(f"ARBOL: la llave '{{{_m.group(1)}}}' debe ocupar una carpeta completa en '{_r}'")
        if _m.group(1) not in VARIABLES:
            raise SystemExit(f"ARBOL: la llave '{{{_m.group(1)}}}' de '{_r}' no está definida en VARIABLES")
for _tok in VARIABLES:
    if not any(_tok == _t for _r in RUTAS for _, _t in variables_de(_r)):
        raise SystemExit(f"VARIABLES: '{_tok}' no se usa en el árbol")
for _r in ABIERTAS:
    if _r not in RUTAS:
        raise SystemExit(f"ABIERTAS: '{_r}' no es una carpeta final del árbol")
    if variables_de(_r):
        raise SystemExit(f"ABIERTAS: '{_r}' no puede contener llaves")
for _r in DESCRIPCIONES:
    if _r not in RUTAS:
        raise SystemExit(f"DESCRIPCIONES: '{_r}' no es una carpeta final del árbol")


def normalizar(nombre: str) -> str:
    """'Dragón ' -> 'dragon'; quita tildes y caracteres no válidos en Windows."""
    n = unicodedata.normalize("NFKD", str(nombre)).encode("ascii", "ignore").decode().lower()
    n = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", n)
    n = re.sub(r"\s+", " ", n).strip(" .")
    return n[:40].strip(" .")


IRREGULARES = {"aves": "ave", "peces": "pez"}


def formas(nombre: str) -> set:
    """Variantes (singular/plural) para reutilizar carpetas ya existentes."""
    n = normalizar(nombre)
    if not n:
        return set()
    variantes = {n}
    if n in IRREGULARES:
        variantes.add(IRREGULARES[n])
    if n.endswith("s") and len(n) > 2:
        variantes.add(n[:-1])
    if n.endswith("es") and len(n) > 3:
        variantes.add(n[:-2])
    return variantes


# Subcarpetas ya conocidas en cada carpeta abierta (las del disco + las creadas en esta tanda)
cerrojo = threading.Lock()
conocidas = {}
for _r in ABIERTAS:
    _d = Path(DESTINO, *_r.split("/"))
    try:
        conocidas[_r] = {p.name for p in _d.iterdir() if p.is_dir()} if _d.exists() else set()
    except OSError:
        conocidas[_r] = set()

# Valores ya usados para cada llave {...}, separados por la carpeta donde aparecen
# (por ejemplo, las especies de anime/personajes y las de anime/animales son listas distintas)
valores = {}
for _r in RUTAS:
    for _pref, _tok in variables_de(_r):
        _clave = (_pref, _tok)
        if _clave in valores:
            continue
        _d = Path(DESTINO, *_pref.split("/")) if _pref else Path(DESTINO)
        try:
            valores[_clave] = {p.name for p in _d.iterdir() if p.is_dir()} if _d.exists() else set()
        except OSError:
            valores[_clave] = set()


def registrar_valor(clave, propuesta: str) -> str:
    """Devuelve el valor existente equivalente o registra el nuevo."""
    nombre = normalizar(propuesta) or "desconocido"
    buscadas = formas(nombre)
    with cerrojo:
        for existente in valores[clave]:
            if formas(existente) & buscadas:
                return existente
        valores[clave].add(nombre)
        return nombre


def registrar_sub(ruta: str, propuesta: str) -> str:
    """Devuelve la subcarpeta existente equivalente o registra la nueva."""
    sub = normalizar(propuesta)
    if not sub:
        return ""
    buscadas = formas(sub)
    with cerrojo:
        for existente in conocidas[ruta]:
            if formas(existente) & buscadas:
                return existente
        conocidas[ruta].add(sub)
        return sub


def construir_prompt() -> str:
    lineas = []
    with cerrojo:
        for r in RUTAS:
            l = f"- {r}" + (f"  ({DESCRIPCIONES[r]})" if r in DESCRIPCIONES else "")
            if r in ABIERTAS:
                ex = ", ".join(sorted(conocidas[r])) or "(ninguna todavía)"
                l += f"\n    [admite subcarpeta: {ABIERTAS[r]}. Ya existen: {ex}]"
            lineas.append(l)
        variables_txt = []
        for (pref, tok), nombres in sorted(valores.items()):
            ex = ", ".join(sorted(nombres)) or "(ninguno todavía)"
            variables_txt.append(f"- {{{tok}}} (en {pref}): {VARIABLES[tok]}. Ya usados: {ex}")
    texto = f"{INSTRUCCIONES}\nCarpetas válidas:\n" + "\n".join(lineas) + "\n\n"
    if variables_txt:
        texto += ("Rellena cada llave {...} con un valor corto, en singular y en minúsculas. "
                  "Reutiliza uno de los valores ya usados si encaja:\n" + "\n".join(variables_txt) + "\n\n")
    if ABIERTAS:
        texto += ("Si eliges una carpeta que admite subcarpeta, indica también la subcarpeta: "
                  "reutiliza una de las que ya existen si encaja; si ninguna encaja, inventa un "
                  "nombre corto en español, en singular y en minúsculas. "
                  "Para las demás carpetas, deja la subcarpeta vacía.\n\n")
    ejemplo = next((r for r in RUTAS if variables_de(r)), None)
    if ejemplo:
        tok = variables_de(ejemplo)[0][1]
        texto += ('Ejemplo: si eliges "' + ejemplo + '" y la ' + tok + ' es un orco, responde:\n'
                  '{"carpeta": "' + ejemplo + '", "valores": {"' + tok + '": "orco"}, "subcarpeta": ""}\n\n')
    claves = '", "'.join(VARIABLES)
    valores_json = ('{"' + claves + '": "<valor o vacío>"}') if claves else "{}"
    texto += ("No uses herramientas. Responde SOLO con este JSON, sin nada más:\n"
              '{"carpeta": "<una de las rutas exactas de la lista, conservando las llaves {...}>", '
              '"valores": ' + valores_json + ', "subcarpeta": "<nombre o vacío>"}\n'
              'Si la carpeta elegida no tiene llaves, usa "valores": {}.')
    return texto


def preguntar(img: Path, prompt: str) -> str:
    """Envía la imagen a OpenCode y devuelve el texto de la respuesta."""
    cmd = [OPENCODE, "run", "--archived", "--format", "json", "-m", MODELO_RUN,
           "-f", str(img), prompt]
    if Path(OPENCODE).suffix.lower() in (".cmd", ".bat"):
        cmd = [os.environ.get("COMSPEC", "cmd.exe"), "/c"] + cmd
    r = subprocess.run(
        cmd,
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=TIEMPO_MAX, cwd=Path(__file__).parent)
    textos, errores = [], []
    for linea in r.stdout.splitlines():
        try:
            ev = json.loads(linea)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "text":
            textos.append(ev.get("part", {}).get("text", ""))
        elif ev.get("type") == "error":
            errores.append(ev.get("error", {}).get("message", "error desconocido"))
    if errores:
        raise RuntimeError(errores[-1])
    if not textos:
        detalle = (r.stderr or r.stdout or "sin respuesta").strip()
        raise RuntimeError(f"código {r.returncode}: {detalle[-300:]}")
    return textos[-1]


DECODER = json.JSONDecoder()


def extraer_jsons(texto: str):
    """Todos los objetos JSON válidos del texto, aunque vengan con prosa alrededor."""
    objetos = []
    i = 0
    while i < len(texto):
        if texto[i] == "{":
            try:
                obj, fin = DECODER.raw_decode(texto[i:])
            except json.JSONDecodeError:
                i += 1
                continue
            if isinstance(obj, dict):
                objetos.append(obj)
                i += fin
                continue
        i += 1
    return objetos


def emparejar_ruta(ruta: str):
    """Devuelve (plantilla, valores detectados) o (None, {}).

    Acepta tanto la plantilla exacta ('anime/personajes/{especie}/...') como la
    ruta ya rellenada por el modelo ('anime/personajes/orco/...').
    """
    ruta = str(ruta).strip().strip("`\"'").replace("\\", "/").strip("/")
    if not ruta:
        return None, {}
    exacta = {r.lower(): r for r in RUTAS}.get(ruta.lower())
    if exacta:
        return exacta, {}
    piezas = ruta.split("/")
    for plantilla in RUTAS:
        partes = plantilla.split("/")
        if len(partes) != len(piezas):
            continue
        detectados = {}
        for p, v in zip(partes, piezas):
            if p.startswith("{") and p.endswith("}"):
                detectados[p[1:-1]] = v
            elif normalizar(p) != normalizar(v):
                break
        else:
            return plantilla, detectados
    return None, {}


def clasificar(img: Path) -> str:
    if img.stat().st_size > MAX_BYTES:
        raise ValueError("archivo de más de 10 MiB")
    ultimo = ""
    for _ in range(2):                       # un reintento si la respuesta no es válida
        try:
            ultimo = preguntar(img, construir_prompt())
        except Exception as e:
            ultimo = f"ERROR: {e}"
            continue
        datos = None
        for candidato in reversed(extraer_jsons(ultimo)):
            plantilla, detectados = emparejar_ruta(candidato.get("carpeta", ""))
            if plantilla:
                datos = candidato
                break
        if not datos:
            continue
        valores_resp = datos.get("valores")
        if isinstance(valores_resp, str):
            try:
                valores_resp = json.loads(valores_resp)
            except json.JSONDecodeError:
                valores_resp = {}
        if not isinstance(valores_resp, dict):
            valores_resp = {}
        valores_resp = {str(k).strip().lower(): v for k, v in valores_resp.items()}
        partes = plantilla.split("/")
        for i, pieza in enumerate(partes):
            if pieza.startswith("{") and pieza.endswith("}"):
                tok = pieza[1:-1]
                pref = "/".join(partes[:i])
                propuesta = valores_resp.get(tok) or detectados.get(tok) or ""
                if not isinstance(propuesta, str):
                    propuesta = ""
                partes[i] = registrar_valor((pref, tok), propuesta)
        final = "/".join(partes)
        if plantilla in ABIERTAS:
            sub_prop = datos.get("subcarpeta")
            if not isinstance(sub_prop, str):
                sub_prop = ""
            sub = registrar_sub(plantilla, sub_prop)
            if sub:
                final = f"{final}/{sub}"
        return final
    raise ValueError(f"respuesta inválida: {ultimo[:160]}")


def destino_libre(carpeta: Path, nombre: str) -> Path:
    p, n = carpeta / nombre, 1
    while p.exists():                        # evita sobrescribir si ya existe
        p = carpeta / f"{Path(nombre).stem}_{n}{Path(nombre).suffix}"
        n += 1
    return p


def quitar_oculto(p: Path):
    if os.name != "nt":
        return
    k32 = ctypes.windll.kernel32
    k32.GetFileAttributesW.restype = ctypes.c_uint32
    k32.GetFileAttributesW.argtypes = [ctypes.c_wchar_p]
    k32.SetFileAttributesW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32]
    attrs = k32.GetFileAttributesW(str(p))
    if attrs != 0xFFFFFFFF and attrs & 2:
        k32.SetFileAttributesW(str(p), attrs & ~2)


def intentar(img: Path):
    try:
        return img, clasificar(img)
    except Exception as e:
        return img, f"ERROR: {e}"


def main():
    if MODO not in ("probar", "copiar", "mover"):
        raise SystemExit("MODO debe ser 'probar', 'copiar' o 'mover'")
    if not isinstance(HILOS, int) or HILOS < 1:
        raise SystemExit("HILOS debe ser un número entero mayor que 0")
    if LIMITE is not None and (not isinstance(LIMITE, int) or LIMITE < 1):
        raise SystemExit("LIMITE debe ser None o un número entero mayor que 0")
    origen = Path(CARPETA)
    if not origen.is_dir():
        raise SystemExit(f"No existe la carpeta de imágenes: {origen}")

    Path(DESTINO).mkdir(parents=True, exist_ok=True)
    registro = Path(DESTINO) / ("prueba.csv" if MODO == "probar" else "registro.csv")

    hechas = set()
    if MODO == "copiar" and registro.exists():    # reanudar sin repetir
        try:
            with open(registro, encoding="utf-8-sig", newline="") as f:
                for fila in csv.DictReader(f):
                    archivo = (fila.get("archivo") or "").strip()
                    carpeta = (fila.get("carpeta") or "").strip()
                    if archivo and not carpeta.startswith("ERROR"):
                        hechas.add(archivo)
        except (OSError, csv.Error):
            pass

    imagenes = [p for p in sorted(origen.iterdir())
                if p.is_file() and p.suffix.lower() in EXT and p.name not in hechas]
    if LIMITE:
        imagenes = imagenes[:LIMITE]

    print(f"Modo: {MODO} | Modelo: {MODELO_RUN} | Imágenes: {len(imagenes)}\n", flush=True)
    conteo = {}
    nuevo = MODO == "probar" or not registro.exists() or registro.stat().st_size == 0
    with open(registro, "w" if MODO == "probar" else "a", newline="", encoding="utf-8-sig") as f, \
            ThreadPoolExecutor(max_workers=HILOS) as pool:
        w = csv.writer(f)
        if nuevo:
            w.writerow(["archivo", "carpeta", "destino"])
        for i, (img, ruta) in enumerate(pool.map(intentar, imagenes), 1):
            destino = ""
            if not ruta.startswith("ERROR") and MODO in ("copiar", "mover"):
                try:
                    carpeta_final = Path(DESTINO, *ruta.split("/"))
                    carpeta_final.mkdir(parents=True, exist_ok=True)
                    destino = destino_libre(carpeta_final, img.name)
                    (shutil.copy2 if MODO == "copiar" else shutil.move)(img, destino)
                    if MOSTRAR_OCULTAS:
                        try:
                            quitar_oculto(destino)
                        except Exception:
                            pass
                except Exception as e:
                    ruta, destino = f"ERROR al copiar/mover: {e}", ""
            clave = "ERROR" if ruta.startswith("ERROR") else ruta
            conteo[clave] = conteo.get(clave, 0) + 1
            print(f"[{i}/{len(imagenes)}] {img.name} -> {ruta}", flush=True)
            w.writerow([img.name, ruta, str(destino)])
            f.flush()

    print("\nResumen:", flush=True)
    for k, v in sorted(conteo.items()):
        print(f"  {k}: {v}", flush=True)
    print(f"\nRegistro guardado en: {registro}", flush=True)


if __name__ == "__main__":
    main()
