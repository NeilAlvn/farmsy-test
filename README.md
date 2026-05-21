# 🌾 Farmsy — Local Farm Directory

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

A comprehensive farm directory platform connecting consumers with local farms, farm shops, and direct-to-consumer food producers across the Netherlands and Belgium. The platform provides an interactive map experience with real-time search, user accounts, farm reviews, and a farmer claim system — all powered by 13,494+ verified farm listings.

## 📋 Overview

Farmsy helps consumers discover fresh, local food directly from producers near them. Built with Next.js App Router and Supabase, the platform aggregates open-data farm listings from multiple verified sources and presents them through a clean, mobile-responsive interface. Farm owners can claim and manage their own listings for free.

## ✨ Key Features

### 🗺️ Interactive Map
- **13,494+ Farm Listings** — Verified farms across Netherlands and Belgium
- **Map Clustering** — Smooth performance with thousands of map pins
- **Location Search** — Find farms by city, postal code, or current location
- **Category Filtering** — Filter by produce, dairy, meat, honey, wine, and more
- **Farm Detail Panel** — Opening hours, contact info, photos, and directions

### 🔐 Authentication & Profiles
- **Google OAuth** — One-click sign-in with Google
- **Email & Password** — Traditional account creation
- **User Profiles** — Manage your account and preferences
- **Session Management** — Secure Supabase Auth with cookie-based sessions

### 🌟 Community Features
- **Favorites** — Save farms to your personal list
- **Reviews & Ratings** — Star ratings and written reviews for farms
- **Farm Trips** — Plan and save multi-farm visit itineraries
- **Share Farms** — Share farm listings via native share or link copy

### 🏡 Farmer Tools
- **Claim Your Listing** — Free farm claim and verification system
- **Edit Your Details** — Update hours, contact info, and description
- **Verified Badge** — Claimed listings are marked as owner-managed

### 🛡️ Admin Panel
- **Claims Management** — Review and approve farmer claim requests
- **Farm Management** — Search, filter, and manage all listings
- **Role-Based Access** — Admin-only routes protected by Supabase profiles

## 🚀 Technologies Used

### Frontend
- **Next.js 16** — App Router, Server Components, dynamic routes
- **TypeScript** — Full type safety across the codebase
- **Tailwind CSS v4** — Utility-first responsive styling
- **Leaflet / react-leaflet** — Interactive map rendering
- **react-leaflet-cluster** — Marker clustering for performance
- **Lucide React** — Icon library

### Backend & Data
- **Supabase** — PostgreSQL database, Auth, Row-Level Security, Storage
- **Next.js API Routes** — Server-side farm detail endpoints
- **Server Actions** — Admin operations with service-role access

### Data Sources
- **OpenStreetMap** — Core farm locations (ODbL license)
- **TRACES EU** — Certified organic operators (public EU government data)
- **Foursquare** — Enriched business listings
- **Overture Maps** — Meta/Microsoft open map dataset
- **Google Places** — Business detail enrichment (phone, website, photos)

## 📋 Prerequisites

Before installation, ensure you have:

- **Node.js 18+** installed
- **npm** or compatible package manager
- **Supabase account** (free tier works)
- **Modern web browser** (Chrome, Firefox, Edge, Safari)

## 🔧 Installation

### 1. Clone the repository

```bash
git clone https://github.com/l88s-media/Farmsy.git
cd Farmsy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_PLACES_API_KEY=your-google-places-key
```

### 4. Run database migrations

In your Supabase SQL editor, run the migration files in order:

