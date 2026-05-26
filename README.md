# Farmsy 🌾

Find local farms, farm shops, and organic producers in the Netherlands & Belgium.

## About

Farmsy is a directory platform connecting consumers with local farms that offer direct sales, farm shops, pick-your-own experiences, and organic products.

**Database:** 13,454 verified farms across the Netherlands and Belgium.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Styling:** Tailwind CSS v4
- **Maps:** React Leaflet + Leaflet Cluster
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase project

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-org/farmsy.git
cd farmsy
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables — copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your credentials:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key *(server-side only)* |

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Add the three environment variables listed above in **Settings → Environment Variables**.
4. Click **Deploy** — Vercel handles the rest automatically.

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` is a secret. Make sure it is set as a *sensitive* variable in Vercel and is never exposed client-side.

## Project Structure

```
farmsy/
├── src/
│   ├── app/          # Next.js App Router pages & layouts
│   ├── components/   # React components
│   ├── lib/          # Supabase client, utilities
│   └── scripts/      # Database import & maintenance scripts
├── public/           # Static assets
├── .env.example      # Environment variable template
└── package.json
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Database

The `farms` table in Supabase holds all farm records. Coordinates are stored as PostGIS geography. A `get_farms_with_coords` RPC function returns `{ id, osm_id, lat, lng }` for all farms.

Row Level Security (RLS) is enabled. Public read access is granted via the anon key; write operations require the service role key.

## License

Private — All rights reserved.
