import fs from 'fs';
import { Telegram } from 'telegraf';
import { TelegramStoryPublisher, PublishStoryOptions } from '../../application/ports/telegram-story-publisher';
import { MediaAsset } from '../../domain/entities/media-asset';
import { InstagramMediaMetadata } from '../../domain/entities/instagram-media';
import { Logger } from '../../application/ports/logger';

export class BotApiStoryPublisher implements TelegramStoryPublisher {
  constructor(
    private readonly telegram: Telegram,
    private readonly targetChatId: string,
    private readonly logger: Logger,
  ) {}

  async publish(media: MediaAsset, metadata: InstagramMediaMetadata, options?: PublishStoryOptions): Promise<void> {
    if (!this.targetChatId) {
      throw new Error('TELEGRAM_TARGET_CHAT_ID is required when MTProto configuration is not provided');
    }

    const caption = options?.caption ?? metadata.caption ?? '';

    if (media.kind === 'video') {
      await this.telegram.sendVideo(this.targetChatId, { source: fs.createReadStream(media.localPath) }, { caption });
    } else {
      await this.telegram.sendPhoto(this.targetChatId, { source: fs.createReadStream(media.localPath) }, { caption });
    }

    this.logger.info('Published media using Bot API fallback', { targetChatId: this.targetChatId });
  }
}
