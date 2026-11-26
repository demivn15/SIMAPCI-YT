"""
Pruebas del script de carga demo de la producción ECMC (scripts/demo/seed_ecmc_orcid.py).

Se usa un volcado mínimo con el mismo formato del original (sin CREATE TABLE, con
REPLACE INTO para docentes e INSERT INTO para publicaciones) y la BD SQLite de conftest.
"""

from pathlib import Path

from sqlalchemy import select

from app.models.product import Product
from app.models.user import User
from app.models.product_bibliometrics import ProductBibliometrics
from scripts.demo.seed_ecmc_orcid import (
    LINE_EQUATIONS,
    apply_plan,
    bibliometrics_from_row,
    build_plan,
    classify_research_line,
    read_dump,
    reset_seed,
)

PUB_COLUMNS = (
    "`Investigador`, `ORCID`, `Departamento`, `Año`, `Título`, `DOI`, `Tipo`, `Revista/Conferencia`, "
    "`Campo / Categorías`, `Área Publicación`, `Afiliado Yachay`, `Posición del docente`, `ID OpenAlex`"
)


def _pub(name, orcid, dept, year, title, doi, position="Intermedio", openalex="", yachay="Sí"):
    year_sql = "NULL" if year is None else f"{year}.0"
    title_sql = title.replace("'", "''")
    return (
        f"INSERT INTO `publicaciones` ({PUB_COLUMNS}) VALUES ('{name}', '{orcid}', '{dept}', {year_sql}, "
        f"'{title_sql}', '{doi}', 'journal-article', 'Revista X', 'Mathematics (Q1)', 'Mathematics', "
        f"'{yachay}', '{position}', '{openalex}');"
    )


def _write_dump(tmp_path: Path) -> Path:
    lines = [
        "SET NAMES utf8mb4;",
        "REPLACE INTO `docentes` (`orcid`, `nombre`, `departamento`) VALUES "
        "('0000-0002-1825-0097', 'Ana Morales', 'Matemáticas');",
        "REPLACE INTO `docentes` (`orcid`, `nombre`, `departamento`) VALUES "
        "('0000-0001-5109-3700', 'Luis Paredes', 'Computación');",
        "REPLACE INTO `docentes` (`orcid`, `nombre`, `departamento`) VALUES "
        "('0000-0002-1694-233X', 'Eva Ruiz', 'Desarrollo Humano');",
        "TRUNCATE TABLE `publicaciones`;",
        # Coautoría: misma obra en dos profesores, DOI con mayúsculas y prefijo distintos.
        _pub("Luis Paredes", "0000-0001-5109-3700", "Computación", 2024, "Stability of nonlinear equations",
             "https://doi.org/10.1000/ABC", openalex="https://openalex.org/W1"),
        _pub("Ana Morales", "0000-0002-1825-0097", "Matemáticas", 2024, "Stability of nonlinear equations",
             "10.1000/abc", position="Primero", openalex="https://openalex.org/W1"),
        # Sin DOI, con comilla en el título.
        _pub("Ana Morales", "0000-0002-1825-0097", "Matemáticas", 2020, "Hilbert's operators", ""),
        # Sin año: se descarta.
        _pub("Ana Morales", "0000-0002-1825-0097", "Matemáticas", None, "Sin fecha", "10.1000/nodate"),
        # Departamento fuera del alcance por defecto.
        _pub("Eva Ruiz", "0000-0002-1694-233X", "Desarrollo Humano", 2022, "Education and society", "10.1000/dh"),
        # Afiliación no verificable.
        _pub("Luis Paredes", "0000-0001-5109-3700", "Computación", 2019, "Wireless routing", "10.1000/w",
             yachay="No verificable"),
    ]
    path = tmp_path / "dump.sql"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def test_build_plan_consolidates_coauthorship_and_filters(tmp_path):
    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=False)

    assert len(plan.products) == 3
    shared = next(p for p in plan.products if p.doi == "10.1000/abc")
    # Dueño: el profesor que figura como primer autor; el coautor de la Escuela se conserva.
    assert shared.owner_orcid == "0000-0002-1825-0097"
    assert shared.authors == ["Ana Morales", "Luis Paredes"]
    assert any(p.title == "Hilbert's operators" and p.doi is None for p in plan.products)
    assert plan.skipped["sin año o sin título"] == 1
    assert plan.skipped["fuera de los departamentos elegidos"] == 1
    assert plan.skipped["filas repetidas por coautoría (consolidadas)"] == 1


def test_only_yachay_flag_drops_unverified_affiliation(tmp_path):
    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=True)
    assert {p.title for p in plan.products} == {"Stability of nonlinear equations", "Hilbert's operators"}


