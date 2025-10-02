export type MediaKind = 'video' | 'image';

export interface MediaAsset {
  sourceUrl: string;
  kind: MediaKind;
  localPath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}
