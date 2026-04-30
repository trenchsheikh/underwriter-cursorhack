# underwriter-cursorhack

Monorepo containing the underwriter application.

## Structure

```
.
├── backend/    # Python FastAPI backend service
├── frontend/   # React + Vite + TypeScript frontend
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- npm 10+

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000. Interactive docs at http://localhost:8000/docs.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server will be available at http://localhost:5173.

## Development

Each workspace is independent and managed with its own tooling:

- **backend/** uses `pip` and `requirements.txt`.
- **frontend/** uses `npm` and `package.json`.

See each subdirectory's README for further details.
