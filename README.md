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

### Auto-post every 15 minutes (Hobby)

Vercel Hobby only allows **one cron per day** (configured as midnight UTC in `vercel.json`). For Rolimons’ 15-minute ad cooldown, point an external cron (e.g. [cron-job.org](https://cron-job.org)) at:

```text
GET https://YOUR_DOMAIN/api/cron/post-ads?secret=YOUR_CRON_SECRET
```

Schedule: every 15 minutes. Header alternative: `Authorization: Bearer YOUR_CRON_SECRET`.

## Features

- Offer side pulls from your real Rolimons inventory
- Request side uses catalog items + Rolimons-style receiving tags (images in `/public`)
- Prompted to finish Settings before creating/posting ads
- Auto-post via cron endpoint for all configured users
