# Capital Hosiery Ledger

Deployment-ready split:

- `backend/` is the Render Node/Express/MongoDB API.
- `frontend/` is the Vercel static frontend.

## Local Backend

```powershell
cd backend
npm install
npm start
```

API runs on `http://localhost:4000`.

## Local Frontend

Open `frontend/index.html` directly, or run:

```powershell
cd frontend
npm run dev
```

## Clear Database

```powershell
cd backend
npm run db:clear
```

## Vercel Frontend Config

After Render gives you a backend URL, update `frontend/config.js`:

```js
window.CHGL_CONFIG = {
  API_BASE: 'https://your-render-backend.onrender.com/api'
};
```

## Render Backend Env Vars

Set these in Render:

```text
MONGODB_URI=your MongoDB Atlas URI
FRONTEND_ORIGIN=https://your-vercel-domain.vercel.app
```
