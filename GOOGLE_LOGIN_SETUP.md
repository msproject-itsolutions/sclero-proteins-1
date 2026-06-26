# Enabling "Sign in with Google"

The Google sign-in button is **already wired** — it stays hidden until you set a
Google OAuth **Web Client ID**, then appears automatically on the login/signup
screen and posts to the existing backend endpoint `/api/auth/google/`.

You just need to create the Client ID (free) and drop it into one env var.

## 1. Create the OAuth Client ID

1. Go to **https://console.cloud.google.com/** and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create.
   - App name: `Sclero Proteins`, support email, developer email. Save.
   - (You can keep it in "Testing" while you trial it, or "Publish" for everyone.)
3. **APIs & Services → Credentials → + Create credentials → OAuth client ID**
   - Application type: **Web application**.
   - Name: `Sclero Proteins Web`.
   - **Authorized JavaScript origins** — add every origin the button loads on:
     ```
     https://scleroproteins.co.uk
     https://scleroproteins.in
     https://scleroproteins.com
     http://localhost:3000      (for local development)
     ```
   - **Authorized redirect URIs** — Google Identity Services (the button we use)
     does NOT need redirect URIs, but adding your domains is harmless. Leave empty
     or add the same domains.
   - Create → copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`).

> Use the **Client ID** only. The button uses Google Identity Services (a JWT
> credential decoded in the browser), so the Client *secret* is never needed on
> the frontend.

## 2. Add it to the app

**Local dev** — in `frontend/.env` (or `.env.local`):
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
Restart `npm run dev`. The "Continue with Google" button now appears at `/account`.

**Production (Docker)** — in your root `.env` (used by docker-compose):
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```
Then rebuild the frontend image (the value is baked in at build time):
```
docker compose build frontend && docker compose up -d frontend
```

## 3. That's it

- When the env var is **empty**, only email/password, magic-link, and email-code
  login show — nothing "unavailable" is displayed.
- When it's **set**, the Google button renders; clicking it signs the user in (or
  creates their account) via `/api/auth/google/` and issues the normal JWT.

No code changes are required on your side — only the Client ID.
