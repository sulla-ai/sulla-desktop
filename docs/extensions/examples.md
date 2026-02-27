# Extension Examples

Real-world examples from the Sulla Desktop marketplace, annotated to explain each design decision.

---

## Example 1: Stirling-PDF (Simple — Compose Ships With Recipe)

The simplest pattern. No git clone, no setup steps. Just a Docker Compose file and an installation manifest.

### File Structure

```
recipes/stirling-pdf/
├── installation.yaml
├── manifest.yaml
├── docker-compose.yml
└── stirling.svg
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  stirling-pdf:
    image: stirlingtools/stirling-pdf:latest
    container_name: stirling-pdf
    ports:
      - "30201:8080"          # External 30201 → Internal 8080
    volumes:
      - stirling-data:/configs
      - ./custom:/custom      # Relative to APP_DIR
    environment:
      - SYSTEM_LANGUAGE=en-GB
      - DOCKER_ENABLE_SECURITY=false
    restart: unless-stopped

volumes:
  stirling-data:
```

**Key points:**
- Uses port `30201` (in the 30000+ range to avoid conflicts)
- Mounts a named volume for persistent data
- Uses `./custom` relative path — this resolves to `${APP_DIR}/custom`
- `restart: unless-stopped` ensures the container survives reboots

### installation.yaml

```yaml
id: stirling-pdf
name: Stirling-PDF
description: Full-featured open-source PDF toolbox
icon: stirling.svg
version: "2026.02"
category: productivity

# Compose file ships with the recipe — no special config needed
compose:
  composeFile: "docker-compose.yml"

# No setup needed — docker compose pull happens automatically on start
setup: []

# Standard compose commands
commands:
  start:   "docker compose -f ${COMPOSE_FILE} up -d"
  stop:    "docker compose -f ${COMPOSE_FILE} down"
  restart: "docker compose -f ${COMPOSE_FILE} restart"
  status:  "docker compose -f ${COMPOSE_FILE} ps"
  update:  "docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d"
  logs:    "docker compose -f ${COMPOSE_FILE} logs --tail=100"

# One URL — the main dashboard
extraUrls:
  - label: "Stirling-PDF Dashboard"
    url: "http://localhost:30201"
```

**Why this works:**
- `setup: []` — nothing to do. The compose file is already in the recipe folder.
- When the user clicks "Install", Sulla downloads `docker-compose.yml` from the recipe folder into the extension directory.
- When the user starts it, Sulla runs `docker compose -f /path/to/stirling-pdf/docker-compose.yml up -d`.
- The "Stirling-PDF Dashboard" URL appears in the extension card and system tray.

### What happens at install time

```
1. Fetch installation.yaml from GitHub
2. Create extensions/stirling-pdf/ directory
3. Download all recipe assets:
   - docker-compose.yml
   - manifest.yaml
   - stirling.svg
4. Save installation.yaml, labels.json
5. Run setup steps: (none)
6. Mark installed (version.txt)
```

### What happens at start time

```
1. Read installation.yaml from disk
2. Resolve: ${COMPOSE_FILE} → /path/to/extensions/stirling-pdf/docker-compose.yml
3. Run: docker compose -f /path/to/.../docker-compose.yml up -d
4. Docker pulls stirlingtools/stirling-pdf:latest (if not cached)
5. Container starts on port 30201
```

---

## Example 2: Mailcow (Advanced — Git Clone + Interactive Setup)

A complex extension that clones an upstream repository and has an interactive config script.

### File Structure

```
recipes/mailcow/
├── installation.yaml
├── manifest.yaml
└── cow_mailcow.svg
```

Note: **no `docker-compose.yml`** in the recipe folder. The compose file comes from the cloned git repo.

### installation.yaml

