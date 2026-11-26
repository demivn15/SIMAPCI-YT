# Demo: catálogo con la producción real de la ECMC

Carga local, **solo para demostración**, de las publicaciones del volcado
`base_datos_emcc_yachay_actualizada.sql` (pipeline ORCID → OpenAlex → Crossref → SCImago) en la
tabla `products`. La página pública `/produccion` ya lee el catálogo consolidado de la API
(T-HU05-05), así que muestra estas obras sin cambios en el frontend.

No es la importación oficial de HU12. Las decisiones y sus límites están documentados al inicio
de `seed_ecmc_orcid.py`.

```bash
docker compose up -d mysql
alembic upgrade head
python -m scripts.demo.seed_ecmc_orcid --sql RUTA/base_datos_emcc_yachay_actualizada.sql --dry-run
python -m scripts.demo.seed_ecmc_orcid --sql RUTA/base_datos_emcc_yachay_actualizada.sql
uvicorn app.main:app --reload        # backend en :8000
cd frontend && npm run dev           # http://localhost:5173/produccion
```

Opciones: `--departamentos "Matemáticas,Computación,Desarrollo Humano"`, `--solo-yachay`
(solo obras con afiliación Yachay confirmada) y `--reset` (borra todo lo que creó el script).
