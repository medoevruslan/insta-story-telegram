# Instagram Story to Telegram Relay

Node.js/TypeScript service that accepts Instagram reel or story links through a Telegram bot webhook, downloads the media, and republishes it to Telegram Stories (MTProto) or, as a fallback, to a configured chat via the Bot API.

## Architecture
- **Interfaces** (`src/interfaces`): Telegram webhook adapter built with Telegraf.
- **Application** (`src/application`): Use cases and ports following clean-architecture boundaries.
- **Domain** (`src/domain`): Media entities and value objects.
- **Infrastructure** (`src/infrastructure`): Instagram downloader (HTML scraping), storage, logging, and Telegram publishers (MTProto + Bot API fallback).

## Setup
1. Copy `.env.example` to `.env` and fill in credentials:
   - `WEBHOOK_HOST`, `WEBHOOK_PATH`, `PORT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `TELEGRAM_TARGET_CHAT_ID` are mandatory.
   - Install [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on the host machine and optionally set `YTDLP_PATH` if it is not available on the `PATH`.
   - For private or region-locked posts, set `YTDLP_COOKIES_BROWSER` (e.g. `chrome`, `firefox:default`) so yt-dlp can reuse an authenticated browser session, or provide a Netscape cookie file via `YTDLP_COOKIES_FILE`. As a last resort you can supply `INSTAGRAM_SESSION_ID`, which is sent as a cookie header.
   - Provide MTProto credentials (`TELEGRAM_APP_ID`, `TELEGRAM_APP_HASH`, `TELEGRAM_BOT_PHONE`, `TELEGRAM_BOT_SESSION`) to publish real stories; without them the service only delivers the preview message to the target chat.
   - Optional: `INSTAGRAM_SESSION_ID` enables scraping for private assets (requires a valid Instagram cookie).
2. Install dependencies: `npm install`.
3. Build: `npm run build`. Start in dev mode with `npm run dev` or production with `npm start` after building.

## Webhook
Ensure your Telegram bot webhook points to `WEBHOOK_HOST + WEBHOOK_PATH`. The server validates `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_SECRET_TOKEN`.

## Flow
1. User sends an Instagram link to the bot.
2. `yt-dlp` probes and downloads the Instagram media into a temporary location.
3. The service pushes a preview message to `TELEGRAM_TARGET_CHAT_ID` for manual review before attempting to publish the story (MTProto preferred, Bot API fallback). Afterwards it cleans up the temp file.

## Limitations & Next Steps
- HTML scraping is brittle; consider replacing with Facebook Graph API or a stable third-party service.
- MTProto publishing requires a pre-generated session string; automate refresh and secret storage.
- Add persistence/logging, observability, rate limiting, and retry controls before production.
- Extend test coverage with unit tests for parsing and downloader logic, and contract tests for webhook handling.
