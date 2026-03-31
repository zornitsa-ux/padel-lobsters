# 🦞 Padel Lobsters – Setup Guide

Follow these steps **once** to get your app live. It takes about 20–30 minutes and is completely free.

---

## What you'll need
- A Google account (for Firebase)
- A GitHub account (free at github.com) — for hosting
- A Vercel account (free at vercel.com) — for your web address

---

## Step 1 — Create your Firebase database

Firebase is Google's free database service. It stores all your player, tournament, and payment data.

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Create a project"**
3. Name it `padel-lobsters` → click Continue → disable Google Analytics (not needed) → click **Create project**
4. Once created, click **"Web"** (the `</>` icon) to add a web app
5. Give it a nickname: `padel-lobsters` → click **Register app**
6. You'll see a block of code with your config values — **keep this page open**, you'll need these values in Step 3

### Enable the database
1. In the left sidebar, click **Build → Firestore Database**
2. Click **Create database**
3. Choose **"Start in production mode"** → click Next
4. Pick a location closest to you (e.g. `eur3` for Europe) → click **Enable**

### Set database rules (allow your app to read/write)
1. In Firestore, click the **Rules** tab
2. Replace everything with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **Publish**

> ⚠️ These rules are fine for a private group app. If you want stricter security later, ask for help updating them.

---

## Step 2 — Upload the app to GitHub

GitHub stores your app's code online so Vercel can deploy it.

1. Go to **[github.com](https://github.com)** → sign in → click **New** (green button)
2. Name the repository `padel-lobsters` → set it to **Private** → click **Create repository**
3. On your computer, open the `padel-lobsters` folder you downloaded
4. Follow GitHub's instructions to upload ("push") the folder
   *(You can also use [GitHub Desktop](https://desktop.github.com/) — a simple drag-and-drop app)*

---

## Step 3 — Add your Firebase config to Vercel

1. Go to **[vercel.com](https://vercel.com)** → sign in with your GitHub account
2. Click **"Add New Project"** → import your `padel-lobsters` GitHub repo
3. Before clicking Deploy, click **"Environment Variables"** and add these one by one:

| Name | Value (from Firebase Step 1) |
|------|-------------------------------|
| `VITE_FIREBASE_API_KEY` | your `apiKey` value |
| `VITE_FIREBASE_AUTH_DOMAIN` | your `authDomain` value |
| `VITE_FIREBASE_PROJECT_ID` | your `projectId` value |
| `VITE_FIREBASE_STORAGE_BUCKET` | your `storageBucket` value |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | your `messagingSenderId` value |
| `VITE_FIREBASE_APP_ID` | your `appId` value |

4. Click **Deploy** 🎉

---

## Step 4 — Open your app

Vercel gives you a URL like `padel-lobsters.vercel.app` — that's your app!

- Share this link with your group in WhatsApp
- Players can open it in their phone browser
- To add it to the home screen: tap the Share button in Safari/Chrome → **"Add to Home Screen"**

---

## Step 5 — First-time setup in the app

1. Open the app → tap **Settings** (bottom right)
2. Tap **Login** and enter the default admin PIN: **`1234`**
3. Go to Settings → change the PIN to something only you know
4. Paste your **WhatsApp community invite link** (the green button will appear in the header)
5. Start adding players under the **Players** tab

---

## Your WhatsApp invite link

To get your WhatsApp community/group invite link:
1. Open WhatsApp → open your group
2. Tap the group name → **Invite via link**
3. Copy the link (looks like `https://chat.whatsapp.com/xxxxxxxxx`)
4. Paste it in the app under Settings → WhatsApp Community

---

## Need help?

If you get stuck at any point, just ask — happy to walk through any step with you.
