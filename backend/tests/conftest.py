import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import connect_database, close_database


@pytest_asyncio.fixture(scope="function", autouse=True)
async def init_test_db():
    await connect_database()
    yield
    await close_database()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
