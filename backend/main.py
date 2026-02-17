import os
import time
import json
import datetime
import io
import wave
import uuid
from typing import Any, List

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI  # type: ignore[import-untyped]
import requests
from google.api_core.exceptions import FailedPrecondition, PermissionDenied

from firebase_app import get_firestore, verify_bearer_token
from google.cloud.firestore_v1 import Query
from schemas import (
    AuthLoginIn,
    AuthResponse,
    AuthResolveLoginIn,
    AuthResolveLoginOut,
    AuthSignupIn,
    CommunityCreateIn,
    CommunityOut,
    CommunityPostCreateIn,
    CommunityPostOut,
    PostCommentCreateIn,
    PostCommentOut,
    PostUserOut,
    UserDataOut,
    UserDataPutIn,
    UserOut,
    UserPatchIn,
    UserBootstrapIn,
)

_ENV_DIR = os.path.dirname(__file__)
_ENV_PATH = os.path.join(_ENV_DIR, ".env")
_ENV_EXAMPLE_PATH = os.path.join(_ENV_DIR, ".env.example")

# Load env vars from backend/.env first. If it doesn't exist, fall back to backend/.env.example
# (useful for local demos; do not commit real secrets to .env.example in production).
if os.path.exists(_ENV_PATH):
    # Use override=True so values in backend/.env reliably win in local dev,
    # even if empty environment variables already exist in the process.
    load_dotenv(dotenv_path=_ENV_PATH, override=True)
else:
    load_dotenv(dotenv_path=_ENV_EXAMPLE_PATH)


def _ensure_backend_env_loaded() -> None:
    """Best-effort: ensure backend/.env has been loaded into process env.

    Uvicorn reload on Windows can occasionally result in a worker process where
    expected variables from backend/.env are not present. Re-loading here keeps
    voice features working without requiring the user to debug environment state.
    """

    if (
        (os.getenv("ASSEMBLYAI_API_KEY") or "").strip()
        or (os.getenv("VOSK_MODEL_PATH") or "").strip()
        or (os.getenv("VOSK_MODEL_PATH_EN") or "").strip()
        or (os.getenv("VOSK_MODEL_PATH_HI") or "").strip()
    ):
        return

    if os.path.exists(_ENV_PATH):
        load_dotenv(dotenv_path=_ENV_PATH, override=True)

app = FastAPI(title="SwasthAI Backend", version="2026-02-11")


@app.exception_handler(PermissionDenied)
def _firestore_permission_denied_handler(_request, exc: PermissionDenied):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Firestore is not available for this Firebase project. "
                "Enable Firestore in Firebase Console (Build → Firestore Database) or "
                "enable the Cloud Firestore API in Google Cloud Console, then retry."
            ),
            "error": str(exc),
        },
    )


@app.exception_handler(FailedPrecondition)
def _firestore_failed_precondition_handler(_request, exc: FailedPrecondition):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Firestore is not fully set up for this Firebase project. "
                "Create the Firestore database in Firebase Console (Build → Firestore Database), then retry."
            ),
            "error": str(exc),
        },
    )


FIRESTORE_COLLECTION_USERS = "users"
FIRESTORE_COLLECTION_USER_DATA = "userData"
FIRESTORE_COLLECTION_COMMUNITIES = "communities"
FIRESTORE_COLLECTION_POSTS = "posts"
FIRESTORE_COLLECTION_CONVERSATIONS = "conversations"


def _parse_origins(value: str | None) -> List[str]:
    if not value:
        return []
    return [o.strip() for o in value.split(",") if o.strip()]


cors_origins = _parse_origins(os.getenv("CORS_ORIGINS"))
if not cors_origins:
    # Safe defaults for local dev
    cors_origins = ["http://localhost:3000", "http://localhost:9002"]

app_env = (os.getenv("APP_ENV") or "development").strip().lower()
is_dev = app_env != "production"

