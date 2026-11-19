"""
File: product_identity_service.py
Author: Jhony Alfonso Peñaherrera
Description: Verificación de existencia de un producto antes de guardarlo -
             T-HU07-02 (PGPCECMC-60). Criterios CA19, CA20, CA21 y CA37.

Un único punto para decidir si un producto ya existe, usado por:
  - el registro manual (ProductService.create_product),
  - la importación desde ORCID (ProductService.import_orcid_products),
  - la consulta previa del formulario (GET /api/v1/products/exists).

Reglas (documento "Reglas y definiciones del Sprint 2", T-HU07-01), pendientes de
validar con el cliente:
  RU-01  Publicación -> DOI; proyecto -> código de proyecto. Coincide en cualquier
         estado (cargado, verificado, rechazado) y origen (manual u ORCID).
  RU-04  La unicidad es global: no depende del profesor ni de la Escuela.
  RU-06  Sin identificador no se puede verificar: se permite registrar (CA21).
  RU-08  Solo se enlaza el producto existente si es visible públicamente.

La restricción única de la BD (T-HU07-03) sigue siendo la garantía final ante dos
envíos simultáneos; este servicio permite avisar antes y con un mensaje claro.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.utils.identifiers import normalize_doi, normalize_project_code

IdentifierField = Literal["doi", "project_code"]

# RV-01 (T-HU05-02, PGPCECMC-48): el público solo ve productos verificados.
PUBLIC_STATUS = "verificado"


@dataclass(frozen=True)
class ExistenceCheck:
    """Resultado de la verificación de existencia."""

    verifiable: bool                      # False si no había identificador (CA21)
    exists: bool                          # True si el identificador ya está registrado (CA20)
    field: IdentifierField | None = None  # Identificador que coincidió
    normalized_identifier: str | None = None
    existing_product_id: str | None = None
    existing_status: str | None = None

    @property
    def public_product_id(self) -> str | None:
        """Id del producto existente solo si es público (RU-08); si no, None."""
        return self.existing_product_id if self.existing_status == PUBLIC_STATUS else None


def find_existing_product(
    db: Session,
    *,
    doi: str | None = None,
    project_code: str | None = None,
) -> ExistenceCheck:
    """Busca un producto con el mismo DOI o código de proyecto (normalizados).

    Acepta los valores tal como los escribe el usuario: los normaliza aquí, así que
    se puede llamar con datos ya normalizados (la normalización es idempotente).
    Si llegan ambos identificadores, se revisa primero el DOI.
    """
    candidates: list[tuple[IdentifierField, str, object]] = []
    clean_doi = normalize_doi(doi)
    if clean_doi:
        candidates.append(("doi", clean_doi, Product.doi))
    clean_code = normalize_project_code(project_code)
    if clean_code:
        candidates.append(("project_code", clean_code, Product.project_code))

    if not candidates:
        return ExistenceCheck(verifiable=False, exists=False)

    for field, value, column in candidates:
        match = db.execute(select(Product.id, Product.status).where(column == value)).first()
        if match:
            return ExistenceCheck(
                verifiable=True,
                exists=True,
                field=field,
                normalized_identifier=value,
                existing_product_id=match.id,
                existing_status=match.status,
            )

    return ExistenceCheck(verifiable=True, exists=False, normalized_identifier=candidates[0][1])
