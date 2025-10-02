import { MediaAsset, MediaKind } from "../../domain/entities/media-asset";

export interface FileStorage {
  createTempFile(kind: MediaKind, extension: string): Promise<string>;
  persist(remoteUrl: string, targetPath: string): Promise<MediaAsset>;
  delete(path: string): Promise<void>;
}
