import { promises as fsPromises, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { FileStorage } from '../../application/ports/file-storage';
import { MediaAsset, MediaKind } from '../../domain/entities/media-asset';

export class NodeFileStorage implements FileStorage {
  constructor(private readonly baseDir: string = path.join(os.tmpdir(), 'insta-story-cache')) {}

  async createTempFile(kind: MediaKind, extension: string): Promise<string> {
    await fsPromises.mkdir(this.baseDir, { recursive: true });
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;
    const fileName = `${kind}-${Date.now()}-${randomBytes(4).toString('hex')}${normalizedExt}`;
    return path.join(this.baseDir, fileName);
  }

  async persist(remoteUrl: string, targetPath: string): Promise<MediaAsset> {
    await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });

    const response = await axios.get(remoteUrl, { responseType: 'stream' });
    const mimeType = response.headers['content-type'] ?? 'application/octet-stream';
    const kind: MediaKind = mimeType.startsWith('image') ? 'image' : 'video';

    const writeStream = createWriteStream(targetPath);
    await pipeline(response.data, writeStream);

    const stats = await fsPromises.stat(targetPath);

    return {
      sourceUrl: remoteUrl,
      kind,
      localPath: targetPath,
      fileName: path.basename(targetPath),
      mimeType,
      byteSize: stats.size,
    };
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fsPromises.unlink(filePath);
    } catch (error: any) {
      if (error && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }
}
