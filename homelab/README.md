# Self-hosted build

Opened from GitHub Pages or off a disk, the app keeps everything in that one browser's
`localStorage` - open it on a second machine and it starts empty. This folder is a small server
that stores your data as a JSON file instead, so the same data follows you between machines.

**There is no separate build of the page.** It is the one `index.html` at the repo root, the same
file GitHub Pages serves, and the sync code is inside it. It only ever wakes up when the page is
served from a server that identifies itself, so nothing here changes the public app:

- On open the page probes `data/penny-keeper-current.json` once. A Penny Keeper server answers with an
  `X-Penny-Keeper-Sync: 1` header; anything else - Pages, any other static host, a `file://` copy - does
  not, and the page stays on `localStorage`, silently, making no further requests.
- With sync on, the server copy is loaded at startup and everything is pushed back after every
  change (debounced ~600ms).

The server is the source of truth on load - **last write wins, there is no merge**. Don't have the
app open and editing on two machines at once; the second one to save overwrites the first.

## Running it

The image is built and published to GHCR by
[a workflow in this repo](../.github/workflows/docker-publish.yml), for `linux/amd64` and
`linux/arm64`, so there is nothing to build locally:

```bash
docker run -d --name penny-keeper -p 8080:8080 -v /srv/penny-keeper:/data ghcr.io/shanemc92/penny-keeper:latest
```

Or with the compose file in this folder, which does the same thing:

```bash
docker compose up -d
```

Then open `http://<homelab-host>:8080/`. Your data persists in the mounted volume as
`penny-keeper-current.json` - keep that directory outside the repo, or on the `homelab/data/`
path the compose file uses, which is gitignored so it can never be committed or pushed.

Images are tagged `latest` and `sha-<commit>`. Pin the sha if you would rather upgrade
deliberately than on every `docker compose pull`.

To build it yourself instead, uncomment the `build:` block in `docker-compose.yml` and run
`docker compose up -d --build`. Note the context is the **repo root**, not this folder, because
the image serves the root `index.html`:

```bash
docker build -f homelab/Dockerfile -t penny-keeper .
```

Without Docker at all: `node server.js` (Node 18+, no dependencies), with `DATA_DIR` and `PORT` as
environment variables if you want to change the defaults (`./data` and `8080`).

### Behind an existing reverse proxy (Traefik, Authentik, etc)

Point your stack at `ghcr.io/shanemc92/penny-keeper:latest`, drop the published ports, and put
it on whatever network the proxy uses. Three things trip people up running this from a tool like
Dockge, where the stack directory does not contain the repo:

- Pulling the image sidesteps the worst of it. If you do build locally, `build: .` needs a real
  path to this folder as `build.context` - the directory Dockge runs `docker compose build` from
  usually holds only the compose file, and Dockge's own container has to be able to see that path.
- An `external: true` network must match an *existing* network's exact name. A network declared
  as `apps:` (no explicit `name:`) in some other compose file is normally created as
  `<that stack's project name>_apps`, not literally `apps` - check with `docker network ls`.
- Every `traefik.http.routers.<name>.*` label needs the same `<name>`, including the
  `middlewares=` one. A mismatched name there means the auth middleware silently never applies -
  worth double-checking given this app has no login of its own (see below).

## Security notes

- **This does not touch the public GitHub Pages site.** The homelab page only calls a
  same-origin relative path (`/data/penny-keeper-current.json`). On GitHub Pages, or any other
  plain static host, that path simply 404s and the app falls back to `localStorage` exactly like
  it does today - there's no code path that could reach your homelab from there, and nothing was
  changed in the root `index.html`.
- **The published image carries no data.** It is `server.js` plus the page, with `data/` excluded
  by the root `.dockerignore`, so your data only ever exists in the volume you mount on your own
  host. The image is public because the whole repo is; the data never is.
- **The sync code shipping in the public page changes nothing about it.** It cannot reach your
  server from somebody else's browser: the probe is same-origin and relative, so on Pages it
  resolves to Pages, finds no `X-Penny-Keeper-Sync` header, and stops. It sends no data either way - the
  probe is a bare GET, and no write is attempted unless a Penny Keeper server answered it.
- **The server itself has no login.** It trusts whatever network it's bound to, same as most
  homelab static-file setups. Keep it on your LAN/VPN, or put it behind a reverse proxy with auth
  (Authelia, Tailscale, a basic-auth block, etc) if it's reachable from anywhere less trusted.
- **The server will not start without an explicit auth decision.** Either set `AUTH_TOKEN` to a
  shared secret, or set `ALLOW_NO_AUTH=1` to say you meant to run without one. Leaving both unset
  is refused, with the reason logged - previously an unset token silently disabled the check.
  The shipped `docker-compose.yml` sets `ALLOW_NO_AUTH=1`, because that deployment sits behind a
  reverse proxy doing forward auth: every request is already authenticated before it reaches the
  container, so a second secret adds nothing. Swap it for a real `AUTH_TOKEN` if you expose the
  port anywhere the proxy does not cover. The token is
  compared with `crypto.timingSafeEqual` after a length check, so a wrong guess can't be narrowed
  down by timing. The page's `fetch`/`PUT` calls need to send it too - this is not currently wired
  into the page, so add an `Authorization: Bearer <token>` header in
  `pushToServerNow`/`loadFromServer` in `public/index.html` if you set a token.
- **Every response carries `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and
  `Content-Security-Policy: frame-ancestors 'none'`.** The header CSP deliberately carries only
  `frame-ancestors`, which browsers ignore in a meta tag. The page's own meta CSP handles the rest,
  and two policies both apply rather than one replacing the other, so a fuller header policy would
  intersect with the page's and break the same-origin sync.
- The server only ever reads/writes one fixed file (`penny-keeper-current.json`) inside
  `DATA_DIR`; incoming paths can't traverse out of it, and a PUT/POST body is rejected unless it
  parses as JSON with a `years` object, so a stray unrelated POST can't clobber the file with
  garbage.
- Writes are atomic (write to a temp file, then rename), so a crash or power loss mid-write can't
  leave a half-written, corrupt backup.
- There's still no encryption at rest and no audit log - this is a convenience layer for a
  household, not a hardened multi-user backend. Keep taking occasional manual JSON backups
  (Backup & settings -> Download backup) the same as the README recommends for the public version.
