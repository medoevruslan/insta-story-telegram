export type InstagramMediaType = 'reel' | 'story';

export interface InstagramMediaRequest {
  url: string;
  type: InstagramMediaType;
}

export interface InstagramMediaMetadata {
  id: string;
  caption?: string;
  ownerUsername?: string;
  takenAt?: Date;
}
