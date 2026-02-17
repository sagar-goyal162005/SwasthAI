import os
import json
import base64
import re
import textwrap
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from google.cloud.firestore_v1 import Client as FirestoreClient
from typing import cast


_firestore_client: FirestoreClient | None = None


def _try_load_service_account_from_env() -> dict[str, Any] | None:
    """Load Firebase service-account JSON from environment.

    Supported variables:
    - FIREBASE_SERVICE_ACCOUNT_JSON: raw JSON or base64-encoded JSON
    - FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: base64-encoded JSON
    """

    raw = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or "").strip()
    raw_b64 = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64") or "").strip()

    candidate = raw_b64 or raw
    if not candidate:
        return None

    def _loads_json(text: str) -> dict[str, Any] | None:
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                return obj
        except Exception:
            return None
        return None

    # 1) Raw JSON
    if candidate.startswith("{"):
        parsed = _loads_json(candidate)
        if parsed is not None:
            return parsed

    # 2) Base64 JSON
    try:
        decoded = base64.b64decode(candidate).decode("utf-8")
        parsed = _loads_json(decoded)
        if parsed is not None:
            return parsed
    except Exception:
        return None

    return None


def _is_service_account_json(path: Path) -> bool:
    try:
        if not path.is_file():
            return False
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return False
        if str(data.get("type") or "").strip().lower() != "service_account":
            return False
        if not isinstance(data.get("client_email"), str):
            return False
        if not isinstance(data.get("private_key"), str):
            return False
        return True
    except Exception:
        return False


def _find_service_account_json(backend_dir: Path) -> str | None:
    """Try to locate a Firebase service-account JSON inside backend/.

    This avoids hard-coded absolute paths on different machines.
    """

    candidates: list[Path] = []
    preferred_names = [
        "firebase-service-account.json",
        "serviceAccountKey.json",
        "service-account.json",
    ]

    for name in preferred_names:
        p = backend_dir / name
        if _is_service_account_json(p):
            candidates.append(p)

    # Firebase console downloads are usually named like:
    # <project>-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
    for p in sorted(backend_dir.glob("*firebase-adminsdk*.json")):
        if _is_service_account_json(p):
            candidates.append(p)
    for p in sorted(backend_dir.glob("*adminsdk*.json")):
        if _is_service_account_json(p):
            candidates.append(p)

    if not candidates:
        return None

    # Pick the most recently modified candidate.
    newest = max(candidates, key=lambda p: p.stat().st_mtime)
    return str(newest)


def _resolve_service_account_path(raw_path: str) -> str:
    path = Path(raw_path)
    if path.is_absolute():
        return str(path)

    # Resolve relative paths relative to backend/.
    backend_dir = Path(__file__).resolve().parent
    return str((backend_dir / path).resolve())


