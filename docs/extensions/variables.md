# Extension Variables — Copy-Paste Reference

All `{{variables}}` available for use in `docker-compose.yml` and the `env` field in `installation.yaml`.

---

## Sulla Settings

```
{{sullaEmail}}
{{sullaPassword}}
{{sullaServicePassword}}
{{sullaN8nEncryptionKey}}
{{sullaModel}}
{{primaryUserName}}
{{pathUserData}}
```

---

## Built-in Paths

```
{{path.home}}
{{path.documents}}
{{path.downloads}}
{{path.desktop}}
{{path.movies}}
{{path.music}}
{{path.pictures}}
{{path.images}}
{{path.photos}}
{{path.videos}}
{{path.data}}
{{path.appdir}}
```

Aliases: `images` and `photos` → Pictures, `videos` → Movies.

---

## Integration Credentials

Format: `{{INTEGRATION_ID.PROPERTY}}`

```
{{SLACK.BOT_KEY}}
{{SLACK.WEBHOOK_URL}}
{{GITHUB.ACCESS_TOKEN}}
{{SMTP.HOST}}
{{SMTP.USERNAME}}
{{SMTP.PASSWORD}}
```

---

## Modifiers

Append with pipe: `{{variable|modifier}}`

```
{{sullaServicePassword|urlencode}}
{{sullaN8nEncryptionKey|base64}}
{{path.movies|quote}}
{{sullaEmail|json}}
```

---

## Shell Variables (setup & commands only)

```
${APP_DIR}
${COMPOSE_FILE}
```
