# ProductBrowse — CodeVector Internship Task

A backend + UI for browsing **200,000 products** with fast, stable pagination.

## Tech Stack
- **Backend**: Node.js + Express + Mongoose
- **Database**: MongoDB (Atlas / any provider)
- **Frontend**: React + Vite

---

## Key Design Decision: Cursor-Based Pagination

> This is the core of the task. Read this before anything else.

### Why NOT offset pagination?

Offset/skip (`SKIP 200, LIMIT 20`) is broken in two ways:

1. **Correctness**: If someone inserts 50 products while you're on page 3, every subsequent page shifts — you'll see duplicates or skip items entirely.
2. **Performance**: MongoDB's `SKIP` scans and discards N documents before returning results. On 200k rows, page 500 = scan 10,000 docs first. O(n) gets slow fast.

### How cursor pagination works here

Each page response includes a `nextCursor` — a base64-encoded JSON blob containing the **last item's `createdAt` + `_id`**.

To fetch the next page, we ask:
```
Give me items where:
  createdAt < last.createdAt
  OR (createdAt == last.createdAt AND _id < last._id)
```

**Why `_id` as tiebreaker?** Multiple products can share the same `createdAt` timestamp. `_id` is always unique, so we never miss or duplicate a document even in that edge case.

**Why is this O(log n) instead of O(n)?** MongoDB uses the compound index `{ createdAt: -1, _id: -1 }` to jump directly to the cursor position — no scanning.

**Why is it stable under insertions?** New products always have a `createdAt` newer than any existing cursor, so they appear on page 1 only — they never push existing items to a different page.

---

## Setup & Run Locally

### 1. Clone & install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure environment

```bash
# backend/.env  (copy from .env.example)
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/codevector
PORT=5000

# frontend/.env  (only needed for production, dev uses Vite proxy)
VITE_API_URL=https://your-backend.onrender.com
```

### 3. Seed the database

```bash
cd backend
npm run seed
```

This inserts **200,000 products** using `insertMany` in batches of 5,000 — not a slow loop.

### 4. Run dev servers

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open http://localhost:5173

---

## API Reference

### `GET /api/products`

| Query Param | Type   | Description                          |
|-------------|--------|--------------------------------------|
| `category`  | string | Filter by category (omit for all)    |
| `cursor`    | string | Base64 cursor from previous response |

**Response**
```json
{
  "products": [...],
  "nextCursor": "base64string or null",
  "hasNextPage": true
}
```

### `GET /api/categories`
Returns array of distinct category strings.

### `GET /api/stats`
Returns `{ total: 200000 }`.

---

## Database Indexes

```js
// Fast all-products pagination
{ createdAt: -1, _id: -1 }

// Fast category-filtered pagination  
{ category: 1, createdAt: -1, _id: -1 }
```

Both indexes are created automatically by Mongoose on first run.

---

## Deployment

### Backend → Render
1. Create a new **Web Service** on [render.com](https://render.com)
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env var: `MONGODB_URI`

### Frontend → Vercel / Netlify / Render Static
1. Root directory: `frontend`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add env var: `VITE_API_URL=https://your-backend.onrender.com`

---

## Project Structure

```
assignment-1/
├── backend/
│   ├── models/
│   │   └── Product.js     # Schema + indexes
│   ├── server.js          # Express API + cursor pagination logic
│   ├── seed.js            # Bulk insert 200k products
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # React UI with cursor stack for prev/next
│   │   └── index.css      # Dark theme styles
│   └── package.json
└── README.md
```
