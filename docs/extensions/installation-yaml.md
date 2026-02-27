# installation.yaml Reference

The `installation.yaml` file is the heart of your extension. It tells Sulla Desktop how to install, configure, start, stop, and manage your extension.

## Full Schema

```yaml
# Required — unique identifier for your extension
id: stirling-pdf

# Required — display name shown in the UI
name: Stirling-PDF

# Required — short description of what your extension does
description: Full-featured open-source PDF toolbox — merge, split, compress, OCR, sign, convert, and more

# Required — icon filename (must exist in your recipe folder)
icon: stirling.svg

# Required — semantic version string
version: "2026.02"

# Required — category for catalog filtering
category: productivity

# Compose configuration
compose:
  composeFile: "docker-compose.yml"   # Path to your compose file (default: docker-compose.yml)
  envFile: ".env"                      # Optional .env file for docker compose

# Setup commands run in order during installation
setup:
  - command: "echo 'Installing...'"
  - command: "chmod +x ${APP_DIR}/some-script.sh"
  - command: "${APP_DIR}/some-script.sh"
    optional: false   # If false, failure blocks the install. Default: true

# Runtime commands — how Sulla manages your extension
commands:
  start:   "docker compose -f ${COMPOSE_FILE} up -d"
  stop:    "docker compose -f ${COMPOSE_FILE} down"
  restart: "docker compose -f ${COMPOSE_FILE} restart"
  status:  "docker compose -f ${COMPOSE_FILE} ps"
  update:  "docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d"
  logs:    "docker compose -f ${COMPOSE_FILE} logs --tail=100"

# Port your extension listens on (informational)
defaultPort: 30201

# URL paths for browser integration
adminPath: "/admin"
webmailPath: "/webmail"
openInBrowser: true

# Extra URLs — shown in the UI card dropdown and system tray
extraUrls:
  - label: "Dashboard"
    url: "http://localhost:30201"
  - label: "Admin Panel"
    url: "http://localhost:30201/admin"

# Environment variables — defaults that users can override
env:
  DOMAIN: "localhost"
  ENABLE_SSL: "false"
```

## Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. Use lowercase, hyphens only. Must match your recipe folder name. |
| `name` | string | Human-readable display name. |
| `description` | string | One-line description shown in the catalog. |
| `icon` | string | Filename of your icon asset in the recipe folder. |
| `version` | string | Version of your extension. Use semantic versioning. |
| `category` | string | Primary category: `productivity`, `email`, `media`, `communication`, `business`, `development`, `security`, `utility-tools`, etc. |

### compose

Tells Sulla where your Docker Compose file is.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `composeFile` | string | `docker-compose.yml` | Path to your compose file, relative to `${APP_DIR}`. |
| `envFile` | string | — | Optional `.env` file to pass to `docker compose --env-file`. |

If your extension ships its compose file in the recipe folder (recommended), the default `docker-compose.yml` just works. If you use `git clone` in your setup to pull a repo, point `composeFile` to the right path within that clone.

### setup

An ordered list of shell commands to run during installation. Each step runs via `/bin/sh -c <command>` with `cwd` set to the extension directory (`${APP_DIR}`).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `command` | string | **required** | The shell command to run. |
| `cwd` | string | `${APP_DIR}` | Working directory for this command. Supports `${APP_DIR}` substitution. |
| `optional` | boolean | `true` | If `true`, a failure logs a warning but installation continues. If `false`, failure aborts the install. |

**Setup steps are optional by default.** This is intentional — interactive scripts (like config generators that prompt for user input) will fail in automated mode, and you don't want that to block installation.

If a step is critical (e.g. creating a required config file), set `optional: false`.

#### Shell Variable Substitution

These variables are replaced in all `command` and `cwd` values:

| Variable | Resolves To |
|----------|-------------|
| `${APP_DIR}` | The extension's local directory on disk |
| `${COMPOSE_FILE}` | Full absolute path to the compose file |

> **Note:** Paths containing spaces are automatically shell-quoted when substituted into commands.

#### Examples

**Simple — no setup needed** (compose file is in the recipe folder):
```yaml
setup: []
```

**Git clone a repo, then run a config script:**
```yaml
setup:
  - command: "git clone --branch master --depth 1 https://github.com/example/app.git ${APP_DIR}/repo"
    optional: false
  - command: "cd ${APP_DIR}/repo && ./generate_config.sh"
    optional: true
```

**Download a file and set permissions:**
```yaml
setup:
  - command: "curl -sL https://example.com/config.tar.gz | tar xz -C ${APP_DIR}"
    optional: false
  - command: "chmod +x ${APP_DIR}/entrypoint.sh"
```

### commands

