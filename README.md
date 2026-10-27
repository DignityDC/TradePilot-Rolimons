# TradePilot Rolimons

Next.js app that auto-posts Rolimons trade ads every 15 minutes for every signed-up user.

## Accounts

- Site login is **username + password** (not Roblox credentials)
- In **Settings**, link your **Roblox username** and **Rolimons `_RoliVerification` token**
- Never paste a Roblox `.ROBLOSECURITY` cookie

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Postgres URLs (`POSTGRES_URL`, `DATABASE_URL`, `PRISMA_DATABASE_URL`) plus the app secrets, then:

```bash
npm run db:push
npm run dev
```

On Vercel, set the same env vars in the project settings. Prisma uses `DATABASE_URL` (client) and `POSTGRES_URL` (migrations / direct).

## Features

- Offer side pulls from your real Rolimons inventory
- Request side uses catalog items + Rolimons-style receiving tags (images in `/public`)
- Prompted to finish Settings before creating/posting ads
- Auto-post cron every 15 minutes for all configured users
