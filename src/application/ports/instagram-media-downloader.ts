import { InstagramMediaRequest, InstagramMediaMetadata } from '../../domain/entities/instagram-media';
import { MediaAsset } from '../../domain/entities/media-asset';

export interface InstagramMediaDownloadResult {
  asset: MediaAsset;
  metadata: InstagramMediaMetadata;
}

export interface InstagramMediaDownloader {
  download(request: InstagramMediaRequest): Promise<InstagramMediaDownloadResult>;
}
