# upfile-cli

[![npm version](https://img.shields.io/npm/v/upfilesh.svg)](https://www.npmjs.com/package/upfilesh)
[![GitHub release](https://img.shields.io/github/v/release/upfilesh/cli.svg)](https://github.com/upfilesh/cli/releases)

Upload any file from your terminal. Get a permanent URL instantly.

→ [upfile.sh](https://upfile.sh)

## Install

```bash
yarn global add upfilesh
```

## Setup

### Self-signup (get an API key)

```bash
upfile signup --email your@email.com
```

This creates an account and saves your API key to `~/.upfile/config.json`.

### Existing API key

```bash
upfile config set api-key YOUR_API_KEY
```

## Usage

```bash
# Check storage status
upfile status

# Public — permanent URL, anyone can access
upfile screenshot.png
# https://cdn.upfile.sh/xK9mZ.png

# Expiring — self-destructs after TTL (seconds)
upfile report.pdf --expiry 3600

# Private — auth-gated, only you can access
upfile secret.pdf --private

# JSON output — for AI agents and scripts
upfile screenshot.png --json

# Pipe from stdin — capture and upload in one line
screencapture -x - | upfile
cat file.txt | upfile --json
```

## Upgrade

When you hit the 1GB storage limit, upgrade to Pro:

```bash
upfile upgrade
```

You'll receive an email with a checkout link.

## Options

| Flag | Description |
|------|-------------|
| `--private` | Private file, requires auth to access |
| `--expiry <sec>` | Expiring URL with TTL in seconds |
| `--json` | Full JSON response (url, id, visibility, expires_at) |
| `-v`, `--version` | Print CLI version |

## JSON response

```json
{
  "id": "xK9mZaBcDe",
  "url": "https://cdn.upfile.sh/xK9mZaBcDe.png",
  "visibility": "public",
  "size": 84231,
  "type": "image/png",
  "expires_at": null,
  "created_at": "2026-03-02T03:00:00.000Z"
}
```

## Config

```bash
upfile config set api-key <key>      # save API key
upfile config set endpoint <url>     # self-hosted endpoint
upfile config get                    # view current config
```

Config stored at `~/.upfile/config.json`.

## Environment variables

| Var | Description |
|-----|-------------|
| `UPFILE_API_KEY` | API key (overrides config file) |

## Self-hosting

Deploy your own upfile instance on Cloudflare Workers:

[github.com/upfilesh/worker](https://github.com/upfilesh/worker)
