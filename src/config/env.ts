import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export interface TelegramConfig {
  botToken: string;
  secretToken: string;
  webhookHost: string;
  webhookPath: string;
  port: number;
  targetChatId: string;
  mtproto?: {
    appId: number;
    appHash: string;
    botPhone: string;
    session: string;
  };
}

export interface InstagramConfig {
  appId?: string;
  appSecret?: string;
  sessionId?: string;
  ytDlpBinary?: string;
  ytDlpCookiesFromBrowser?: string;
  ytDlpCookiesFile?: string;
}

export interface AppConfig {
  telegram: TelegramConfig;
  instagram: InstagramConfig;
}

export const loadConfig = (): AppConfig => {
  const port = Number(process.env.PORT || 3000);

  const telegram: TelegramConfig = {
    botToken: required(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN"),
    secretToken: required(
      process.env.TELEGRAM_SECRET_TOKEN,
      "TELEGRAM_SECRET_TOKEN"
    ),
    webhookHost: required(process.env.WEBHOOK_HOST, "WEBHOOK_HOST"),
    webhookPath: process.env.WEBHOOK_PATH || "/telegram/webhook",
    port,
    targetChatId: required(
      process.env.TELEGRAM_TARGET_CHAT_ID,
      "TELEGRAM_TARGET_CHAT_ID"
    ),
  };

  if (
    process.env.TELEGRAM_APP_ID &&
    process.env.TELEGRAM_APP_HASH &&
    process.env.TELEGRAM_BOT_SESSION
  ) {
    telegram.mtproto = {
      appId: Number(process.env.TELEGRAM_APP_ID),
      appHash: process.env.TELEGRAM_APP_HASH,
      botPhone: required(process.env.TELEGRAM_BOT_PHONE, "TELEGRAM_BOT_PHONE"),
      session: process.env.TELEGRAM_BOT_SESSION,
    };
  }

  const instagram: InstagramConfig = {
    appId: process.env.INSTAGRAM_APP_ID,
    appSecret: process.env.INSTAGRAM_APP_SECRET,
    sessionId: process.env.INSTAGRAM_SESSION_ID,
    ytDlpBinary: process.env.YTDLP_PATH ?? process.env.YTDLP_BINARY,
    ytDlpCookiesFromBrowser: process.env.YTDLP_COOKIES_BROWSER,
    ytDlpCookiesFile:
      process.env.YTDLP_COOKIES_FILE ?? process.env.YTDLP_COOKIES,
  };

  return { telegram, instagram };
};