```yaml
id: mailcow
name: Mailcow
description: Full-featured open-source mail server
icon: mailcow.png
version: "2026.02"
category: email

# Compose file lives inside the cloned repo
compose:
  composeFile: "docker-compose.yml"

# Setup clones the repo, then runs the config generator
setup:
  - command: "git clone --branch master --depth 1 https://github.com/mailcow/mailcow-dockerized.git ${APP_DIR}/repo"
    optional: false    # Clone MUST succeed
  - command: "cd ${APP_DIR}/repo && ./generate_config.sh"
    optional: true     # Interactive script — will fail in automated mode, that's OK

# Commands point to the compose file inside the cloned repo
commands:
  start:   "docker compose -f ${APP_DIR}/repo/docker-compose.yml up -d"
  stop:    "docker compose -f ${APP_DIR}/repo/docker-compose.yml down"
  restart: "docker compose -f ${APP_DIR}/repo/docker-compose.yml restart"
  status:  "docker compose -f ${APP_DIR}/repo/docker-compose.yml ps"
  update:  "cd ${APP_DIR}/repo && git pull && docker compose pull && docker compose up -d"
  logs:    "docker compose -f ${APP_DIR}/repo/docker-compose.yml logs --tail=100"

defaultPort: 8080
adminPath: "/mailcow"
webmailPath: "/webmail"
openInBrowser: true

extraUrls:
  - label: "Roundcube Webmail"
    url: "http://localhost:8080/webmail"
  - label: "SOGo Calendar"
    url: "http://localhost:8080/SOGo"
  - label: "Admin Panel (direct)"
    url: "http://localhost:8080/mailcow"

env:
  DOMAIN: "yourdomain.com"
  SKIP_LETS_ENCRYPT: "n"
```

**Key points:**
- First setup step clones the mailcow repo into `${APP_DIR}/repo`. It's marked `optional: false` because the whole extension depends on it.
- Second step runs `generate_config.sh` — this is interactive (asks for domain, timezone). It's `optional: true` so installation succeeds even though the script fails. The user can run it manually later.
- Commands reference `${APP_DIR}/repo/docker-compose.yml` since the compose file is inside the cloned repository, not in the recipe folder.
- `update` command does a `git pull` first to get upstream changes.
- Multiple `extraUrls` — webmail, calendar, and admin panel all appear in the dropdown and tray.

### What happens at install time

```
1. Fetch installation.yaml from GitHub
2. Create extensions/mailcow/ directory
3. Download recipe assets: manifest.yaml, cow_mailcow.svg
4. Save installation.yaml, labels.json
5. Run setup steps:
   a. git clone mailcow-dockerized → extensions/mailcow/repo/
   b. ./generate_config.sh → FAILS (interactive) → logged as warning, continues
6. Mark installed (version.txt)
```

### Directory after install

```
extensions/mailcow/
├── installation.yaml
├── manifest.yaml
├── cow_mailcow.svg
├── labels.json
├── version.txt
└── repo/                          ← cloned from GitHub
    ├── docker-compose.yml
    ├── generate_config.sh
    ├── data/
    └── ...
```

---

## Example 3: Minimal Template

Copy this to get started quickly.

### docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    image: your-org/your-app:latest
    container_name: my-extension
    ports:
      - "30XXX:8080"
    environment:
      - APP_ENV=production
    restart: unless-stopped
```

### installation.yaml

```yaml
id: my-extension
name: My Extension
description: What it does
icon: icon.png
version: "1.0.0"
category: utility-tools

setup: []

commands:
  start: "docker compose -f ${COMPOSE_FILE} up -d"
  stop:  "docker compose -f ${COMPOSE_FILE} down"

extraUrls:
  - label: "Open My Extension"
    url: "http://localhost:30XXX"
```

Replace `30XXX` with your chosen port.

---

## Patterns

### Using Shared Infrastructure

If Sulla already runs a database your extension needs:

```yaml
# docker-compose.yml
services:
  my-app:
    image: my-app:latest
    environment:
      - DB_HOST=sulla-mariadb
      - DB_PORT=3306
      - DB_NAME=${DB_NAME:-myapp}
    networks:
      - sulla-shared
      - default

networks:
  sulla-shared:
    external: true
```

```yaml
# installation.yaml
env:
  DB_NAME: "myapp"
  DB_USER: "myapp"
  DB_PASSWORD: "changeme"
```

### Downloading Additional Files During Setup

```yaml
setup:
  - command: "curl -sL https://example.com/config.tar.gz | tar xz -C ${APP_DIR}"
    optional: false
  - command: "chmod +x ${APP_DIR}/scripts/*.sh"
```

### Custom Update Logic

```yaml
commands:
  update: >
    cd ${APP_DIR} &&
    docker compose -f ${COMPOSE_FILE} pull &&
    docker compose -f ${COMPOSE_FILE} down &&
    docker compose -f ${COMPOSE_FILE} up -d
```

### Multiple Services with Separate Logs

```yaml
commands:
  logs: "docker compose -f ${COMPOSE_FILE} logs --tail=50 app worker scheduler"
```
