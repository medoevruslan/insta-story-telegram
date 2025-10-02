import fs from "fs";
import { Telegram } from "telegraf";
import { TelegramPreviewSender } from "../../application/ports/telegram-preview-sender";
import { MediaAsset } from "../../domain/entities/media-asset";
import { InstagramMediaMetadata } from "../../domain/entities/instagram-media";
import { Logger } from "../../application/ports/logger";

export class BotApiPreviewSender implements TelegramPreviewSender {
  constructor(
    private readonly telegram: Telegram,
    private readonly targetChatId: string,
    private readonly logger: Logger
  ) {}

  async sendPreview(
    media: MediaAsset,
    metadata: InstagramMediaMetadata,
    caption?: string
  ): Promise<void> {
    const combinedCaption = caption ?? metadata.caption ?? "";

    if (media.kind === "video") {
      await this.telegram.sendVideo(
        this.targetChatId,
        { source: fs.createReadStream(media.localPath) },
        {
          caption: combinedCaption,
          supports_streaming: true,
        }
      );
    } else {
      await this.telegram.sendPhoto(
        this.targetChatId,
        { source: fs.createReadStream(media.localPath) },
        {
          caption: combinedCaption,
        }
      );
    }

    this.logger.info("Delivered preview to review chat", {
      targetChatId: this.targetChatId,
    });
  }
}
