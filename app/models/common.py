"""
File: models/common.py
Description: Enumerations shared by every scientific product (publications
             and research projects), implementing the charter's verification
             workflow: "cargado exitosamente, verificado, rechazado".
"""

import enum


class ProductSource(str, enum.Enum):
    """Where a record's metadata originally came from."""

    # Pulled automatically from the professor's ORCID record. The charter
    # treats ORCID as a trusted source, so these records skip the manual
    # review committee and are marked VERIFIED immediately.
    ORCID = "orcid"
    # Entered by hand (optionally assisted by PDF metadata extraction or a
    # DOI/project-code lookup) and therefore subject to committee review.
    MANUAL = "manual"


class VerificationStatus(str, enum.Enum):
    """
    Stage of the review workflow, per charter requirement #6
    ("Notificación de procesos"): cargado -> verificado | rechazado.
    """

    UPLOADED = "uploaded"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
