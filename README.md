# RouteRescue — AI-Powered Fleet Disruption & Re-Planning Dispatcher Agent

RouteRescue is an end-to-end fleet operations command center and autonomous dispatch copilot. It monitors daily delivery routes, predicts stop delays using San Francisco area & hourly traffic heuristics, detects real-time disruptions, executes deterministic route re-optimization (**Nearest-Neighbor + 2-Opt + OSRM**), and drafts customer ETA notifications via **Google Gemini 2.5 Flash** (`@google/genai`) with a human-in-the-loop dispatcher approval queue and transparent decision-trace logging.

---

## 📁 Project Architecture (Separated Frontend & Backend)

```text
.
├── .gitignore
├── .supabase_setup.sql          # Full PostgreSQL Schema, Enums, RLS Policies, Realtime & Seed Data
├── package.json                 # Root helper scripts
├── server/                      # Backend (Node.js + Express + @google/genai + Supabase + Zod)
│   ├── .env                     # Backend environment variables
│   ├── .env.example
│   ├── index.js                 # Express server entrypoint
│   ├── config/
│   │   └── supabase.js          # Supabase & Gemini runtime configuration manager
│   ├── middleware/
│   │   └── auth.js              # JWT Auth verification & Dispatcher/Driver RBAC
│   ├── routes/
│   │   └── api.js               # REST API + SSE Realtime stream endpoints
│   ├── schemas/
│   │   └── validation.js        # Zod runtime payload schemas
│   └── services/
│       ├── dataStore.js         # Supabase PostgreSQL + In-Memory/SSE hybrid data layer
│       ├── delayPredictor.js    # Area & Hourly Historical Delay Prediction Engine
│       ├── gemini.js            # @google/genai (gemini-2.5-flash) event analysis & SMS drafting
│       └── optimizer.js         # Deterministic Nearest-Neighbor + 2-Opt + OSRM routing engine
└── client/                      # Frontend (React + Vite + Tailwind CSS + Leaflet + Lucide)
    ├── .env                     # Frontend environment variables
    ├── .env.example
    ├── index.html
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── context/
        │   └── FleetContext.jsx
        ├── services/
        │   ├── api.js
        │   └── supabaseClient.js
        ├── components/
        │   ├── Navbar.tsx
        │   ├── MapContainer.tsx
        │   ├── EventInjector.tsx
        │   ├── ApprovalQueue.tsx
        │   ├── DecisionTracePanel.tsx
        │   ├── RouteTable.tsx
        │   └── ApiKeyModal.tsx
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── RoutesPage.jsx
            ├── DisruptionsPage.jsx
            ├── ApprovalsPage.jsx
            └── TracePage.jsx
```

---

## 🔑 API Keys & Environment Configuration

### 1. Backend (`server/.env`)
Edit [server/.env](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/server/.env):
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
OSRM_BASE_URL=https://router.project-osrm.org
DEFAULT_FLEET_ID=11111111-1111-1111-1111-111111111111
```

### 2. Frontend (`client/.env`)
Edit [client/.env](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/client/.env):
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_DEFAULT_FLEET_ID=11111111-1111-1111-1111-111111111111
```

> **Note:** You can also enter your `GEMINI_API_KEY` and Supabase credentials directly inside the running web app by clicking the **"API Keys"** button in the top navigation bar. Even before entering external API keys, the app runs out-of-the-box with pre-seeded San Francisco routes, live OSRM street geometry, Nearest-Neighbor + 2-Opt optimization, and real-time SSE synchronization.

---

## 🚀 Quick Start

1. **Database Setup (Supabase SQL Editor):**
   Copy and run the contents of [.supabase_setup.sql](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/.supabase_setup.sql) in your Supabase SQL Editor.

2. **Install & Run Backend (`server`):**
   ```bash
   cd server
   npm install
   npm run dev
   ```

3. **Install & Run Frontend (`client`):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

---

## ☁️ Production Deployment (Render for Backend + Vercel for Frontend)

### 1. Deploy Backend on Render
This repository includes a ready-to-use [`render.yaml`](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/render.yaml) Blueprint:
1. Push your repository to GitHub.
2. In the **Render Dashboard**, click **New + → Blueprint** (or **New + → Web Service**).
3. If creating a Web Service manually, set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add your environment variables in Render:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `OSRM_BASE_URL` = `https://router.project-osrm.org`
   - `DEFAULT_FLEET_ID` = `11111111-1111-1111-1111-111111111111`
5. Copy your deployed Render backend URL (e.g., `https://routerescue-backend.onrender.com`).

### 2. Deploy Frontend on Vercel
This repository includes both [`client/vercel.json`](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/client/vercel.json) and root [`vercel.json`](file:///c:/Users/sunby/OneDrive/Desktop/Build%20to%20ship%20hack/vercel.json) with SPA routing (`rewrites` to `/index.html`):
1. In the **Vercel Dashboard**, click **Add New... → Project** and import your GitHub repository.
2. Set **Root Directory** to `client` (or leave it as root—both are pre-configured).
3. Add your Environment Variables in Vercel:
   - `VITE_API_BASE_URL` = `https://your-render-backend-url.onrender.com`
   - `VITE_SUPABASE_URL` = Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key
   - `VITE_DEFAULT_FLEET_ID` = `11111111-1111-1111-1111-111111111111`
4. Click **Deploy**.

