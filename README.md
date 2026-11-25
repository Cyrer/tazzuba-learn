# Tazzuba Learn

Pi Network app (Production / Mainnet). App ID: 6b070e983b2dac0bff960be5

## What's here
- `public/index.html` – the app: Pi login, 3 tracks, lessons, quizzes, streaks, paywall, invites
- `public/lessons.json` – the 30 lessons
- `public/privacy.html`, `public/terms.html` – required for the Pi listing
- `api/auth.js` – checks the Pi sign-in with api.minepi.com/v2/me
- `vercel.json` – hosting settings

## Deploy (Vercel)
1. Put this folder in a GitHub repo.
2. vercel.com → Add New → Project → import the repo → Deploy (no settings to change).
3. Project → Settings → Domains → add `learn.tazzuba.com`.
4. At your domain's DNS, add the CNAME record Vercel shows (learn → cname.vercel-dns.com).

## Still to switch on
- Payments: create the app wallet in Pi Developers, then add `PI_API_KEY` in Vercel → Settings → Environment Variables.
- AI tutor: add an AI API key the same way.
- Pi domain check: add `public/validation-key.txt` with the key from Pi Developers.
