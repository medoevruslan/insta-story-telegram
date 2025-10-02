import express from 'express';
import { Telegram } from 'telegraf';
import { loadConfig } from './config/env';
import { ConsoleLogger } from './infrastructure/logging/console-logger';
import { NodeFileStorage } from './infrastructure/storage/node-file-storage';
import { HtmlScrapingInstagramDownloader } from './infrastructure/instagram/html-scraping-instagram-downloader';
import { MtProtoStoryPublisher } from './infrastructure/telegram/mtproto-story-publisher';
import { BotApiStoryPublisher } from './infrastructure/telegram/bot-api-story-publisher';
import { CompositeStoryPublisher } from './infrastructure/telegram/composite-story-publisher';
import { PublishInstagramStoryUseCase } from './application/usecases/publish-instagram-story.usecase';
import { createTelegramBot } from './interfaces/webhooks/telegram-bot';
import { BotApiPreviewSender } from './infrastructure/telegram/bot-api-preview-sender';

(async () => {
  const logger = new ConsoleLogger();

  try {
    const config = loadConfig();

    const storage = new NodeFileStorage();
    const instagramDownloader = new HtmlScrapingInstagramDownloader(storage, logger, config.instagram);

    const telegramApi = new Telegram(config.telegram.botToken);
    const previewSender = new BotApiPreviewSender(telegramApi, config.telegram.targetChatId, logger);

    let mtprotoPublisher = undefined;
    if (config.telegram.mtproto) {
      try {
        mtprotoPublisher = await MtProtoStoryPublisher.initialize(config.telegram.mtproto, logger);
      } catch (error) {
        logger.warn('Failed to initialize MTProto publisher. Falling back to Bot API only.', { error });
      }
    }

    const botApiPublisher = new BotApiStoryPublisher(telegramApi, config.telegram.targetChatId, logger);

    const storyPublisher = new CompositeStoryPublisher(logger, mtprotoPublisher, botApiPublisher);
    const useCase = new PublishInstagramStoryUseCase(instagramDownloader, previewSender, storyPublisher, storage, logger);

    const bot = createTelegramBot(config.telegram.botToken, useCase, logger);

    const app = express();
    app.use(express.json());

    const webhookPath = config.telegram.webhookPath.startsWith('/')
      ? config.telegram.webhookPath
      : `/${config.telegram.webhookPath}`;

    const webhookUrl = new URL(webhookPath, config.telegram.webhookHost).toString();

    app.post(
      webhookPath,
      (req, res, next) => {
        const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
        if (secretHeader !== config.telegram.secretToken) {
          logger.warn('Rejected update due to invalid secret token header');
          return res.status(401).send('Unauthorized');
        }
        return next();
      },
      (req, res, next) => (bot.webhookCallback(webhookPath))(req, res, next),
    );

    app.get('/healthz', (_, res) => res.status(200).send({ status: 'ok' }));

    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: config.telegram.secretToken,
      drop_pending_updates: true,
    });

    const server = app.listen(config.telegram.port, () => {
      logger.info('Telegram webhook server running', {
        port: config.telegram.port,
        webhookUrl,
      });
    });

    const shutdown = async () => {
      logger.info('Shutting down');
      await bot.telegram.deleteWebhook();
      server.close();
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Fatal error during bootstrap', { error });
    process.exit(1);
  }
})();
