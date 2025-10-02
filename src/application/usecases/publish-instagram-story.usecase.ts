import { InstagramMediaDownloader } from "../ports/instagram-media-downloader";
import {
  TelegramStoryPublisher,
  PublishStoryOptions,
} from "../ports/telegram-story-publisher";
import { FileStorage } from "../ports/file-storage";
import { Logger } from "../ports/logger";
import {
  InstagramMediaRequest,
  InstagramMediaMetadata,
} from "../../domain/entities/instagram-media";
import { MediaAsset } from "../../domain/entities/media-asset";
import { TelegramPreviewSender } from "../ports/telegram-preview-sender";

export interface PublishInstagramStoryCommand extends InstagramMediaRequest {
  captionOverride?: string;
  expiresInSeconds?: number;
}

export class PublishInstagramStoryUseCase {
  constructor(
    private readonly downloader: InstagramMediaDownloader,
    private readonly previewSender: TelegramPreviewSender,
    private readonly publisher: TelegramStoryPublisher,
    private readonly storage: FileStorage,
    private readonly logger: Logger
  ) {}

  async execute(command: PublishInstagramStoryCommand): Promise<void> {
    this.logger.info("Starting Instagram story publish pipeline", { command });

    this.validate(command.url);

    const download = await this.downloader.download({
      url: command.url,
      type: command.type,
    });

    const finalCaption = command.captionOverride ?? download.metadata.caption;
    const options: PublishStoryOptions = {
      caption: finalCaption,
      expiresInSeconds: command.expiresInSeconds,
    };

    await this.sendPreview(download.asset, download.metadata, finalCaption);

    // try {
    //   await this.publisher.publish(download.asset, download.metadata, options);
    //   this.logger.info('Successfully published story to Telegram', {
    //     mediaId: download.metadata.id,
    //     localPath: download.asset.localPath,
    //   });
    // } finally {
    //   await this.safeCleanup(download.asset.localPath);
    // }
  }

  private async sendPreview(
    asset: MediaAsset,
    metadata: InstagramMediaMetadata,
    caption?: string
  ) {
    try {
      await this.previewSender.sendPreview(asset, metadata, caption);
    } catch (error) {
      this.logger.warn("Failed to deliver preview to review chat", { error });
    }
  }

  private validate(url: string) {
    try {
      const parsed = new URL(url);
      if (!/instagram\.com$/i.test(parsed.hostname)) {
        throw new Error("Only instagram.com URLs are supported");
      }
    } catch (error) {
      throw new Error("Invalid Instagram URL");
    }
  }

  private async safeCleanup(path: string) {
    try {
      await this.storage.delete(path);
    } catch (error) {
      this.logger.warn("Failed to cleanup temporary file", { path, error });
    }
  }
}