Shell commands Sulla uses to manage your extension at runtime. All commands support `${APP_DIR}` and `${COMPOSE_FILE}` substitution. They run with `cwd` set to `${APP_DIR}`.

| Field | Type | Description |
|-------|------|-------------|
| `start` | string | Start your containers. |
| `stop` | string | Stop your containers. |
| `restart` | string | Restart your containers. If omitted, Sulla runs `stop` then `start`. |
| `status` | string | Check if your containers are running. |
| `update` | string | Pull latest images and restart. |
| `logs` | string | Tail recent container logs. |

The standard pattern for compose-based extensions:

```yaml
commands:
  start:   "docker compose -f ${COMPOSE_FILE} up -d"
  stop:    "docker compose -f ${COMPOSE_FILE} down"
  restart: "docker compose -f ${COMPOSE_FILE} restart"
  status:  "docker compose -f ${COMPOSE_FILE} ps"
  update:  "docker compose -f ${COMPOSE_FILE} pull && docker compose -f ${COMPOSE_FILE} up -d"
  logs:    "docker compose -f ${COMPOSE_FILE} logs --tail=100"
```

If your extension uses a git-cloned repo, point to the compose file in that subdirectory:

```yaml
commands:
  start: "docker compose -f ${APP_DIR}/repo/docker-compose.yml up -d"
  stop:  "docker compose -f ${APP_DIR}/repo/docker-compose.yml down"
```

### extraUrls

A list of URLs that your extension registers. These appear in two places:

1. **Extension card** — a dropdown "Open" button on the installed extension card in the UI
2. **System tray** — under `Tray > Extensions > Your Extension Name`, each URL is a clickable menu item

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Display label for the link (e.g. "Dashboard", "Webmail"). |
| `url` | string | Full URL including protocol and port. |

```yaml
extraUrls:
  - label: "Stirling-PDF Dashboard"
    url: "http://localhost:30201"
```

Users see this in the system tray as:

```
Tray Icon
└── Extensions ▸
    └── Stirling-PDF ▸
        └── Stirling-PDF Dashboard   ← clicks open browser
```

And on the extension card as a green "Open ▾" dropdown button.

### env

Environment variables for your extension. Sulla writes these as a `.env` file in the extension directory before each start. Docker Compose reads `.env` automatically.

