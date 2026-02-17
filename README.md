# SwasthAI

SwasthAI is an AI-powered wellness companion built with:

- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui
- **Backend:** FastAPI (Uvicorn) + Firebase Admin + Firestore

## Local Run

### 1) Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `backend/.env` (copy from `backend/.env.example`) and set Firebase Admin creds (required for login):

- `FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json`

Download the service-account key from Firebase Console → Project settings → Service accounts → **Generate new private key**, and save it as:

- `backend/firebase-service-account.json`

Start backend:

```powershell
\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8010 --app-dir .
```

Open: `http://127.0.0.1:8010/docs`

### 2) Frontend (Next.js)

Create `.env.local` in the project root and set:

- `NEXT_PUBLIC_API_URL=http://127.0.0.1:8010`
- Firebase web config vars:
	- `NEXT_PUBLIC_FIREBASE_API_KEY`
	- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
	- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
	- `NEXT_PUBLIC_FIREBASE_APP_ID`
	- (optional) `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
	- (optional) `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Run:

```bash
npm install
npm run dev -- --port 9002
```

Open: `http://127.0.0.1:9002`

## Deploy

### Frontend on Vercel

1) Import this repo into Vercel.
2) Set **Environment Variables** in Vercel:

- `NEXT_PUBLIC_API_URL` = `https://<your-render-service>.onrender.com`
- All `NEXT_PUBLIC_FIREBASE_*` variables (same as local)

3) Deploy.

### Backend on Render

1) Create a new **Web Service** from this repo.
2) **Root Directory:** `backend`
3) **Build Command:**

```bash
pip install -r requirements.txt
```

4) **Start Command:**

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

5) Set **Environment Variables** in Render:

- Firebase Admin (choose one):
	- `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON), or
	- `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (base64 JSON)
- `CORS_ORIGINS` = `https://<your-vercel-app>.vercel.app`

Notes:

- Do **not** commit `backend/firebase-service-account.json` or `backend/.env`.
- If Firestore isn’t enabled yet, enable it in Firebase Console (Build → Firestore Database).
