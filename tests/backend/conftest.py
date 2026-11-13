import pytest

from app.services import user_store


@pytest.fixture(autouse=True)
def _clean_user_store():
    user_store.reset()
    yield
    user_store.reset()
