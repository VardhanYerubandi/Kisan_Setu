# Deploying Kisan Setu (Java backend + React app)

Status: **these steps are untested by the author.** The app and server were tested locally (`./run.sh`); the container and
host configs were written from documentation. Try a throwaway deployment first.

## What any host must provide
1. **Java 21** (or the Docker image below).
2. A **persistent disk** for `KS_DATA` (holds `db.json`, `uploads/`, `secret.key`). Hosts that wipe the disk on restart will erase every user and listing.
3. **Exactly one running instance** (the store is one JSON file, not a shared database).
4. **HTTPS**: Android only allows install, offline mode, camera and location on secure sites.
5. Environment variables (as secrets): `ADMIN_PHONE`, `ADMIN_PIN` (set **before first start**), optional `ANTHROPIC_API_KEY`,
   `DATA_GOV_API_KEY`, and `TRUST_PROXY=1` behind one proxy (so rate limits are per farmer, not per proxy).

Netlify cannot run this backend. It can host only the React build as a static demo with no login, sending or photo checks.

## Option A: Fly.io (persistent volume + HTTPS)
    fly launch --no-deploy --copy-config          # keep the existing fly.toml, change the app name
    fly volumes create kisan_data --size 1 --region sin
    fly secrets set ADMIN_PHONE=9XXXXXXXXX ADMIN_PIN=YOUR-PIN ANTHROPIC_API_KEY=sk-...
    fly deploy
    fly scale count 1

## Option B: any Linux server with Docker + Caddy
    docker build -t kisan-setu .
    docker run -d --name kisan --restart unless-stopped -p 127.0.0.1:8080:8080 -v /srv/kisan-data:/data \
      -e ADMIN_PHONE=9XXXXXXXXX -e ADMIN_PIN=YOUR-PIN -e TRUST_PROXY=1 kisan-setu
Caddyfile: `yourdomain.com { reverse_proxy 127.0.0.1:8080 }`

## Without Docker
    ./run.sh                     # or: mvn -q -f backend/pom.xml package && java -jar backend/target/kisan-setu.jar

## After deploying
1. `https://YOUR-URL/api/health` returns ok.
2. Install on a real Android phone from Chrome. Register a farmer, post a listing, log in at `/admin`.
3. **Test photo diagnosis with real leaf photos.** It has never run against the real AI service.
4. Airplane-mode test: use the app offline, reconnect, and confirm the waiting items send.

## Operations
- Back up the data folder (copy `db.json`, `uploads/`, `secret.key` while idle or after stopping).
- Bump `VERSION` in `frontend/public/sw.js` and run `./build-frontend.sh` so installed phones refresh.
- Lost admin PIN: the only reset is deleting the data folder (erases everything). Store it safely.
- Limits: PIN-only sign-in (no SMS code); rate limits are in memory; the JSON store suits a pilot, so swap `Store.java` for PostgreSQL to scale;
  the AI call can take up to ~40 s, so make sure your proxy timeout is longer.
