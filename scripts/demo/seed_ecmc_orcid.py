"""
File: seed_ecmc_orcid.py
Author: Jhony Alfonso Peñaherrera
Description: Carga de DEMOSTRACIÓN de la producción real de la ECMC en la tabla `products`,
a partir del volcado `base_datos_emcc_yachay_actualizada.sql` (pipeline ORCID → OpenAlex →
Crossref → SCImago generado desde Streamlit).

NO es la importación oficial (HU12, `POST /products/orcid-import`): es un script local para
mostrar el catálogo con datos reales. No crea migraciones ni cambia el modelo.

Decisiones (todas «propuesta a validar con el cliente»):
- Cada obra entra como `source='orcid'` y `status='verificado'`, igual que las obras que
  importa HU12 (CA34): no pasan por el Revisor, así que `reviewed_by` queda vacío.
- El volcado no trae correo ni usuario LDAP de los profesores. Para cumplir la FK
  `products.owner_id` se crea un perfil técnico INACTIVO por profesor
  (usuario `orcid-<ORCID>`, correo `<ORCID>@orcid-import.invalid`). El dominio `.invalid` está
  reservado (RFC 2606), así que nunca coincide con un correo institucional real, y la cuenta
  inactiva no puede iniciar sesión. `--reset` borra todo lo que creó este script.
- Una obra en coautoría entre profesores de la Escuela aparece una vez por profesor en el
  volcado; aquí se consolida por DOI normalizado (o por título + año si no hay DOI). El DOI es
  único en `products`, así que la obra queda a nombre de un solo profesor y los demás
  profesores de la Escuela se listan como coautores.
- `authors` solo lleva a los profesores de la Escuela: el volcado no trae la lista completa.
- `research_line` es obligatoria y el volcado no la trae: se asigna una línea ECMC
  PROVISIONAL por palabras clave del título y del área SCImago.
- Las citas y el cuartil SJR no tienen columna en `products` todavía: no se cargan.

Uso (desde la raíz del repo, con la BD migrada: `alembic upgrade head`):
    python -m scripts.demo.seed_ecmc_orcid --sql RUTA.sql --dry-run
    python -m scripts.demo.seed_ecmc_orcid --sql RUTA.sql
    python -m scripts.demo.seed_ecmc_orcid --reset
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_DEPARTMENTS = ("Matemáticas", "Computación")
SEED_USERNAME_PREFIX = "orcid-"
SEED_EMAIL_DOMAIN = "@orcid-import.invalid"
SCHOOL = "ECMC"

LINE_EQUATIONS = "Ecuaciones diferenciales, análisis matemático, modelamiento y optimización"
LINE_DATA = "Ciencia de datos"
LINE_SCIENTIFIC = "Computación científica"
LINE_AI = "Inteligencia artificial"
LINE_IT = "Tecnologías de la información"
LINE_CTS = "Ciencia, Tecnología y Sociedad"

# Clasificación PROVISIONAL: el orden importa (la primera línea que coincide gana).
# Se busca sin tildes y en minúsculas; ver classify_research_line.
LINE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (LINE_AI, (
        "neural", "deep learning", "machine learning", "artificial intelligence", "reinforcement",
        "fuzzy", "computer vision", "natural language", "transformer", "convolutional",
        "large language", "llm", "agents", "inteligencia artificial", "aprendizaje",
        "classification", "classifier", "detection", "recognition", "segmentation",
    )),
    (LINE_DATA, (
        "data", "dataset", "datos", "big data", "clustering", "dimensionality", "visualization", "kernel",
        "statistic", "estadistic", "mining", "forecast", "analytics", "regression",
        "time series", "bayesian", "spectral",
    )),
    (LINE_SCIENTIFIC, (
        "numerical", "numeric", "simulation", "finite element", "finite difference",
        "high performance", "parallel", "gpu", "computational", "quantum", "monte carlo",
        "iterative method", "solver", "molecular",
    )),
    (LINE_EQUATIONS, (
        "equation", "ecuacion", "differential", "optimization", "optimizacion", "stochastic",
        "controllab", "operator", "banach", "hilbert", "theorem", "manifold", "algebra",
        "topolog", "dynamical", "boundary", "nonlinear", "fractional", "mathematical model",
        "least squares", "fourier", "polynomial", "matri", "integral", "quaternion", "monogenic",
    )),
    (LINE_IT, (
        "network", "wireless", "iot", "internet of things", "software", "security", "blockchain",
        "web", "cloud", "vehicular", "uav", "5g", "6g", "communication", "information system",
        "sensor", "fanet", "manet", "routing",
    )),
    (LINE_CTS, (
        "education", "educacion", "society", "sociedad", "social", "gender", "ethic",
        "teaching", "ensenanza", "student", "estudiante", "university", "universidad",
        "policy", "sustainab", "pandemic", "covid", "cultur", "territorial",
    )),
]

# Si el título no da pistas, se usa el área SCImago de la publicación.
AREA_FALLBACK: list[tuple[str, str]] = [
    ("mathematics", LINE_EQUATIONS),
    ("social sciences", LINE_CTS),
    ("arts and humanities", LINE_CTS),
    ("computer science", LINE_IT),
    ("engineering", LINE_IT),
]
UNCLASSIFIED_LINE = "Por clasificar"


# ---------------------------------------------------------------------------
# 1. Lectura del volcado
# ---------------------------------------------------------------------------

_INSERT = re.compile(r"^(?:REPLACE|INSERT) INTO `(\w+)` \((.*?)\) VALUES")


def read_dump(path: Path) -> dict[str, list[dict]]:
    """Lee las tablas `docentes` y `publicaciones` del volcado.

    El volcado no trae CREATE TABLE, así que no se puede ejecutar en un MySQL vacío. Se
    reconstruyen las tablas en un SQLite en memoria (misma sintaxis de INSERT con comillas
    simples dobladas) solo para leer las filas.
    """
    memory = sqlite3.connect(":memory:")
    memory.row_factory = sqlite3.Row
    created: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        match = _INSERT.match(line)
        if not match:
            continue
        table = match.group(1)
        if table not in created:
            columns = re.findall(r"`([^`]+)`", match.group(2))
            memory.execute(f'CREATE TABLE "{table}" (' + ", ".join(f'"{c}"' for c in columns) + ")")
            created.add(table)
        memory.execute(line.replace("`", '"'))

    missing = {"docentes", "publicaciones"} - created
    if missing:
        raise SystemExit(f"El volcado no contiene las tablas esperadas: {sorted(missing)}")

    def rows(table: str) -> list[dict]:
        result = []
        for row in memory.execute(f'SELECT * FROM "{table}"'):
            # MySQL escribe la barra invertida como \\; SQLite la conserva doble.
            result.append({
                key: value.replace("\\\\", "\\") if isinstance(value, str) else value
                for key, value in dict(row).items()
            })
        return result

    return {"docentes": rows("docentes"), "publicaciones": rows("publicaciones")}


# ---------------------------------------------------------------------------
# 2. Transformación a productos
# ---------------------------------------------------------------------------

def _plain(text: str | None) -> str:
    text = unicodedata.normalize("NFD", text or "")
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn").lower()


def _matches(text: str, keyword: str) -> bool:
    """Coincidencia por palabra: la clave empieza en un límite de palabra, así «statistic»
    encuentra «statistical». Las claves cortas (4 letras o menos) deben ser la palabra
    completa, para que «web» no coincida con «Weber» ni «iot» con «iota»."""
    end = r"\b" if len(keyword) <= 4 else ""
    return re.search(rf"\b{re.escape(keyword)}{end}", text) is not None


def _line_for(text: str) -> str | None:
    for line, keywords in LINE_KEYWORDS:
        if any(_matches(text, keyword) for keyword in keywords):
            return line
    return None


def classify_research_line(title: str, categories: str, area: str) -> str:
    """Línea ECMC PROVISIONAL.

    Primero manda el título (es lo que describe la obra); si no da pistas, las categorías
    SCImago de la revista; y al final, el área SCImago. Sin coincidencias: «Por clasificar».
    """
    for text in (_plain(title), _plain(categories)):
        line = _line_for(text)
        if line:
            return line
    area_text = _plain(area)
    for area_key, line in AREA_FALLBACK:
        if area_key in area_text:
            return line
    return UNCLASSIFIED_LINE


def _clean(value) -> str:
    return str(value).strip() if value not in (None, "") else ""


def _year(value) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


@dataclass
class SeedProduct:
    owner_orcid: str
    title: str
    year: int
    doi: str | None
    venue: str | None
    research_line: str
    external_id: str
    authors: list[str] = field(default_factory=list)
    work_type: str = ""


@dataclass
class SeedPlan:
    professors: dict[str, str]  # orcid -> nombre
    products: list[SeedProduct]
    skipped: Counter


def build_plan(dump: dict[str, list[dict]], departments: tuple[str, ...], only_yachay: bool) -> SeedPlan:
    """Filtra, consolida coautorías y deja listo lo que se va a insertar."""
    from app.utils.identifiers import normalize_doi, normalize_orcid

    names = {normalize_orcid(d["orcid"]): _clean(d["nombre"]) for d in dump["docentes"]}
    skipped: Counter = Counter()
    groups: dict[str, list[dict]] = {}

    for row in dump["publicaciones"]:
        if row["Departamento"] not in departments:
            skipped["fuera de los departamentos elegidos"] += 1
            continue
        if only_yachay and row["Afiliado Yachay"] != "Sí":
            skipped["sin afiliación Yachay confirmada"] += 1
            continue
        year = _year(row["Año"])
        title = _clean(row["Título"])
        if year is None or not title:
            skipped["sin año o sin título"] += 1
            continue
        doi = normalize_doi(_clean(row["DOI"])) or None
        key = f"doi:{doi}" if doi else f"title:{_plain(title)}|{year}"
        groups.setdefault(key, []).append(row)

    products: list[SeedProduct] = []
    professors: dict[str, str] = {}
    for rows in groups.values():
        # Dueño: el profesor que figura como primer autor; si ninguno, el primero del volcado.
        rows.sort(key=lambda r: r["Posición del docente"] != "Primero")
        first = rows[0]
        owner = normalize_orcid(first["ORCID"])
        authors: list[str] = []
        for row in rows:
            orcid = normalize_orcid(row["ORCID"])
            name = names.get(orcid) or _clean(row["Investigador"])
            professors[orcid] = name
            if name not in authors:
                authors.append(name)
        if len(rows) > 1:
            skipped["filas repetidas por coautoría (consolidadas)"] += len(rows) - 1

        doi = normalize_doi(_clean(first["DOI"])) or None
        openalex = _clean(first["ID OpenAlex"])
        external_id = (openalex or (f"doi:{doi}" if doi else f"title:{_plain(first['Título'])[:200]}"))[:255]
        products.append(SeedProduct(
            owner_orcid=owner,
            title=_clean(first["Título"])[:500],
            year=_year(first["Año"]),
            doi=doi[:255] if doi else None,
            venue=_clean(first["Revista/Conferencia"])[:500] or None,
            research_line=classify_research_line(
                first["Título"], _clean(first["Campo / Categorías"]), _clean(first["Área Publicación"])
            ),
            external_id=external_id,
            authors=authors,
            work_type=_clean(first["Tipo"]),
        ))

    return SeedPlan(professors=professors, products=products, skipped=skipped)


# ---------------------------------------------------------------------------
# 3. Escritura en la BD de la aplicación
# ---------------------------------------------------------------------------

def seed_username(orcid: str) -> str:
    return f"{SEED_USERNAME_PREFIX}{orcid.lower()}"


def apply_plan(db, plan: SeedPlan) -> Counter:
    """Inserta perfiles técnicos y productos. Es idempotente: lo que ya existe se salta."""
    from sqlalchemy import select

    from app.models.product import Product
    from app.models.user import User

    stats: Counter = Counter()
    owner_ids: dict[str, str] = {}
    for orcid, name in plan.professors.items():
        user = db.scalar(select(User).where(User.username == seed_username(orcid)))
        if user is None:
            # Si un profesor real ya registró ese ORCID, no se repite (columna única).
            orcid_taken = db.scalar(select(User.id).where(User.orcid == orcid)) is not None
            user = User(
                username=seed_username(orcid),
                email=f"{orcid.lower()}{SEED_EMAIL_DOMAIN}",
                full_name=name,
                role="professor",
                is_active=False,
                school=SCHOOL,
                orcid=None if orcid_taken else orcid,
            )
            db.add(user)
            db.flush()
            stats["perfiles técnicos creados"] += 1
        owner_ids[orcid] = user.id

    existing_dois = set(db.scalars(select(Product.doi).where(Product.doi.is_not(None))))
    existing_keys = set(db.execute(select(Product.owner_id, Product.external_id)).all())
    for item in plan.products:
        owner_id = owner_ids[item.owner_orcid]
        if (item.doi and item.doi in existing_dois) or (owner_id, item.external_id) in existing_keys:
            stats["productos ya existentes (saltados)"] += 1
            continue
        db.add(Product(
            owner_id=owner_id,
            school=SCHOOL,
            type="publicacion",
            title=item.title,
            authors=item.authors,
            year=item.year,
            research_line=item.research_line,
            doi=item.doi,
            venue=item.venue,
            status="verificado",
            source="orcid",
            external_id=item.external_id,
        ))
        if item.doi:
            existing_dois.add(item.doi)
        existing_keys.add((owner_id, item.external_id))
        stats["productos creados"] += 1

    db.commit()
    return stats


def reset_seed(db) -> Counter:
    """Borra solo lo que creó este script: perfiles técnicos y sus productos."""
    from sqlalchemy import delete, select

    from app.models.notification import Notification
    from app.models.product import Product
    from app.models.user import User

    user_ids = list(db.scalars(
        select(User.id).where(
            User.username.like(f"{SEED_USERNAME_PREFIX}%"),
            User.email.like(f"%{SEED_EMAIL_DOMAIN}"),
        )
    ))
    stats: Counter = Counter()
    if user_ids:
        stats["notificaciones borradas"] = db.execute(
            delete(Notification).where(Notification.user_id.in_(user_ids))
        ).rowcount
        stats["productos borrados"] = db.execute(delete(Product).where(Product.owner_id.in_(user_ids))).rowcount
        stats["perfiles técnicos borrados"] = db.execute(delete(User).where(User.id.in_(user_ids))).rowcount
    db.commit()
    return stats


def print_summary(plan: SeedPlan) -> None:
    lines = Counter(p.research_line for p in plan.products)
    print(f"Profesores con obras: {len(plan.professors)}")
    print(f"Productos a cargar:   {len(plan.products)} "
          f"({sum(1 for p in plan.products if p.doi)} con DOI)")
    print("Por línea de investigación (PROVISIONAL):")
    for line, count in lines.most_common():
        print(f"  {count:4d}  {line}")
    print("Filas descartadas o consolidadas:")
    for reason, count in plan.skipped.most_common():
        print(f"  {count:4d}  {reason}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Carga demo de la producción ECMC (no es la importación oficial).")
    parser.add_argument("--sql", type=Path, help="Ruta del volcado base_datos_emcc_yachay_actualizada.sql")
    parser.add_argument("--departamentos", default=",".join(DEFAULT_DEPARTMENTS),
                        help="Departamentos a cargar, separados por coma (por defecto: Matemáticas,Computación)")
    parser.add_argument("--solo-yachay", action="store_true",
                        help="Cargar solo obras con afiliación Yachay confirmada")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar el resumen sin escribir en la BD")
    parser.add_argument("--reset", action="store_true", help="Borrar todo lo que creó este script")
    args = parser.parse_args(argv)

    if args.reset:
        from app.db.session import SessionLocal
        with SessionLocal() as db:
            for key, value in reset_seed(db).items():
                print(f"{key}: {value}")
        return 0

    if not args.sql or not args.sql.is_file():
        parser.error("indica el volcado con --sql RUTA (el archivo no existe)")

    departments = tuple(d.strip() for d in args.departamentos.split(",") if d.strip())
    plan = build_plan(read_dump(args.sql), departments, args.solo_yachay)
    print_summary(plan)
    if args.dry_run:
        print("\n--dry-run: no se escribió nada.")
        return 0

    from app.db.session import SessionLocal
    with SessionLocal() as db:
        stats = apply_plan(db, plan)
    print()
    for key, value in stats.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
