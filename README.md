# vesper-desk-backend

Backend service for Vesper Desk. First (and currently only) job: an
authenticated download proxy for `Justin-Developer01/vesper-desk`'s GitHub
releases, so that repo can go private later without breaking the "Download
for Windows" button on [vesper-desk-web](https://github.com/Justin-Developer01/vesper-desk-web).

## Why this exists

`vesper-desk-web` currently fetches the latest release straight from GitHub's
public API and links directly to `browser_download_url`. That only works
while `vesper-desk` is public. GitHub release assets on a **private** repo
require an authenticated request to resolve — an anonymous browser can't
fetch them directly. This service holds a GitHub token server-side and
resolves that on the visitor's behalf.

## How it works

`GET /v1/download/latest`:
1. Lists releases on `vesper-desk` (walks newest-first, skips any release
   whose build hasn't finished uploading its Setup asset yet — mirrors the
   fallback logic in `vesper-desk-web`'s `lib/github.ts`).
2. Asks GitHub's asset API for that asset with
   `Accept: application/octet-stream`, which — when authenticated — 302s to
   a short-lived signed URL instead of streaming the file through this
   server.
3. Redirects the browser there.

Nothing is proxied through this VPS byte-for-byte; the ~80MB installer
transfers straight from GitHub to the visitor. This also means it works
today, with `vesper-desk` still public — `GITHUB_TOKEN` is optional until
that repo goes private (see `.env.example`).

`GET /healthz` — plain liveness check.

## Local development

```bash
cp .env.example .env   # fill in GITHUB_TOKEN once vesper-desk is private
npm install
npm run dev
```

## Deploy (Hostinger VPS)

```bash
cp .env.example .env   # set GITHUB_TOKEN, PORT if needed
docker compose up -d --build
```

Put this behind a reverse proxy (Caddy or nginx) for TLS — this service
itself only speaks plain HTTP on `PORT` (8787 by default).

## Not yet built

This repo is scoped to the download proxy only for now. The Kick chat
webhook relay is a separate, later piece — see the coordination plan for
context on what else this backend is expected to eventually hold.
