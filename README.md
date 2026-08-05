# ⚓ SHERQ Talk Roster

**Sandock Austral Shipyards - SHERQ Department**

A modern web application for managing daily toolbox talk presentations (07:00-07:30, Mon-Fri).

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## Features

- 📅 **Calendar View** - Visual monthly roster with drag-to-assign
- 👥 **Team Management** - Drag-and-drop presenter ordering
- 📚 **Topics Library** - Pre-loaded SHERQ topics + custom additions
- 📊 **Dashboard** - Stats, upcoming birthdays, announcements
- 🚫 **No-Talk Days** - Mark holidays/special events, auto-shift roster
- 📹 **Teams Integration** - Add talks to calendar, join meetings
- 🌙 **Dark/Light Mode** - Toggle for your preference

## Quick Deploy

### 1. Create Database (Neon - Free)

1. Go to [neon.tech](https://neon.tech) → Sign up
2. Create project → Copy connection string

### 2. Deploy to Vercel (Free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/sherq-roster&env=DATABASE_URL&envDescription=PostgreSQL%20connection%20string%20from%20Neon)

Or manually:
1. Push to GitHub
2. Import to [vercel.com](https://vercel.com)
3. Add `DATABASE_URL` environment variable
4. Deploy

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Push database schema
npx drizzle-kit push

# Run development server
npm run dev
```

## Team

| Role | Name | Email |
|------|------|-------|
| HOD | Don Khumalo | Donk@sas.co.za |
| Coordinator | Peter S. Mavundla | PeterSM@sas.co.za |

## License

Internal use - Sandock Austral Shipyards © 2026
