import { InstagramMediaMetadata } from "../../domain/entities/instagram-media";
import { MediaAsset } from "../../domain/entities/media-asset";

export interface TelegramPreviewSender {
  sendPreview(
    media: MediaAsset,
    metadata: InstagramMediaMetadata,
    caption?: string
  ): Promise<void>;
}