def init_firebase_admin() -> None:
    """Initialize Firebase Admin SDK exactly once.

    Uses FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS, or
    FIREBASE_SERVICE_ACCOUNT_JSON(_BASE64).
    """

    if firebase_admin._apps:
        return

    # Best-effort: load backend/.env so this module works when imported directly
    # (e.g., from scripts/tests) instead of only through main.py.
    backend_dir = Path(__file__).resolve().parent
    env_path = backend_dir / ".env"
    if env_path.exists():
        # Use override=True so backend/.env reliably wins in local dev.
        load_dotenv(dotenv_path=str(env_path), override=True)

    # 1) Prefer env-provided JSON (useful for deployments where files are inconvenient)
    service_account_env_json = _try_load_service_account_from_env()
    if service_account_env_json is not None:
        try:
            cred = credentials.Certificate(service_account_env_json)
        except Exception as first_error:
            # Attempt to repair common PEM formatting issues.
            try:
                if isinstance(service_account_env_json.get("private_key"), str):
                    service_account_env_json["private_key"] = _normalize_private_key_pem(
                        service_account_env_json["private_key"]  # type: ignore[index]
                    )
                cred = credentials.Certificate(service_account_env_json)
            except Exception as second_error:
                raise RuntimeError(
                    "Firebase Admin credentials from env are invalid (private_key PEM could not be parsed).\n"
                    "Fix: Re-download a NEW service-account JSON from Firebase Console → Project settings → Service accounts → "
                    "Generate new private key, then set FIREBASE_SERVICE_ACCOUNT_JSON (or *_BASE64) without editing the JSON.\n"
                    f"Underlying error: {second_error}"
                ) from second_error
        firebase_admin.initialize_app(cred)
        return

    # 2) Fall back to file path / auto-discovery
    raw_path = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or ""
    ).strip()

    if not raw_path:
        discovered = _find_service_account_json(backend_dir)
        if discovered:
            raw_path = discovered
        else:
            raise RuntimeError(
                "Firebase Admin is not configured. "
                "Download a Firebase Admin service-account JSON and either:\n"
                "- Place it at backend/firebase-service-account.json, OR\n"
                "- Set FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or GOOGLE_APPLICATION_CREDENTIALS to its path, OR\n"
                "- Set FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON) / FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (base64 JSON)."
            )

    service_account_path = _resolve_service_account_path(raw_path)
    if not os.path.isfile(service_account_path):
        discovered = _find_service_account_json(backend_dir)
        if discovered and os.path.isfile(discovered):
            service_account_path = discovered
        else:
            raise RuntimeError(
                "Firebase service account JSON was not found. "
                f"Resolved path: {service_account_path}\n"
                "Fix: Download the service-account JSON from Firebase Console → Project settings → Service accounts → Generate new private key, "
                "save it as backend/firebase-service-account.json (recommended), and set FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json in backend/.env."
            )

    def _load_service_account_json(path: str) -> dict[str, Any]:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _normalize_private_key_pem(value: str) -> str:
        """Normalize a PKCS8 private key PEM to a canonical format.

        Fixes common copy/paste issues:
        - literal \\n sequences instead of newlines
        - missing BEGIN header
        - extra whitespace
        - missing/incorrect line wrapping (can trigger cryptography MalformedFraming)
        """

        key = (value or "")
        key = key.replace("\r\n", "\n").replace("\r", "\n")
        key = key.strip().strip('"').strip("'")
        key = key.replace("\\n", "\n")

        # Remove empty lines and trim per-line whitespace.
        lines = [ln.strip() for ln in key.split("\n") if ln.strip()]
        compact = "\n".join(lines)

        m = re.search(
            r"-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----",
            compact,
        )
        if m:
            body = m.group(1)
        else:
            # If the markers are missing, assume the entire value is the base64 body.
            body = compact

        # Remove whitespace and any characters outside base64 alphabet.
        # (Base64 for PEM should only include A–Z a–z 0–9 + / and = padding.)
        body = re.sub(r"\s+", "", body)
        body = re.sub(r"[^A-Za-z0-9+/=]", "", body)
        wrapped = "\n".join(textwrap.wrap(body, 64))
        return f"-----BEGIN PRIVATE KEY-----\n{wrapped}\n-----END PRIVATE KEY-----\n"

    try:
        cred = credentials.Certificate(service_account_path)
    except Exception as first_error:
        # If the PEM is malformed (e.g. cryptography MalformedFraming), attempt to repair the JSON key in-memory.
        try:
            data = _load_service_account_json(service_account_path)
            if not isinstance(data.get("private_key"), str):
                raise first_error
            data["private_key"] = _normalize_private_key_pem(data["private_key"])  # type: ignore[index]
            cred = credentials.Certificate(data)
        except Exception as second_error:
            raise RuntimeError(
                "Firebase Admin credentials are invalid (private_key PEM could not be parsed).\n"
                f"Service-account file: {service_account_path}\n"
                "Fix: Re-download a NEW service-account JSON from Firebase Console → Project settings → Service accounts → "
                "Generate new private key, then save it as backend/firebase-service-account.json WITHOUT editing it.\n"
                f"Underlying error: {second_error}"
            ) from second_error

    firebase_admin.initialize_app(cred)


def get_firestore() -> FirestoreClient:
    global _firestore_client
    if _firestore_client is None:
        init_firebase_admin()
        _firestore_client = firestore.client()  # type: ignore[assignment]
    assert _firestore_client is not None
    return cast(FirestoreClient, _firestore_client)


def verify_bearer_token(token: str) -> dict[str, Any]:
    init_firebase_admin()
    # Allow small clock skew in local/dev environments to avoid spurious failures.
    return firebase_auth.verify_id_token(token, clock_skew_seconds=60)
