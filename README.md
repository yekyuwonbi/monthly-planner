# Weekly Planner

Custom weekly planner built with React, TypeScript, and Vite.

## Run

```powershell
cd C:\Users\OK\Downloads\weekly-planner-run
$env:Path='C:\Program Files\nodejs;' + $env:Path
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

## Build

```powershell
cd C:\Users\OK\Downloads\weekly-planner-run
$env:Path='C:\Program Files\nodejs;' + $env:Path
npm run build
```

## Login And Cloud Sync

This app supports:

- local save on the current device
- email login with Supabase
- cross-device sync after login
- uploaded background sync through Supabase Storage

### Supabase Setup

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Open `Project Settings > API`.
3. Copy:
   - `Project URL`
   - `anon public key`
4. Open `Authentication > Providers` and make sure Email login is enabled.
5. Open `Authentication > URL Configuration`.
6. Add your app URL to redirect URLs.
   - local dev example: `http://127.0.0.1:4173`
   - local network example: `http://192.168.0.146:4174`
   - deployed site URL too, if you have one
7. Open the SQL editor and run `supabase-schema.sql`.

### 1. Create `.env`

Copy `.env.example` to `.env` and fill in your Supabase project values.

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Create the table

Open the Supabase SQL editor and run `supabase-schema.sql`.

### 3. Start the app

After `.env` is filled, the Settings panel will show:

- sign in
- sign up
- cloud sync status
- password reset
- uploaded background sync status

Before login, data stays on the current device only.
After login, planner data and uploaded backgrounds sync to the account and can be used on other devices.

## Deploy

### Vercel

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