# In local/dev, people often access the Next dev server via 127.0.0.1 or a LAN IP.
# If CORS is too strict, the browser will surface this as: "TypeError: Failed to fetch".
cors_origin_regex: str | None = None
if is_dev:
    cors_origin_regex = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"

# For local development, it's common to open the app via 127.0.0.1 or a LAN IP (mobile testing).
# Browsers enforce CORS on fetch() and will surface this as "Failed to fetch" if the Origin is not allowed.
# In dev we can safely allow all origins because we don't rely on cookies; auth uses bearer tokens.
allow_credentials = True
if is_dev and (os.getenv("CORS_ALLOW_ALL_DEV") or "1") == "1":
    cors_origins = ["*"]
    cors_origin_regex = None
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/debug/voice-config")
def debug_voice_config():
    _ensure_backend_env_loaded()

    en = (os.getenv("VOSK_MODEL_PATH_EN") or "").strip()
    hi = (os.getenv("VOSK_MODEL_PATH_HI") or "").strip()
    default = (os.getenv("VOSK_MODEL_PATH") or "").strip()
    aai = (os.getenv("ASSEMBLYAI_API_KEY") or "").strip()

    def _exists(p: str) -> bool:
        try:
            return bool(p) and os.path.isdir(p)
        except Exception:
            return False

    return {
        "appEnv": app_env,
        "isDev": is_dev,
        "envPath": _ENV_PATH,
        "envPathExists": os.path.exists(_ENV_PATH),
        "vosk": {
            "en": {"set": bool(en), "dirExists": _exists(en), "value": en},
            "hi": {"set": bool(hi), "dirExists": _exists(hi), "value": hi},
            "default": {"set": bool(default), "dirExists": _exists(default), "value": default},
        },
        "assemblyaiConfigured": bool(aai),
    }

_openai_client: OpenAI | None = None


def get_openai_client() -> OpenAI:
    global _openai_client
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    if _openai_client is None:
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _today_iso() -> str:
    return datetime.date.today().isoformat()


def _digits_only(value: str) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _phone_last10(value: str | None) -> str | None:
    if not value:
        return None
    digits = _digits_only(value)
    if len(digits) < 10:
        return digits
    return digits[-10:]


def _default_buddy_persona() -> dict[str, Any]:
    return {
        "name": "Arohi",
        "age": 25,
        "gender": "Non-binary",
        "relationship": "Friend",
    }


def _user_doc_to_out(uid: str, doc: dict[str, Any]) -> UserOut:
    buddy = doc.get("buddyPersona")
    return UserOut(
        uid=uid,
        name=str(doc.get("name") or ""),
        age=int(doc.get("age") or 0),
        gender=doc.get("gender") or "Prefer not to say",  # type: ignore[arg-type]
        avatarUrl=str(doc.get("avatarUrl") or "https://picsum.photos/seed/default-avatar/100/100"),
        streak=int(doc.get("streak") or 0),
        points=int(doc.get("points") or 0),
        dailyPoints=int(doc.get("dailyPoints") or 0),
        lastActivityDate=str(doc.get("lastActivityDate") or _today_iso()),
        totalTasksCompleted=int(doc.get("totalTasksCompleted") or 0),
        bio=doc.get("bio"),
        phone=doc.get("phone"),
        buddyPersona=buddy,
        emailNotifications=bool(doc.get("emailNotifications", True)),
        pushNotifications=bool(doc.get("pushNotifications", False)),
        dosha=doc.get("dosha"),
        doshaIsBalanced=bool(doc.get("doshaIsBalanced", False)),
    )


