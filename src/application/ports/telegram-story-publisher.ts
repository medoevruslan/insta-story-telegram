import { InstagramMediaMetadata } from '../../domain/entities/instagram-media';
import { MediaAsset } from '../../domain/entities/media-asset';

export interface PublishStoryOptions {
  caption?: string;
  expiresInSeconds?: number;
}

export interface TelegramStoryPublisher {
  publish(media: MediaAsset, metadata: InstagramMediaMetadata, options?: PublishStoryOptions): Promise<void>;
}
