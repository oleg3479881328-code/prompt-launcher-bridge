# Prompt Launcher Bridge — Cloudflare Worker

## Purpose

This Worker is the secure bridge between the Notion prompt library and the static Prompt Launcher.

It receives only the selected Notion page ID, reads the `Промпт` field through the official Notion API, verifies that the page belongs to the canonical prompt-library data source, and returns the prompt to the browser.

## Security model

- `NOTION_ACCESS_TOKEN` is stored only as a Cloudflare Worker secret.
- `BRIDGE_ACCESS_KEY` is stored only as a Cloudflare Worker secret and entered once in the launcher's local browser settings.
- The browser never receives the Notion token.
- The Worker allows prompt reads only from the canonical data source:
  `27ffd6ba-fc55-4c0d-8f00-d78724d33a61`.
- Responses use `Cache-Control: no-store`.
- CORS is restricted to the Prompt Launcher origin.
- Do not commit `.dev.vars`, `.env`, API tokens, access keys, or account credentials.

## Files

- `src/index.js` — Worker implementation.
- `wrangler.toml` — Worker configuration.
- `.dev.vars.example` — placeholder names only, with no real secrets.
- `.gitignore` — excludes local secrets.
- `../prompt-launcher/index.html` — static browser UI.

## Recommended one-click deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oleg3479881328-code/Project-Execution-OS/tree/main/prompt-bridge-worker)

Cloudflare will clone the public Worker source and guide the account owner through deployment. Enter real secret values only inside Cloudflare. Do not place them in GitHub files, issues, comments, or chat.

## Manual one-time activation

### 1. Create or deploy the Worker

From this directory:

```bash
npm install
npx wrangler login
npx wrangler deploy
```

Cloudflare will return a URL similar to:

```text
https://prompt-launcher-bridge.<your-workers-subdomain>.workers.dev
```

### 2. Add Worker secrets

Add these as Cloudflare Worker secrets, never as plaintext repository variables:

```bash
npx wrangler secret put NOTION_ACCESS_TOKEN
npx wrangler secret put BRIDGE_ACCESS_KEY
```

`NOTION_ACCESS_TOKEN` must belong to a Notion connection with read access to the canonical prompt library.

`BRIDGE_ACCESS_KEY` should be a separate random value used only to protect this bridge endpoint.

### 3. Verify the Worker

```text
https://prompt-launcher-bridge.<your-workers-subdomain>.workers.dev/health
```

Expected response:

```json
{"ok":true,"service":"prompt-launcher-bridge"}
```

### 4. Configure the browser once

1. Open the Prompt Launcher.
2. Expand `⚙ Настройка bridge-сервиса`.
3. Paste the Worker URL.
4. Paste `BRIDGE_ACCESS_KEY`.
5. Select `Сохранить настройки`.

After that, Notion rows can load their prompt automatically from the page ID passed in the launch URL.

## Optional GitHub Actions deployment

The repository contains `.github/workflows/deploy-prompt-bridge-worker.yml`.

For CI deployment, add these GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Do not store their values in the repository.

The Worker-level secrets `NOTION_ACCESS_TOKEN` and `BRIDGE_ACCESS_KEY` remain configured inside Cloudflare.

## API

### Health check

```http
GET /health
```

### Retrieve prompt

```http
GET /api/prompt?page=<notion-page-id>
X-Bridge-Key: <bridge-access-key>
```

Successful response:

```json
{
  "pageId": "...",
  "title": "...",
  "prompt": "..."
}
```