def test_apply_is_idempotent_and_reset_removes_only_seed_data(tmp_path, db_session):
    real = User(username="jperez", email="jperez@yachaytech.edu.ec", full_name="J. Pérez")
    db_session.add(real)
    db_session.commit()

    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=False)
    first = apply_plan(db_session, plan)
    assert first["productos creados"] == 3
    assert first["perfiles técnicos creados"] == 2

    products = db_session.scalars(select(Product)).all()
    assert all(p.status == "verificado" and p.source == "orcid" and p.reviewed_by is None for p in products)
    seed_users = db_session.scalars(select(User).where(User.username.like("orcid-%"))).all()
    assert all(not u.is_active and u.email.endswith("@orcid-import.invalid") for u in seed_users)

    assert first["indicadores bibliométricos creados"] == 3
    assert len(db_session.scalars(select(ProductBibliometrics)).all()) == 3

    second = apply_plan(db_session, plan)
    assert second["productos creados"] == 0
    assert second["productos ya existentes (saltados)"] == 3

    stats = reset_seed(db_session)
    assert stats["productos borrados"] == 3
    assert stats["indicadores borrados"] == 3
    assert db_session.scalars(select(Product)).all() == []
    assert [u.username for u in db_session.scalars(select(User)).all()] == ["jperez"]


def test_research_line_prefers_title_and_respects_word_boundaries():
    assert classify_research_line("Weber and the city", "", "Mathematics") == LINE_EQUATIONS
    assert classify_research_line("Deep learning for images", "Mathematics (Q1)", "") == "Inteligencia artificial"
    assert classify_research_line("IoT sensors", "", "") == "Tecnologías de la información"
    assert classify_research_line("Statistical inference", "", "") == "Ciencia de datos"
    assert classify_research_line("Untitled", "", "") == "Por clasificar"


def test_bibliometrics_zero_citations_without_openalex_are_unknown():
    base = {"Cuartil SJR": "Sin cuartil", "Afiliado Yachay": "No verificable", "Acceso abierto": "",
            "Tipo de colaboración": "Internacional", "Instituciones participantes": "Yachay; UPC",
            "Países de las instituciones": "EC; ES", "Fecha y hora de consulta": "2026-11-10 13:08:45"}
    unknown = bibliometrics_from_row({**base, "Citas": 0, "ID OpenAlex": ""})
    known_zero = bibliometrics_from_row({**base, "Citas": 0, "ID OpenAlex": "https://openalex.org/W1"})
    assert unknown["citations"] is None
    assert known_zero["citations"] == 0
    assert unknown["sjr_quartile"] is None and unknown["is_open_access"] is None
    assert unknown["yachay_affiliation"] == "no_verificable"
    assert unknown["collaboration_type"] == "internacional"
    assert unknown["countries"] == ["EC", "ES"]


def test_plan_carries_department_and_contribution_type(tmp_path):
    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=False)
    # El departamento sale de la tabla `docentes`, enlazada por ORCID.
    assert plan.departments == {"0000-0002-1825-0097": "Matemáticas", "0000-0001-5109-3700": "Computación"}
    assert {p.metrics["contribution_type"] for p in plan.products} == {"journal-article"}


def test_apply_sets_department_and_type_and_completes_existing_rows(tmp_path, db_session):
    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=False)
    apply_plan(db_session, plan)

    users = {u.full_name: u for u in db_session.scalars(select(User).where(User.username.like("orcid-%")))}
    assert users["Ana Morales"].department == "Matemáticas"
    assert users["Luis Paredes"].department == "Computación"
    assert {m.contribution_type for m in db_session.scalars(select(ProductBibliometrics))} == {"journal-article"}

    # Simula una BD cargada con la versión anterior del script: sin departamento ni tipo.
    for user in users.values():
        user.department = None
    for metrics in db_session.scalars(select(ProductBibliometrics)):
        metrics.contribution_type = None
    db_session.commit()

    stats = apply_plan(db_session, plan)
    assert stats["departamentos completados"] == 2
    assert stats["tipos de contribución completados"] == 3
    assert stats["productos creados"] == 0 and stats["perfiles técnicos creados"] == 0
    assert stats["indicadores bibliométricos creados"] == 0
    assert len(db_session.scalars(select(Product)).all()) == 3
    assert len(db_session.scalars(select(ProductBibliometrics)).all()) == 3
    assert users["Ana Morales"].department == "Matemáticas"
    assert {m.contribution_type for m in db_session.scalars(select(ProductBibliometrics))} == {"journal-article"}

    # Una tercera pasada ya no tiene nada que completar.
    third = apply_plan(db_session, plan)
    assert third["departamentos completados"] == 0 and third["tipos de contribución completados"] == 0


def test_apply_does_not_overwrite_an_existing_department(tmp_path, db_session):
    plan = build_plan(read_dump(_write_dump(tmp_path)), ("Matemáticas", "Computación"), only_yachay=False)
    apply_plan(db_session, plan)
    ana = db_session.scalar(select(User).where(User.full_name == "Ana Morales"))
    ana.department = "Computación"
    db_session.commit()
    apply_plan(db_session, plan)
    assert ana.department == "Computación"
