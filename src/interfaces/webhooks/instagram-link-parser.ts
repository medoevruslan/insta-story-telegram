import { InstagramMediaType } from '../../domain/entities/instagram-media';

const INSTAGRAM_URL_REGEX = /(https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._/?=&%-]+)/i;

export const extractInstagramUrl = (text?: string): string | undefined => {
  if (!text) {
    return undefined;
  }
  const match = text.match(INSTAGRAM_URL_REGEX);
  return match ? match[1] : undefined;
};

export const inferMediaType = (url: string): InstagramMediaType => {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (segments.includes('stories') || segments.includes('s')) {
    return 'story';
  }
  if (segments.includes('reel') || segments.includes('reels')) {
    return 'reel';
  }
  return 'reel';
};
