import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings
from app.core.logging import logger

_db_client: Optional[AsyncIOMotorClient] = None
_database_instance: Optional[Any] = None


class FileCollection:
    """Async-compatible in-memory & file-backed MongoDB collection fallback."""

    def __init__(self, name: str, db_parent: "FileDatabase"):
        self.name = name
        self.db_parent = db_parent

    @property
    def items(self) -> List[Dict[str, Any]]:
        return self.db_parent.data.get(self.name, [])

    async def find_one(self, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for item in self.items:
            match = True
            for k, v in filter_dict.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                return dict(item)
        return None

    async def find(self, filter_dict: Optional[Dict[str, Any]] = None, sort: Optional[List] = None, limit: Optional[int] = None) -> "FileCursor":
        res = []
        filter_dict = filter_dict or {}
        for item in self.items:
            match = True
            for k, v in filter_dict.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                res.append(dict(item))

        if sort:
            for field, order in reversed(sort):
                res.sort(key=lambda x: x.get(field, 0), reverse=(order == -1))

        if limit:
            res = res[:limit]

        return FileCursor(res)

    async def insert_one(self, doc: Dict[str, Any]) -> Any:
        if self.name not in self.db_parent.data:
            self.db_parent.data[self.name] = []
        doc_copy = dict(doc)
        self.db_parent.data[self.name].append(doc_copy)
        await self.db_parent.save()
        return type("InsertResult", (), {"inserted_id": doc_copy.get("_id") or doc_copy.get("id")})()

    async def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any], upsert: bool = False) -> Any:
        set_values = update_dict.get("$set", update_dict)
        for i, item in enumerate(self.items):
            match = True
            for k, v in filter_dict.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                self.items[i].update(set_values)
                await self.db_parent.save()
                return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})()

        if upsert:
            new_doc = dict(filter_dict)
            new_doc.update(set_values)
            await self.insert_one(new_doc)
            return type("UpdateResult", (), {"matched_count": 0, "upserted_id": new_doc.get("id")})()

        return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})()

    async def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        filter_dict = filter_dict or {}
        count = 0
        for item in self.items:
            match = True
            for k, v in filter_dict.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count


class FileCursor:
    def __init__(self, data: List[Dict[str, Any]]):
        self._data = data

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        if length is not None:
            return self._data[:length]
        return self._data

    def __aiter__(self):
        self._iter = iter(self._data)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class FileDatabase:
    """Local JSON fallback database implementation."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.data: Dict[str, List[Dict[str, Any]]] = {
            "events": [],
            "game_sessions": [],
            "photos": [],
            "photo_recipients": [],
            "leaderboard_entries": [],
            "audit_logs": [],
        }
        self.load()

    def load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    # Migrate Node.js legacy keys if present
                    if "sessions" in loaded and "game_sessions" not in loaded:
                        loaded["game_sessions"] = loaded.pop("sessions")
                    if "recipients" in loaded and "photo_recipients" not in loaded:
                        loaded["photo_recipients"] = loaded.pop("recipients")
                    self.data.update(loaded)
            except Exception as e:
                logger.error(f"Error loading local database file: {e}")

    async def save(self):
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            temp_file = self.file_path.with_suffix(".tmp")
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, default=str)
            temp_file.replace(self.file_path)
        except Exception as e:
            logger.error(f"Error saving local database: {e}")



    def __getitem__(self, name: str) -> FileCollection:
        return FileCollection(name, self)


class AwaitableMotorCursor:
    """Wraps Motor cursor to allow both 'await cursor.to_list()' and legacy 'await coll.find()'."""
    def __init__(self, cursor):
        self._cursor = cursor

    def __await__(self):
        async def _resolve():
            return self
        return _resolve().__await__()

    async def to_list(self, length: Optional[int] = 2000) -> List[Dict[str, Any]]:
        docs = await self._cursor.to_list(length=length)
        for doc in docs:
            if isinstance(doc, dict) and "_id" in doc:
                doc["_id"] = str(doc["_id"])
        return docs

    def __aiter__(self):
        return self

    async def __anext__(self):
        doc = await self._cursor.__anext__()
        if isinstance(doc, dict) and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    def sort(self, *args, **kwargs):
        self._cursor = self._cursor.sort(*args, **kwargs)
        return self

    def limit(self, *args, **kwargs):
        self._cursor = self._cursor.limit(*args, **kwargs)
        return self

    def skip(self, *args, **kwargs):
        self._cursor = self._cursor.skip(*args, **kwargs)
        return self

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class MotorCollectionWrapper:
    """Wrapper around AsyncIOMotorCollection for backwards-compatibility."""
    def __init__(self, collection):
        self._collection = collection

    def find(self, filter: Optional[Dict[str, Any]] = None, *args, **kwargs) -> AwaitableMotorCursor:
        sort = kwargs.pop("sort", None)
        limit = kwargs.pop("limit", None)
        cursor = self._collection.find(filter or {}, *args, **kwargs)
        if sort:
            cursor = cursor.sort(sort)
        if limit:
            cursor = cursor.limit(limit)
        return AwaitableMotorCursor(cursor)

    async def find_one(self, filter: Dict[str, Any], *args, **kwargs):
        doc = await self._collection.find_one(filter, *args, **kwargs)
        if isinstance(doc, dict) and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def insert_one(self, document: Dict[str, Any], *args, **kwargs):
        return await self._collection.insert_one(document, *args, **kwargs)

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], *args, **kwargs):
        return await self._collection.update_one(filter, update, *args, **kwargs)

    async def count_documents(self, filter: Optional[Dict[str, Any]] = None, *args, **kwargs) -> int:
        return await self._collection.count_documents(filter or {}, *args, **kwargs)

    async def delete_one(self, filter: Dict[str, Any], *args, **kwargs):
        return await self._collection.delete_one(filter, *args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._collection, name)


class MotorDatabaseWrapper:
    """Wrapper around AsyncIOMotorDatabase to return collection wrappers."""
    def __init__(self, database: AsyncIOMotorDatabase):
        self._database = database

    def __getitem__(self, name: str) -> MotorCollectionWrapper:
        return MotorCollectionWrapper(self._database[name])

    def __getattr__(self, name):
        return getattr(self._database, name)


async def connect_database():
    """Initialize database connection during application startup."""
    global _db_client, _database_instance

    if settings.MONGODB_URI:
        try:
            logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URI.split("@")[-1])
            _db_client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000
            )
            # Ping database to verify connection
            await _db_client.admin.command("ping")
            _database_instance = MotorDatabaseWrapper(_db_client[settings.MONGODB_DATABASE])
            logger.info("Successfully connected to MongoDB database: %s", settings.MONGODB_DATABASE)
            return
        except Exception as e:
            logger.warning(
                "Could not connect to MongoDB (%s). Falling back to local offline JSON database.", e
            )

    # Fallback to local JSON database
    db_file = settings.DATA_PATH / "db.json"
    logger.info("Using local offline JSON database: %s", db_file)
    _database_instance = FileDatabase(db_file)


async def close_database():
    """Close database connection during shutdown."""
    global _db_client, _database_instance
    if _db_client:
        _db_client.close()
        _db_client = None
    _database_instance = None
    logger.info("Database connection closed.")


def get_db() -> Any:
    """Return database instance."""
    if _database_instance is None:
        # Emergency initialization if called outside lifespan
        db_file = settings.DATA_PATH / "db.json"
        return FileDatabase(db_file)
    return _database_instance
