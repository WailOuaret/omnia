# Live demo deployment (teacher link)

The shared website uses **live backend mode** (same as local): CoDEx-M sessions, graph slices, clustering, candidates, feedback.

## Architecture

```
Teacher browser  →  Vercel (frontend)  →  /api/* proxy  →  Render (FastAPI backend)
                         /paper-demo                         + CoDEx-M data
```

- **Frontend:** Vercel — root `vercel.json`, builds `frontend/dist`
- **Backend:** Render — `render.yaml`, service name `omnia-demo-api`
- **API proxy:** Vercel rewrites `/api/*` → `https://omnia-demo-api.onrender.com/api/*`

No static COVID fallback on the teacher link — CoDEx-M loads a real backend session.

## One-time setup

### 1. Deploy backend on Render

1. Open [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**
2. Connect GitHub repo: `WailOuaret/omnia_demo`
3. Render reads `render.yaml` and creates **`omnia-demo-api`**
4. Wait for first deploy (~5–10 min: pip install + sparse CoDEx-M clone)
5. Confirm health: `https://omnia-demo-api.onrender.com/api/health` → `{"status":"ok"}`

**Note:** Free tier sleeps after inactivity; first request may take ~30–60s to wake.

### 2. Redeploy frontend on Vercel

Vercel should auto-deploy on push to `main`. After deploy, open:

`https://<your-vercel-project>.vercel.app/paper-demo`

The page will:

1. Default to **CoDEx-M**
2. Create a backend session via `/api`
3. Show the live graph slice (~100 nodes with context)

### 3. Verify

```bash
curl https://omnia-demo-api.onrender.com/api/samples
curl https://<your-vercel-project>.vercel.app/api/health
```

Both should return JSON (Vercel `/api/health` is proxied to Render).

## Local development (unchanged)

```bash
# Terminal 1 — repo root
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2
cd frontend && npm run dev
```

Open http://127.0.0.1:5173/paper-demo

## Limitations on cloud

| Feature | Cloud (Render) | Local |
|---------|----------------|-------|
| CoDEx-M live sessions | Yes | Yes |
| FB15K-237 / WN18RR | Not bundled (clone optional) | Yes with full setup |
| TransE filtering artifacts | May be empty (lightweight cloud deps) | Full pipeline |
| LLM validation | May be empty without Ollama | With local LLM |
| Sessions | In-memory (lost on Render restart) | In-memory |

COVID-Fact and Socio-Economic remain static-only by design.
