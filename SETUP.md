# Padel Lobsters – Setup Guide

Follow these steps once to get the app live. It takes about 30–45 minutes.

---

## What you'll need

- A [GitHub](https://github.com) account — stores the code
- A [Supabase](https://supabase.com) account (free) — the database and auth backend
- A [Vercel](https://vercel.com) account (free) — hosts the web app

---

## Step 1 — Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** → sign in → click **New project**
2. Name it `padel-lobsters`, choose a strong database password, pick the region closest to you
3. Wait ~2 minutes for the project to provision

---

## Step 2 — Push the database schema

The project ships with a complete migration file that creates all tables, functions, and policies.

```bash
# One-time: link your local checkout to the production project
npx supabase link --project-ref <your-project-ref>
#   Your project ref is in Supabase → Project Settings → General

# Push all migrations to production
npx supabase db push
```

This creates every table, RLS policy, and stored procedure the app needs.

---

## Step 3 — Get your Supabase credentials

1. In the Supabase dashboard, open **Project Settings → API**
2. Note these two values:
   - **Project URL** (e.g. `https://xyzxyz.supabase.co`)
   - **anon / public key** (the long JWT starting with `eyJ…`)

---

## Step 4 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → sign in → **Add New Project** → import your GitHub repo
2. Before clicking Deploy, open **Environment Variables** and add:

| Name                     | Value                        |
| ------------------------ | ---------------------------- |
| `VITE_SUPABASE_URL`      | Your Project URL from Step 3 |
| `VITE_SUPABASE_ANON_KEY` | Your anon key from Step 3    |

3. Click **Deploy**

Vercel gives you a URL like `padel-lobsters.vercel.app` — that's your app.

---

## Step 5 — First-time setup in the app

1. Open the app → tap **Settings** (bottom right)
2. Tap **Login** and enter the default admin PIN: **`0000`**
3. Go to Settings → change the PIN to something only you know
4. Paste your **WhatsApp community invite link** (a green button will appear in the header)
5. Start adding players under the **Players** tab

---

## Step 6 — Add the app to your phone's home screen

- **iPhone (Safari):** tap the Share button → **Add to Home Screen**
- **Android (Chrome):** tap the three-dot menu → **Add to Home screen**

---

## WhatsApp invite link

1. Open WhatsApp → open your group
2. Tap the group name → **Invite via link**
3. Copy the link (looks like `https://chat.whatsapp.com/xxxxxxxxx`)
4. Paste it in the app under Settings → WhatsApp Community

---

## Updating the database schema

All schema changes go through migration files in `supabase/migrations/`. See `CONTRIBUTING.md` for the full workflow.

After a migration PR is merged to `main`:

```bash
git checkout main && git pull
npx supabase db push
```

---

## Need help?

If you get stuck, check `CONTRIBUTING.md` for the local dev setup, or open an issue on GitHub.
