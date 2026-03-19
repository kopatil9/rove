# roamr — Setup Guide

This guide walks you through everything from zero to a running app.
Each step is small. You don't need to understand all of it right now.

---

## What you need first

- **Node.js** installed — download from https://nodejs.org (choose the LTS version)
- A free **Supabase** account — sign up at https://supabase.com
- A code editor — **VS Code** is great (https://code.visualstudio.com)

---

## Step 1 — Create a Supabase project

1. Go to https://supabase.com and sign in
2. Click **"New project"**
3. Give it a name (e.g. `roamr`), choose a region close to you, set a database password
4. Click **"Create new project"** and wait ~1 minute for it to spin up

---

## Step 2 — Run the database schema

This creates all the tables roamr needs.

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `schema.sql` from this folder
4. Copy its entire contents and paste it into the SQL editor
5. Click the green **"Run"** button
6. You should see `Success. No rows returned` — that means it worked ✓

---

## Step 3 — Turn off email confirmation (recommended for local dev)

By default Supabase requires you to confirm your email before logging in.
That's annoying while building. Here's how to disable it:

1. In Supabase, go to **Authentication → Providers → Email**
2. Toggle **"Confirm email"** OFF
3. Click **Save**

You can turn it back on later before launching.

---

## Step 4 — Get your API credentials

1. In Supabase, click **Settings** (gear icon) → **API**
2. You need two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public key** — a long string starting with `eyJ...`

---

## Step 5 — Create your .env file

1. In the project folder, find the file called `.env.example`
2. Make a copy of it and rename the copy to `.env`
3. Open `.env` in your editor and fill in your values:

```
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJyour-actual-anon-key-here...
```

⚠️ Never share your `.env` file or commit it to GitHub. It's already in `.gitignore`.

---

## Step 6 — Install dependencies and run the app

Open a terminal in this project folder and run:

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

You should see the roamr login screen. Create an account, log in, and the feed
will show the 4 seed trips (Miami, Tokyo, Lisbon, New York).

---

## Step 7 — Verify everything is working

✅ You can sign up with an email and password  
✅ You can log in and log out  
✅ The feed shows trips  
✅ You can click a trip to see its detail view  
✅ You can like, adopt, and share trips  
✅ Adopted trips appear in "my trips" and on the map  
✅ You can save places from the map  

---

## Troubleshooting

**"Missing Supabase credentials" error**
→ Your `.env` file is missing or has incorrect values. Re-check Step 5.

**Feed is empty**
→ The seed data script may not have run. Go back to Step 2 and run `schema.sql` again.

**"Email already registered" on sign up**
→ You already have an account. Try logging in instead.

**Map doesn't show**
→ This is normal — the map only appears when you have adopted trips.
   Adopt a trip from the feed first.

**Port 5173 already in use**
→ Another app is running. Either close it or run `npm run dev -- --port 3000`.

---

## Project structure

```
roamr/
├── src/
│   ├── App.jsx           ← The entire app (auth + all tabs + DB logic)
│   ├── supabaseClient.js ← Supabase connection
│   ├── index.css         ← Global styles + Leaflet CSS
│   └── main.jsx          ← React entry point
├── public/
│   └── favicon.svg
├── schema.sql            ← Paste this into Supabase SQL Editor
├── .env.example          ← Copy → rename to .env → fill in credentials
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── SETUP.md              ← You are here
```

---

## What's already wired to Supabase

| Feature | What it does |
|---|---|
| Sign up / Log in | `supabase.auth.signUp` / `signInWithPassword` |
| Log out | `supabase.auth.signOut` |
| Feed | Loads posts + nested days + activities from DB |
| Likes | Stored in `likes` table, synced with `like_count` on posts |
| Adopt a trip | Stored in `adopted_trips` table |
| My Trips | Loads your adopted trips from DB |
| Save a place (map) | Stored in `saved_places` table |
| Share a trip | Inserts into `posts`, `post_days`, `activities` tables |

---

## Next steps (when you're ready)

- **Add a profile page** — let users edit their name/avatar (stored in `profiles`)
- **Cover photo uploads** — use Supabase Storage to let users upload images
- **Real-time feed** — use Supabase Realtime to see new trips without refreshing
- **Trip sharing links** — make individual trips publicly linkable by URL
- **Enable email confirmation** — turn it back on in Auth settings before launch
