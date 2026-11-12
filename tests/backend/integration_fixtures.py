"""Respuestas de ejemplo con la MISMA estructura que las APIs reales (recortadas)."""

DOI = "10.1145/3576915.3623102"

CROSSREF_WORK = {
    "status": "ok",
    "message-type": "work",
    "message": {
        "DOI": "10.1145/3576915.3623102",
        "title": ["Secure Aggregation for Federated Learning &amp; Edge Devices"],
        "author": [
            {"given": "María", "family": "García", "sequence": "first"},
            {"given": "Juan", "family": "Pérez", "sequence": "additional"},
            {"name": "ECMC Research Group", "sequence": "additional"},
        ],
        "container-title": ["Proceedings of the 2023 ACM SIGSAC Conference on Computer and Communications Security"],
        "issued": {"date-parts": [[2023, 11, 15]]},
        "abstract": "<jats:title>Abstract</jats:title><jats:p>We propose   a protocol\n for secure aggregation.</jats:p>",
    },
}

CROSSREF_WORK_MINIMAL = {"status": "ok", "message": {"title": [], "published-online": {"date-parts": [[2021]]}}}

OPENALEX_WORK = {
    "id": "https://openalex.org/W4388000000",
    "doi": "https://doi.org/10.1145/3576915.3623102",
    "title": "Secure Aggregation for Federated Learning",
    "display_name": "Secure Aggregation for Federated Learning",
    "publication_year": 2023,
    "authorships": [
        {"author": {"id": "https://openalex.org/A1", "display_name": "María García"}},
        {"author": {"id": "https://openalex.org/A2", "display_name": "Juan Pérez"}},
    ],
    "primary_location": {"source": {"display_name": "ACM CCS 2023"}},
    "abstract_inverted_index": {"We": [0], "propose": [1], "a": [2], "protocol.": [3]},
}

ORCID = "0000-0002-1825-0097"

ORCID_WORKS = {
    "last-modified-date": {"value": 1700000000000},
    "group": [
        {
            "work-summary": [
                {
                    "put-code": 111,
                    "title": {"title": {"value": "Older paper"}},
                    "publication-date": {"year": {"value": "2019"}},
                    "journal-title": {"value": "Journal of Applied Math"},
                    "type": "journal-article",
                    "external-ids": {"external-id": [{"external-id-type": "issn", "external-id-value": "1234-5678"}]},
                }
            ]
        },
        {
            # Misma obra informada por dos fuentes: solo debe aparecer una vez
            "work-summary": [
                {
                    "put-code": 222,
                    "title": {"title": {"value": "Secure Aggregation for Federated Learning"}},
                    "publication-date": {"year": {"value": "2023"}, "month": {"value": "11"}},
                    "journal-title": None,
                    "type": "conference-paper",
                    "external-ids": {
                        "external-id": [
                            {"external-id-type": "doi", "external-id-value": "https://doi.org/10.1145/3576915.3623102"}
                        ]
                    },
                },
                {"put-code": 223, "title": {"title": {"value": "Secure Aggregation (duplicate source)"}}},
            ]
        },
        {"work-summary": [{"put-code": 333, "title": {"title": {"value": "Undated report"}}, "publication-date": None}]},
        {"work-summary": [{"put-code": 444, "title": None}]},  # sin título: se descarta
    ],
}
