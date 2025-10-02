import { TelegramStoryPublisher, PublishStoryOptions } from '../../application/ports/telegram-story-publisher';
import { MediaAsset } from '../../domain/entities/media-asset';
import { InstagramMediaMetadata } from '../../domain/entities/instagram-media';
import { Logger } from '../../application/ports/logger';

export class CompositeStoryPublisher implements TelegramStoryPublisher {
  constructor(
    private readonly logger: Logger,
    private readonly primary?: TelegramStoryPublisher,
    private readonly fallback?: TelegramStoryPublisher,
  ) {}

  async publish(media: MediaAsset, metadata: InstagramMediaMetadata, options?: PublishStoryOptions): Promise<void> {
    if (this.primary) {
      try {
        await this.primary.publish(media, metadata, options);
        return;
      } catch (error) {
        this.logger.warn('Primary story publisher failed, attempting fallback', { error });
      }
    }

    if (!this.fallback) {
      throw new Error('No available Telegram story publisher strategies');
    }

    await this.fallback.publish(media, metadata, options);
  }
}
