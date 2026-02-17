"""Purge development user data.

This script is intended for local/dev environments only.

It can delete:
- Firebase Authentication users (so email verification starts from scratch)
- Firestore docs in user-related collections
- Local SQL (SQLite/Postgres) tables used by legacy endpoints

By default it runs in DRY RUN mode. Pass --yes-really to perform deletes.

WARNING: If your service account points to a real Firebase project,
this will delete REAL auth users and Firestore data.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable, List, Sequence

# Ensure imports work when executed from backend/scripts.
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def _require_dev_environment() -> None:
    app_env = (os.getenv("APP_ENV") or "development").strip().lower()
    if app_env == "production":
        raise RuntimeError("Refusing to purge data when APP_ENV=production")


def _chunk(seq: Sequence[str], size: int) -> Iterable[List[str]]:
    buf: List[str] = []
    for item in seq:
        buf.append(item)
        if len(buf) >= size:
            yield buf
            buf = []
    if buf:
        yield buf


def purge_firebase_auth(*, dry_run: bool) -> dict:
    try:
        import firebase_admin
        from firebase_admin import auth as firebase_auth

        # Ensure Firebase Admin is initialized using our project logic.
        from firebase_app import init_firebase_admin  # type: ignore

        init_firebase_admin()

        # Collect all user uids.
        uids: List[str] = []
        page = firebase_auth.list_users()
        for u in page.iterate_all():
            if u.uid:
                uids.append(u.uid)

        if dry_run:
            return {"deleted": 0, "total": len(uids), "dryRun": True}

        deleted = 0
        # delete_users supports up to 1000 at a time.
        for batch in _chunk(uids, 1000):
            res = firebase_auth.delete_users(batch)
            deleted += int(res.success_count or 0)

        # If there are multiple apps in-process, don't leave side effects.
        try:
            # Not strictly necessary, but can help in some reload scenarios.
            for app in list(getattr(firebase_admin, "_apps", {}).values()):
                try:
                    firebase_admin.delete_app(app)
                except Exception:
                    pass
        except Exception:
            pass

        return {"deleted": deleted, "total": len(uids), "dryRun": False}
    except Exception as exc:
        return {"error": str(exc)}


def _delete_collection_docs(fs, collection_name: str, *, dry_run: bool, page_size: int = 400) -> dict:
    deleted = 0
    try:
        col = fs.collection(collection_name)
        while True:
            docs = list(col.limit(page_size).stream())
            if not docs:
                break
            if dry_run:
                deleted += len(docs)
                break
            batch = fs.batch()
            for d in docs:
                batch.delete(d.reference)
            batch.commit()
            deleted += len(docs)
        return {"collection": collection_name, "deleted": deleted, "dryRun": dry_run}
    except Exception as exc:
        return {"collection": collection_name, "error": str(exc)}


def purge_firestore(*, collections: list[str], dry_run: bool) -> list[dict]:
    try:
        from firebase_app import get_firestore  # type: ignore

        fs = get_firestore()
        results: list[dict] = []
        for name in collections:
            results.append(_delete_collection_docs(fs, name, dry_run=dry_run))
        return results
    except Exception as exc:
        return [{"error": str(exc)}]


def purge_sqlalchemy_db(*, dry_run: bool) -> dict:
    try:
        from sqlalchemy import text

        from database import DATABASE_URL, engine  # type: ignore

        statements = [
            # order matters for FKs
            "DELETE FROM post_comments",
            "DELETE FROM posts",
            "DELETE FROM conversations",
            "DELETE FROM user_data",
            "DELETE FROM users",
        ]

        if dry_run:
            return {"databaseUrl": DATABASE_URL, "dryRun": True, "wouldRun": statements}

        with engine.begin() as conn:
            for stmt in statements:
                try:
                    conn.execute(text(stmt))
                except Exception:
                    # Some tables may not exist in older DBs; ignore.
                    pass

        return {"databaseUrl": DATABASE_URL, "dryRun": False, "ran": statements}
    except Exception as exc:
        return {"error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge dev user data (Firebase Auth, Firestore, local DB)")
    parser.add_argument("--yes-really", action="store_true", help="Actually delete data (otherwise dry run)")
    parser.add_argument("--auth", action="store_true", help="Purge Firebase Auth users")
    parser.add_argument("--firestore", action="store_true", help="Purge Firestore user collections")
    parser.add_argument("--sqlite", action="store_true", help="Purge local SQLAlchemy database tables")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Purge auth + firestore + sqlite",
    )
    parser.add_argument(
        "--firestore-collections",
        default="users,userData,conversations",
        help="Comma-separated Firestore collections to delete (default: users,userData,conversations)",
    )

    args = parser.parse_args()

    try:
        _require_dev_environment()
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 2

    dry_run = not args.yes_really

    do_auth = args.all or args.auth
    do_fs = args.all or args.firestore
    do_sql = args.all or args.sqlite

    if not (do_auth or do_fs or do_sql):
        print("Nothing selected. Use --all or one of --auth/--firestore/--sqlite")
        return 2

    print("=== PURGE DEV DATA ===")
    print(f"Mode: {'DRY RUN' if dry_run else 'DELETE'}")

    if do_auth:
        print("\n[1/3] Firebase Auth")
        print(purge_firebase_auth(dry_run=dry_run))

    if do_fs:
        collections = [c.strip() for c in (args.firestore_collections or "").split(",") if c.strip()]
        print("\n[2/3] Firestore")
        print(purge_firestore(collections=collections, dry_run=dry_run))

    if do_sql:
        print("\n[3/3] SQLAlchemy DB")
        print(purge_sqlalchemy_db(dry_run=dry_run))

    if dry_run:
        print("\nDry run complete. Re-run with --yes-really to delete.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