Values support `{{variable}}` substitution (see [Variable Reference](#variable-reference) below).

```yaml
env:
  DOMAIN: "localhost"
  DB_HOST: "sulla-mariadb"
  DB_NAME: "myapp"
  ADMIN_EMAIL: "{{sullaEmail}}"
  APP_SECRET: "{{sullaN8nEncryptionKey}}"
  SLACK_TOKEN: "{{SLACK.BOT_KEY}}"
```

The `.env` file is **refreshed on every start**, so if the user changes their settings or integration credentials, the new values take effect on the next restart.

---

## Variable Reference

Sulla Desktop supports `{{variable}}` placeholders in two places:

1. **`docker-compose.yml`** — resolved once at install time, written to disk
2. **`env` field** — resolved on every start, written as `.env`

Unresolvable placeholders are left as-is (not removed), so you can debug missing values easily.

### Sulla Settings Variables

Access any property from the user's Sulla Settings (stored in PostgreSQL/Redis, bootstrapped from the fallback JSON file).

| Syntax | Description |
|--------|-------------|
| `{{sullaEmail}}` | User's email address |
| `{{sullaPassword}}` | User's Sulla account password |
| `{{sullaServicePassword}}` | Auto-generated service password (used for internal databases, APIs) |
| `{{sullaN8nEncryptionKey}}` | Auto-generated encryption key (base64) |
| `{{sullaModel}}` | Default AI model (e.g. `qwen2:0.5b`) |
| `{{primaryUserName}}` | User's display name |
| `{{pathUserData}}` | Path to user data directory |

Any property stored in `SullaSettingsModel` can be referenced by its exact key name.

### Integration Variables

Access credentials and config from connected integrations. Format: `{{INTEGRATION_ID.PROPERTY}}`.

| Syntax | Description |
|--------|-------------|
| `{{SLACK.BOT_KEY}}` | Slack bot token |
| `{{SLACK.WEBHOOK_URL}}` | Slack webhook URL |
| `{{GITHUB.ACCESS_TOKEN}}` | GitHub personal access token |
| `{{SMTP.HOST}}` | SMTP server hostname |
| `{{SMTP.USERNAME}}` | SMTP username |
| `{{SMTP.PASSWORD}}` | SMTP password |

The `INTEGRATION_ID` and `PROPERTY` match whatever the user configured in Sulla Desktop's Integrations panel. Any `integration_id.property` pair stored in the `IntegrationService` is accessible.

### Built-in Path Variables

Auto-resolved from the user's operating system. Directories are created automatically if they don't exist.

| Variable | macOS Example | Description |
|----------|---------------|-------------|
| `{{path.home}}` | `/Users/jonathon` | User's home directory |
| `{{path.documents}}` | `/Users/jonathon/Documents` | Documents folder |
| `{{path.downloads}}` | `/Users/jonathon/Downloads` | Downloads folder |
| `{{path.desktop}}` | `/Users/jonathon/Desktop` | Desktop folder |
| `{{path.movies}}` | `/Users/jonathon/Movies` | Movies folder |
| `{{path.music}}` | `/Users/jonathon/Music` | Music folder |
| `{{path.pictures}}` | `/Users/jonathon/Pictures` | Pictures folder |
| `{{path.data}}` | `<extension_dir>/data` | Extension's persistent data directory (survives uninstall) |
| `{{path.appdir}}` | `<extension_dir>` | Extension's install directory (same as `${APP_DIR}`) |

### Modifiers

Pipe a value through a modifier to transform it before substitution. Syntax: `{{variable|modifier}}`.

| Modifier | Effect | Example | Result |
|----------|--------|---------|--------|
| `urlencode` | Percent-encode special characters | `{{sullaServicePassword\|urlencode}}` | `f%40ze4C7IPbgWSRHR` |
| `base64` | Base64-encode | `{{sullaServicePassword\|base64}}` | `ZkB6ZTRDNy4uLg==` |
| `quote` | Wrap in escaped single quotes | `{{path.movies\|quote}}` | `'/Users/me/Movies'` |
| `json` | JSON-stringify (with quotes) | `{{sullaEmail\|json}}` | `"user@example.com"` |

**When to use modifiers:**

- **`urlencode`** — Always use when embedding passwords or values with special characters (`@`, `/`, `#`, `?`, `&`, `=`, `+`, spaces) inside URLs or connection strings:
  ```yaml
  PG_DATABASE_URL: postgres://user:{{sullaServicePassword|urlencode}}@db:5432/mydb
  ```

- **`base64`** — Use for secrets that need base64 encoding:
  ```yaml
  APP_SECRET: "{{sullaN8nEncryptionKey|base64}}"
  ```

- **`quote`** — Use when a path might contain spaces and is used in a shell context:
  ```yaml
  setup:
    - command: "ls {{path.documents|quote}}"
  ```

- **`json`** — Use when embedding a value in a JSON config file:
  ```yaml
  setup:
    - command: "echo '{\"email\": {{sullaEmail|json}}}' > ${APP_DIR}/config.json"
  ```

### Variable Syntax Quick Reference

| Context | Syntax | Example |
|---------|--------|---------|
| Shell commands (`setup`, `commands`) | `${VAR}` | `${APP_DIR}`, `${COMPOSE_FILE}` |
| Docker Compose files | `{{var}}` | `{{sullaEmail}}`, `{{path.movies}}` |
| `env` field in installation.yaml | `{{var}}` | `{{sullaServicePassword\|urlencode}}` |
| With modifier | `{{var\|mod}}` | `{{sullaServicePassword\|urlencode}}` |
| Integration values | `{{ID.PROP}}` | `{{SLACK.BOT_KEY}}` |
| Path variables | `{{path.name}}` | `{{path.data}}` |

> **Important:** `${VAR}` and `{{var}}` are two different systems. `${VAR}` is for shell commands only. `{{var}}` is for compose files and env values only. Do not mix them.

---

### Data Persistence

Extensions have a `data/` subdirectory inside their install directory (`{{path.data}}`). This directory is **preserved when the user uninstalls** the extension (unless they explicitly check "Delete my data" in the uninstall confirmation dialog).

Use `{{path.data}}` for bind-mount volumes that should survive uninstall/reinstall:

```yaml
volumes:
  - {{path.data}}/config:/config
  - {{path.data}}/storage:/data
```

---

### Browser Integration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultPort` | number | — | The primary port your extension listens on. |
| `adminPath` | string | — | URL path to admin panel (e.g. `/admin`). |
| `webmailPath` | string | — | URL path to webmail (e.g. `/webmail`). |
| `openInBrowser` | boolean | `false` | Whether to auto-open the extension in the browser after start. |

## Minimal Example

The simplest possible `installation.yaml`:

```yaml
id: my-extension
name: My Extension
description: A simple web app
icon: icon.png
version: "1.0.0"
category: utility-tools

setup: []

commands:
  start: "docker compose -f ${COMPOSE_FILE} up -d"
  stop:  "docker compose -f ${COMPOSE_FILE} down"

extraUrls:
  - label: "Open My Extension"
    url: "http://localhost:8080"
```

Pair this with a `docker-compose.yml` in your recipe folder and you're done.
