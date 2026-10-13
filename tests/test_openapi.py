"""
File: tests/test_openapi.py
Description: Sanity checks on the generated OpenAPI documentation: every
             endpoint required by the charter's five requirement groups is
             present, documented, and the password hash is never exposed.
"""

REQUIRED_ENDPOINTS = {
    ("get", "/public/info"),
    ("get", "/public/publications"),
    ("get", "/public/projects"),
    ("get", "/public/dashboard"),
    ("get", "/public/publications/export"),
    ("post", "/auth/register"),
    ("post", "/auth/login"),
    ("post", "/auth/refresh"),
    ("post", "/auth/logout"),
    ("get", "/orcid/login"),
    ("get", "/orcid/callback"),
    ("get", "/orcid/works"),
    ("post", "/orcid/import"),
    ("get", "/users/me"),
    ("post", "/publications"),
    ("get", "/publications"),
    ("get", "/publications/{publication_id}"),
    ("patch", "/publications/{publication_id}"),
    ("delete", "/publications/{publication_id}"),
    ("get", "/publications/lookup-doi"),
    ("post", "/publications/extract-pdf"),
    ("get", "/publications/export"),
    ("post", "/projects"),
    ("get", "/projects"),
    ("get", "/projects/{project_id}"),
    ("patch", "/projects/{project_id}"),
    ("delete", "/projects/{project_id}"),
    ("get", "/projects/lookup-code"),
    ("get", "/projects/export"),
    ("get", "/review/publications"),
    ("patch", "/review/publications/{publication_id}"),
    ("get", "/review/projects"),
    ("patch", "/review/projects/{project_id}"),
    ("get", "/notifications"),
    ("patch", "/notifications/{notification_id}/read"),
}


def test_docs_and_schema_are_served(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_every_required_endpoint_is_present(client):
    spec = client.get("/openapi.json").json()
    available = {(method, path) for path, ops in spec["paths"].items() for method in ops}

    missing = REQUIRED_ENDPOINTS - available
    assert not missing, f"Missing endpoints: {missing}"


def test_every_operation_has_a_summary_and_a_tag(client):
    spec = client.get("/openapi.json").json()

    for path, operations in spec["paths"].items():
        for method, operation in operations.items():
            assert operation.get("summary"), f"{method.upper()} {path} has no summary"
            assert operation.get("tags"), f"{method.upper()} {path} has no tag"


def test_the_bearer_security_scheme_is_declared(client):
    spec = client.get("/openapi.json").json()
    schemes = spec["components"]["securitySchemes"]

    assert any(scheme.get("type") == "oauth2" for scheme in schemes.values())


def test_protected_endpoints_declare_security(client):
    spec = client.get("/openapi.json").json()

    for path, method in [("/users/me", "get"), ("/publications", "post"), ("/review/publications", "get")]:
        assert spec["paths"][path][method].get("security")


def test_password_hash_never_appears_in_any_schema(client):
    spec = client.get("/openapi.json").json()

    for name, schema in spec["components"]["schemas"].items():
        assert "hashed_password" not in schema.get("properties", {}), name
        assert "orcid_access_token" not in schema.get("properties", {}), name