```
src/scripts/migrations/001_farms_rpc.sql
src/scripts/migrations/002_primary_tag.sql
...
src/scripts/migrations/017_add_overture_source.sql
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📁 Project Structure

```
Farmsy/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── _components/        # Shared layout components
│   │   ├── admin/              # Admin panel (claims, farms)
│   │   ├── api/                # API routes
│   │   ├── auth/               # Sign-in, OAuth callback
│   │   ├── dashboard/          # Farm detail pages
│   │   ├── map/                # Interactive map + modals
│   │   ├── trips/              # Farm trip planner
│   │   ├── favorites/          # Saved farms
│   │   ├── about/              # About, FAQ, contact pages
│   │   └── page.tsx            # Homepage
│   ├── lib/                    # Supabase client, utilities
│   └── scripts/                # Data import scripts
│       └── migrations/         # SQL migration files (001–017)
├── .env.example                # Environment variable template
├── package.json
└── README.md
```

## 🎯 Usage

### For Consumers

1. **Explore the map** — Navigate to `/map` and browse farms near you
2. **Search** — Type a city or use the locate-me button
3. **Filter by category** — Select produce, dairy, meat, honey, and more
4. **Save favorites** — Create an account to bookmark farms
5. **Plan a trip** — Use the trip planner to route between multiple farms

### For Farm Owners

1. **Find your farm** — Search for your listing on the map
2. **Create a free account** — Sign up with email or Google
3. **Claim your listing** — Submit a claim request via the farm detail panel
4. **Update your details** — Edit hours, contact info, and description after approval

### For Administrators

1. **Access the admin panel** — Navigate to `/admin` (requires admin role)
2. **Review claims** — Approve or reject farmer claim requests
3. **Manage farms** — Search and filter all listings in the database

## 🔐 Security Features

- **Row-Level Security** — Supabase RLS policies on all tables
- **Server-Side Auth** — Session validation on protected routes
- **Service Role Isolation** — Admin actions use service-role key server-side only
- **Input Validation** — All user inputs sanitized before database writes
- **GDPR Compliant** — Minimal data collection, full user data rights

## 🗃️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (server-side only) |
| `GOOGLE_PLACES_API_KEY` | Optional | Google Places API (enrichment scripts only) |

## 📊 Database Coverage

| Country | Farms | Primary Sources |
|---|---|---|
| 🇳🇱 Netherlands | 8,356 | OpenStreetMap, TRACES EU, Foursquare |
| 🇧🇪 Belgium | 5,138 | OpenStreetMap, Foursquare, Overture Maps |
| **Total** | **13,494** | 4 verified open data sources |

## 🔧 Troubleshooting

### Map not loading

- Check that your Supabase URL and anon key are correct in `.env.local`
- Verify the `farms` table exists and RPC functions are deployed
- Check browser console for network errors

### Authentication not working

- Confirm your Supabase project has Email auth enabled
- For Google OAuth, verify redirect URLs in Supabase Auth settings
- Ensure `NEXT_PUBLIC_SUPABASE_URL` uses `https://`

### Build errors

- Run `npm run build` to catch TypeScript errors before deploying
- Ensure all environment variables are set in your deployment platform

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Commit your changes (`git commit -m 'Add NewFeature'`)
4. Push to the branch (`git push origin feature/NewFeature`)
5. Open a Pull Request

## 📄 License

Proprietary — All rights reserved.

## 🚧 Future Enhancements

- [ ] Mobile app (React Native)
- [ ] Push notifications for farm updates
- [ ] Advanced search filters (organic, open now, distance radius)
- [ ] Farm photo uploads by owners
- [ ] Seasonal availability calendar
- [ ] Multi-language support (NL, FR, EN)
- [ ] API for third-party integrations
- [ ] Farm market event listings
- [ ] Analytics dashboard for farm owners

## 📞 Support

For technical support or inquiries:
- 📧 **Email**: info@farmsy.nl
- 🐙 **GitHub Issues**: [Report a bug](https://github.com/l88s-media/Farmsy/issues)

## 🙏 Acknowledgments

- Farm data sourced from OpenStreetMap contributors (ODbL license)
- EU organic operator data from the public TRACES NT database
- Map rendering powered by Leaflet and OpenStreetMap tile providers
- Built to make local food more discoverable across the Netherlands and Belgium

---

⭐ If you find this project useful, please consider giving it a star!

**Made with 💚 for local food**

© 2026 Farmsy. All rights reserved.