def get_current_claims(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return verify_bearer_token(token)
    except Exception as e:
        # In dev, log the underlying reason to help debug mismatched Firebase projects / clock skew.
        if is_dev:
            try:
                print(f"[auth] verify_id_token failed: {e}")
            except Exception:
                pass
        if is_dev:
            raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_uid(claims: dict[str, Any] = Depends(get_current_claims)) -> str:
    uid = (claims.get("uid") or claims.get("sub") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing uid")
    return uid


def _ensure_user_doc(uid: str, claims: dict[str, Any] | None = None) -> dict[str, Any]:
    fs = get_firestore()
    ref = fs.collection(FIRESTORE_COLLECTION_USERS).document(uid)
    snap = ref.get()
    if snap.exists:
        return snap.to_dict() or {}

    email = (claims or {}).get("email")
    phone_number = (claims or {}).get("phone_number")

    doc: dict[str, Any] = {
        "name": (claims or {}).get("name") or "",
        "age": 0,
        "gender": "Prefer not to say",
        "avatarUrl": "https://picsum.photos/seed/default-avatar/100/100",
        "streak": 0,
        "points": 0,
        "dailyPoints": 0,
        "lastActivityDate": _today_iso(),
        "totalTasksCompleted": 0,
        "bio": None,
        "phone": _phone_last10(phone_number),
        "phoneE164": phone_number,
        "email": email,
        "buddyPersona": _default_buddy_persona(),
        "emailNotifications": True,
        "pushNotifications": False,
        "dosha": None,
        "doshaIsBalanced": False,
        "createdAt": datetime.datetime.utcnow().isoformat(),
    }
    ref.set(doc)

    # Ensure user-data container exists.
    data_ref = fs.collection(FIRESTORE_COLLECTION_USER_DATA).document(uid)
    if not data_ref.get().exists:
        data_ref.set({"challenges": [], "dailyVibes": [], "updatedAt": datetime.datetime.utcnow().isoformat()})
    return doc


_vosk_models_by_path: dict[str, object] = {}


def _get_vosk_model(model_path: str):
    if not model_path:
        raise RuntimeError(
            "Voice transcription is not configured. Set ASSEMBLYAI_API_KEY (cloud) or VOSK_MODEL_PATH_* (offline)."
        )
    if not os.path.isdir(model_path):
        raise RuntimeError(
            "Vosk model path is set but the folder does not exist. "
            "Download a Vosk model, extract it, and point VOSK_MODEL_PATH_* to that folder."
        )

    cached = _vosk_models_by_path.get(model_path)
    if cached is not None:
        return cached

    try:
        from vosk import Model  # type: ignore
    except Exception as e:
        raise RuntimeError(f"Offline transcription dependency missing: {e}")

    model = Model(model_path)
    _vosk_models_by_path[model_path] = model
    return model


def _score_vosk_result(payload: dict) -> float:
    text = (payload.get("text") or "").strip()
    if not text:
        return 0.0
    words = payload.get("result")
    if isinstance(words, list) and words:
        confs: list[float] = []
        for w in words:
            if not isinstance(w, dict):
                continue
            conf = w.get("conf")
            if isinstance(conf, (int, float)):
                confs.append(float(conf))
        if confs:
            avg_conf = sum(confs) / max(len(confs), 1)
            return float(avg_conf) * float(len(text) + 1)
    return float(len(text))


def _auto_detect_vosk_models() -> tuple[str, str, str]:
    """Auto-detect local Vosk models under backend/.vosk/models.

    Returns (en_path, hi_path, default_path). Any value may be empty.
    """

    models_root = os.path.join(_ENV_DIR, ".vosk", "models")
    if not os.path.isdir(models_root):
        return "", "", ""

    try:
        dirs = [
            os.path.join(models_root, d)
            for d in os.listdir(models_root)
            if os.path.isdir(os.path.join(models_root, d))
        ]
    except Exception:
        return "", "", ""

    def pick(prefixes: list[str]) -> str:
        for p in prefixes:
            for d in dirs:
                name = os.path.basename(d).lower()
                if name.startswith(p.lower()):
                    return d
        return ""

    en = pick(["vosk-model-small-en-us", "vosk-model-en-us", "vosk-model-small-en-in", "vosk-model-en-in"])
    hi = pick(["vosk-model-small-hi", "vosk-model-hi"])
    default = en or hi or (dirs[0] if dirs else "")
    return en, hi, default


def _transcribe_audio_vosk_wav(audio_bytes: bytes, language_code: str) -> str:
    if not audio_bytes:
        return ""
    if not audio_bytes.startswith(b"RIFF"):
        raise RuntimeError(
            "Offline transcription expects WAV audio. Please update the client to send WAV/PCM."
        )

    _ensure_backend_env_loaded()

    model_path_default = (os.getenv("VOSK_MODEL_PATH") or "").strip()
    model_path_en = (os.getenv("VOSK_MODEL_PATH_EN") or "").strip()
    model_path_hi = (os.getenv("VOSK_MODEL_PATH_HI") or "").strip()

    # If env vars are not present (common on Windows + reload quirks),
    # auto-detect models we downloaded under backend/.vosk/models.
    if not (model_path_default or model_path_en or model_path_hi):
        auto_en, auto_hi, auto_default = _auto_detect_vosk_models()
        model_path_en = auto_en
        model_path_hi = auto_hi
        model_path_default = auto_default

    # If both language models are available, run both and pick the better result.
    # This keeps UX simple (no language picker) while supporting English + Hindi.
    candidate_paths: list[str] = []
    if model_path_en and model_path_hi:
        candidate_paths = [model_path_en, model_path_hi]
    else:
        # If only one model is configured, pick based on language code when possible.
        if language_code.lower().startswith("hi") and model_path_hi:
            candidate_paths = [model_path_hi]
        elif language_code.lower().startswith("en") and model_path_en:
            candidate_paths = [model_path_en]
        elif model_path_default:
            candidate_paths = [model_path_default]
        elif model_path_en:
            candidate_paths = [model_path_en]
        elif model_path_hi:
            candidate_paths = [model_path_hi]
        else:
            raise RuntimeError(
                "Offline voice transcription is not configured. Set VOSK_MODEL_PATH_EN and VOSK_MODEL_PATH_HI (recommended), or VOSK_MODEL_PATH."
            )

    try:
        from vosk import KaldiRecognizer  # type: ignore
    except Exception as e:
        raise RuntimeError(f"Offline transcription dependency missing: {e}")

    best_text = ""
    best_score = 0.0

    for model_path in candidate_paths:
        model = _get_vosk_model(model_path)
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            if wf.getnchannels() != 1:
                raise RuntimeError("Offline transcription requires mono WAV audio")
            if wf.getsampwidth() != 2:
                raise RuntimeError("Offline transcription requires 16-bit PCM WAV audio")

            sample_rate = wf.getframerate()
            recognizer = KaldiRecognizer(model, sample_rate)

            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                recognizer.AcceptWaveform(data)

            payload = json.loads(recognizer.FinalResult() or "{}")
            text = (payload.get("text") or "").strip()
            score = _score_vosk_result(payload)
            if score > best_score:
                best_score = score
                best_text = text

    return best_text


def transcribe_audio(audio_file, language_code: str) -> str:
    _ensure_backend_env_loaded()
    api_key = (os.getenv("ASSEMBLYAI_API_KEY") or "").strip()
    if not api_key:
        # Offline fallback (Vosk). Client should send WAV/PCM.
        audio_bytes = audio_file.read()
        return _transcribe_audio_vosk_wav(audio_bytes, language_code=language_code)

    # NOTE: AssemblyAI supports multiple audio formats. Browser MediaRecorder sends webm/opus by default.
    audio_bytes = audio_file.read()
    if not audio_bytes:
        return ""

    headers = {"authorization": api_key}

    # 1) Upload audio
    upload_resp = requests.post(
        "https://api.assemblyai.com/v2/upload",
        headers=headers,
        data=audio_bytes,
        timeout=60,
    )
    upload_resp.raise_for_status()
    upload_url = upload_resp.json().get("upload_url")
    if not upload_url:
        raise RuntimeError("AssemblyAI upload failed")

    # 2) Request transcript (use language detection for multilingual support)
    transcript_req = {
        "audio_url": upload_url,
        "language_detection": True,
    }

    # If you want to force a language, you can disable detection and set the language.
    # Keeping detection enabled is better for multilingual SwasthAI.
    _ = language_code  # reserved for future use

    transcript_resp = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers={**headers, "content-type": "application/json"},
        json=transcript_req,
        timeout=60,
    )
    transcript_resp.raise_for_status()
    transcript_id = transcript_resp.json().get("id")
    if not transcript_id:
        raise RuntimeError("AssemblyAI transcript creation failed")

    # 3) Poll until completed
    poll_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
    deadline = time.time() + 90
    while True:
        if time.time() > deadline:
            raise RuntimeError("AssemblyAI transcription timed out")

        poll_resp = requests.get(poll_url, headers=headers, timeout=30)
        poll_resp.raise_for_status()
        payload = poll_resp.json()
        status = payload.get("status")

        if status == "completed":
            return (payload.get("text") or "").strip()
        if status == "error":
            raise RuntimeError(payload.get("error") or "AssemblyAI transcription error")

        time.sleep(0.8)


EMERGENCY_KEYWORDS = [
    "chest pain",
    "unconscious",
    "breathing difficulty",
    "heavy bleeding",
]


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/resolve-login", response_model=AuthResolveLoginOut)
def auth_resolve_login(payload: AuthResolveLoginIn):
    """Resolve a user-entered loginId (email or 10-digit phone) to an email.

    Firebase Auth email/password only supports signing in by email.
    This endpoint enables a UX where the user can type a phone number and we
    map it to the stored email (from /auth/bootstrap).
    """

    login_id = (payload.loginId or "").strip()
    if not login_id:
        raise HTTPException(status_code=400, detail="loginId is required")

    if "@" in login_id:
        return AuthResolveLoginOut(email=login_id)

    digits = _digits_only(login_id)
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Phone number must be 10 digits")

    fs = get_firestore()

    # First try the normalized last-10 value stored in user docs.
    snaps = (
        fs.collection(FIRESTORE_COLLECTION_USERS)
        .where("phone", "==", digits)
        .limit(1)
        .stream()
    )
    for snap in snaps:
        doc = snap.to_dict() or {}
        email = (doc.get("email") or "").strip()
        if email:
            return AuthResolveLoginOut(email=email)

    raise HTTPException(status_code=404, detail="User not found")


@app.post("/auth/signup", response_model=AuthResponse)
def auth_signup(_payload: AuthSignupIn):
    raise HTTPException(
        status_code=410,
        detail="Deprecated. Use Firebase Auth on the client and then call /auth/bootstrap with a Firebase ID token.",
    )


@app.post("/auth/login", response_model=AuthResponse)
def auth_login(_payload: AuthLoginIn):
    raise HTTPException(
        status_code=410,
        detail="Deprecated. Use Firebase Auth on the client and send the Firebase ID token to backend APIs.",
    )


@app.post("/auth/bootstrap", response_model=UserOut)
def auth_bootstrap(
    payload: UserBootstrapIn,
    claims: dict[str, Any] = Depends(get_current_claims),
    uid: str = Depends(get_current_uid),
):
    fs = get_firestore()

    # Ensure base doc exists, then overlay provided profile fields.
    existing = _ensure_user_doc(uid, claims)

    updates: dict[str, Any] = {
        "name": payload.name.strip(),
        "age": int(payload.age or 0),
        "gender": payload.gender,
        "avatarUrl": payload.avatarUrl or existing.get("avatarUrl") or "https://picsum.photos/seed/default-avatar/100/100",
        "bio": payload.bio,
        "dosha": payload.dosha,
        "doshaIsBalanced": bool(payload.doshaIsBalanced),
        "email": (claims.get("email") or existing.get("email")),
        "phoneE164": (claims.get("phone_number") or existing.get("phoneE164")),
        "lastActivityDate": existing.get("lastActivityDate") or _today_iso(),
    }

    # Only update phone if explicitly provided (avoid clearing it for email-only signups).
    phone_norm = _phone_last10(payload.phone)
    if phone_norm:
        updates["phone"] = phone_norm

    fs.collection(FIRESTORE_COLLECTION_USERS).document(uid).set(updates, merge=True)

    # Ensure user-data container exists.
    data_ref = fs.collection(FIRESTORE_COLLECTION_USER_DATA).document(uid)
    if not data_ref.get().exists:
        data_ref.set({"challenges": [], "dailyVibes": [], "updatedAt": datetime.datetime.utcnow().isoformat()})

    doc = fs.collection(FIRESTORE_COLLECTION_USERS).document(uid).get().to_dict() or {}
    return _user_doc_to_out(uid, doc)


@app.get("/auth/me", response_model=UserOut)
def auth_me(
    claims: dict[str, Any] = Depends(get_current_claims),
    uid: str = Depends(get_current_uid),
):
    doc = _ensure_user_doc(uid, claims)
    return _user_doc_to_out(uid, doc)


@app.post("/auth/logout")
def auth_logout():
    # Stateless JWT: client just deletes token.
    return {"success": True}


@app.patch("/users/me", response_model=UserOut)
def patch_me(
    payload: UserPatchIn,
    claims: dict[str, Any] = Depends(get_current_claims),
    uid: str = Depends(get_current_uid),
):
    fs = get_firestore()
    existing = _ensure_user_doc(uid, claims)

    updates: dict[str, Any] = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.age is not None:
        updates["age"] = payload.age
    if payload.gender is not None:
        updates["gender"] = payload.gender
    if payload.avatarUrl is not None:
        updates["avatarUrl"] = payload.avatarUrl
    if payload.bio is not None:
        updates["bio"] = payload.bio
    if payload.phone is not None:
        updates["phone"] = _phone_last10(payload.phone)
    if payload.buddyPersona is not None:
        updates["buddyPersona"] = payload.buddyPersona.model_dump()
    if payload.emailNotifications is not None:
        updates["emailNotifications"] = payload.emailNotifications
    if payload.pushNotifications is not None:
        updates["pushNotifications"] = payload.pushNotifications
    if payload.dosha is not None:
        updates["dosha"] = payload.dosha
    if payload.doshaIsBalanced is not None:
        updates["doshaIsBalanced"] = payload.doshaIsBalanced

    if updates:
        fs.collection(FIRESTORE_COLLECTION_USERS).document(uid).set(updates, merge=True)
        existing.update(updates)

    return _user_doc_to_out(uid, existing)


@app.get("/user-data/me", response_model=UserDataOut)
def get_user_data(uid: str = Depends(get_current_uid)):
    fs = get_firestore()
    ref = fs.collection(FIRESTORE_COLLECTION_USER_DATA).document(uid)
    snap = ref.get()
    if not snap.exists:
        ref.set({"challenges": [], "dailyVibes": [], "updatedAt": datetime.datetime.utcnow().isoformat()})
        return UserDataOut(challenges=[], dailyVibes=[])
    doc = snap.to_dict() or {}
    return UserDataOut(challenges=doc.get("challenges") or [], dailyVibes=doc.get("dailyVibes") or [])


@app.put("/user-data/me", response_model=UserDataOut)
def put_user_data(payload: UserDataPutIn, uid: str = Depends(get_current_uid)):
    fs = get_firestore()
    ref = fs.collection(FIRESTORE_COLLECTION_USER_DATA).document(uid)
    ref.set(
        {
            "challenges": payload.challenges or [],
            "dailyVibes": payload.dailyVibes or [],
            "updatedAt": datetime.datetime.utcnow().isoformat(),
        },
        merge=True,
    )
    return UserDataOut(challenges=payload.challenges or [], dailyVibes=payload.dailyVibes or [])


def _ensure_default_community() -> None:
    fs = get_firestore()
    ref = fs.collection(FIRESTORE_COLLECTION_COMMUNITIES).document("general")
    if ref.get().exists:
        return
    ref.set(
        {
            "slug": "general",
            "name": "General",
            "description": "SwasthAI community feed",
            "memberCount": 0,
            "createdAt": datetime.datetime.utcnow(),
            "createdBy": None,
        }
    )


@app.get("/communities", response_model=list[CommunityOut])
def list_communities():
    _ensure_default_community()
    fs = get_firestore()
    snaps = (
        fs.collection(FIRESTORE_COLLECTION_COMMUNITIES)
        .order_by("createdAt", direction=Query.DESCENDING)
        .stream()
    )
    out: list[CommunityOut] = []
    for s in snaps:
        d = s.to_dict() or {}
        out.append(
            CommunityOut(
                slug=str(d.get("slug") or s.id),
                name=str(d.get("name") or ""),
                description=d.get("description"),
                memberCount=int(d.get("memberCount") or 0),
            )
        )
    return out


@app.post("/communities", response_model=CommunityOut)
def create_community(payload: CommunityCreateIn, uid: str = Depends(get_current_uid)):
    slug = payload.slug.strip().lower()
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid slug")

    fs = get_firestore()
    ref = fs.collection(FIRESTORE_COLLECTION_COMMUNITIES).document(slug)
    if ref.get().exists:
        raise HTTPException(status_code=400, detail="Community already exists")

    doc = {
        "slug": slug,
        "name": payload.name.strip(),
        "description": payload.description,
        "memberCount": 0,
        "createdAt": datetime.datetime.utcnow(),
        "createdBy": uid,
    }
    ref.set(doc)
    return CommunityOut(slug=slug, name=doc["name"], description=doc.get("description"), memberCount=0)


@app.get("/posts", response_model=list[CommunityPostOut])
def list_posts(community: str | None = None):
    _ensure_default_community()
    fs = get_firestore()
    q = fs.collection(FIRESTORE_COLLECTION_POSTS)
    community_slug = community.strip().lower() if community else None

    # Preferred query: filter by community and order by createdAt.
    # NOTE: Firestore may require a composite index for (communitySlug, createdAt).
    # If that index is missing, fallback to a broader query and filter/sort in Python.
    try:
        q_primary = q
        if community_slug:
            q_primary = q_primary.where("communitySlug", "==", community_slug)
        q_primary = q_primary.order_by("createdAt", direction=Query.DESCENDING).limit(50)
        snaps = list(q_primary.stream())
    except Exception:
        # Fallback: fetch recent posts without community filter, then filter locally.
        # Fetch more than 50 so community-specific results are still likely present.
        q_fallback = q.order_by("createdAt", direction=Query.DESCENDING).limit(200)
        raw = list(q_fallback.stream())
        if community_slug:
            raw = [s for s in raw if (s.to_dict() or {}).get("communitySlug") == community_slug]
        snaps = raw[:50]

    posts: list[CommunityPostOut] = []
    for snap in snaps:
        d = snap.to_dict() or {}
        created_at = d.get("createdAt")
        if isinstance(created_at, datetime.datetime):
            timestamp = created_at.isoformat()
        else:
            timestamp = str(created_at or datetime.datetime.utcnow().isoformat())

        user_doc = d.get("user") or {}
        posts.append(
            CommunityPostOut(
                id=str(d.get("id") or snap.id),
                user=PostUserOut(
                    uid=str(user_doc.get("uid") or ""),
                    name=str(user_doc.get("name") or ""),
                    avatarUrl=str(user_doc.get("avatarUrl") or "https://picsum.photos/seed/default-avatar/100/100"),
                ),
                timestamp=timestamp,
                content=str(d.get("content") or ""),
                imageUrl=d.get("imageUrl"),
                imageHint=d.get("imageHint"),
                reactions=d.get("reactions") or {},
                userReactions={},
                comments=[],
            )
        )
    return posts


@app.post("/posts", response_model=CommunityPostOut)
def create_post(
    payload: CommunityPostCreateIn,
    claims: dict[str, Any] = Depends(get_current_claims),
    uid: str = Depends(get_current_uid),
):
    _ensure_default_community()
    fs = get_firestore()

    user_doc = _ensure_user_doc(uid, claims)
    post_id = uuid.uuid4().hex
    community_slug = (payload.communitySlug or "general").strip().lower() or "general"

    doc = {
        "id": post_id,
        "communitySlug": community_slug,
        "content": payload.content or "",
        "imageUrl": payload.imageUrl,
        "imageHint": payload.imageHint,
        "createdAt": datetime.datetime.utcnow(),
        "user": {
            "uid": uid,
            "name": user_doc.get("name") or "",
            "avatarUrl": user_doc.get("avatarUrl") or "https://picsum.photos/seed/default-avatar/100/100",
        },
        "reactions": {},
    }
    fs.collection(FIRESTORE_COLLECTION_POSTS).document(post_id).set(doc)

    return CommunityPostOut(
        id=post_id,
        user=PostUserOut(uid=uid, name=str(doc["user"]["name"]), avatarUrl=str(doc["user"]["avatarUrl"])),
        timestamp=doc["createdAt"].isoformat(),
        content=doc["content"],
        imageUrl=doc.get("imageUrl"),
        imageHint=doc.get("imageHint"),
        reactions={},
        userReactions={},
        comments=[],
    )


@app.post("/posts/{post_id}/comments", response_model=PostCommentOut)
def add_comment(
    post_id: str,
    payload: PostCommentCreateIn,
    claims: dict[str, Any] = Depends(get_current_claims),
    uid: str = Depends(get_current_uid),
):
    fs = get_firestore()
    post_ref = fs.collection(FIRESTORE_COLLECTION_POSTS).document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(status_code=404, detail="Post not found")

    user_doc = _ensure_user_doc(uid, claims)
    comment_id = uuid.uuid4().hex
    created_at = datetime.datetime.utcnow()
    doc = {
        "id": comment_id,
        "content": payload.content,
        "createdAt": created_at,
        "user": {
            "uid": uid,
            "name": user_doc.get("name") or "",
            "avatarUrl": user_doc.get("avatarUrl") or "https://picsum.photos/seed/default-avatar/100/100",
        },
    }
    post_ref.collection("comments").document(comment_id).set(doc)
    return PostCommentOut(
        id=comment_id,
        user=PostUserOut(uid=uid, name=str(doc["user"]["name"]), avatarUrl=str(doc["user"]["avatarUrl"])),
        content=payload.content,
        timestamp=created_at.isoformat(),
    )


@app.post("/voice")
async def voice_input(
    audio: UploadFile = File(...),
    languageCode: str | None = Form(default=None),
):
    # Step 1: Speech to Text
    language_code = (languageCode or os.getenv("DEFAULT_LANGUAGE_CODE", "hi-IN")).strip() or "hi-IN"
    try:
        user_text = transcribe_audio(audio.file, language_code=language_code)
    except RuntimeError as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "Failed to transcribe audio"})

    # Step 2: Emergency Detection
    lowered = user_text.lower()
    if any(word in lowered for word in EMERGENCY_KEYWORDS):
        reply = "This may be a medical emergency. Please visit the nearest hospital immediately."
    else:
        # OpenAI is optional. If it's not configured, the endpoint still returns
        # the transcription so the frontend can route the text to another model.
        if not os.getenv("OPENAI_API_KEY"):
            reply = ""
        else:
            client = get_openai_client()
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are SwasthAI, a community health assistant.\n"
                            "Respond in the same language as the user.\n"
                            "Use simple non-medical terms.\n"
                            "Suggest doctor consultation if symptoms are serious.\n"
                            "Do not provide a diagnosis; be conservative and safe."
                        ),
                    },
                    {"role": "user", "content": user_text},
                ],
            )
            reply = response.choices[0].message.content or ""

    # Step 3: Save to Firestore (best-effort; ignore failures)
    try:
        fs = get_firestore()
        fs.collection(FIRESTORE_COLLECTION_CONVERSATIONS).add(
            {
                "userInput": user_text,
                "aiReply": reply,
                "languageCode": language_code,
                "createdAt": datetime.datetime.utcnow(),
            }
        )
    except Exception:
        pass

    return {"transcription": user_text, "reply": reply}
