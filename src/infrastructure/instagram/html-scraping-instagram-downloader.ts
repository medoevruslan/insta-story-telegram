import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { FileStorage } from "../../application/ports/file-storage";
import {
  InstagramMediaDownloader,
  InstagramMediaDownloadResult,
} from "../../application/ports/instagram-media-downloader";
import {
  InstagramMediaRequest,
  InstagramMediaMetadata,
} from "../../domain/entities/instagram-media";
import { MediaAsset, MediaKind } from "../../domain/entities/media-asset";
import { InstagramConfig } from "../../config/env";
import { Logger } from "../../application/ports/logger";

// Despite the legacy class name, this adapter now shells out to yt-dlp to obtain and download
// Instagram media. Keeping the name maintains wiring compatibility while the rest of the
// project evolves.
const execFileAsync = promisify(execFile);
const MAX_BUFFER = 25 * 1024 * 1024; // 25 MB

interface YtDlpMetadata {
  id: string;
  title?: string;
  description?: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  timestamp?: number;
  upload_date?: string;
  ext?: string;
  requested_downloads?: Array<{ ext?: string; vcodec?: string }>;
  thumbnails?: Array<{ url: string }>;
  webpage_url?: string;
  original_url?: string;
  entries?: YtDlpMetadata[];
}

export class HtmlScrapingInstagramDownloader
  implements InstagramMediaDownloader
{
  constructor(
    private readonly storage: FileStorage,
    private readonly logger: Logger,
    private readonly config: InstagramConfig
  ) {}

  async download(
    request: InstagramMediaRequest
  ): Promise<InstagramMediaDownloadResult> {
    const metadata = await this.fetchMetadata(request.url);
    const flattened = this.flattenMetadata(metadata);
    const kind = this.inferKind(flattened);
    const extension = this.resolveExtension(flattened, kind);

    const tempPath = await this.storage.createTempFile(kind, extension);
    const resolvedPath = await this.downloadMedia(
      request.url,
      tempPath,
      extension
    );

    const actualExtension =
      path.extname(resolvedPath).replace(/^\./, "") || extension;

    const asset = await this.createAsset(
      request.url,
      resolvedPath,
      kind,
      actualExtension
    );
    const instagramMetadata = this.mapMetadata(flattened, request.url);

    return { asset, metadata: instagramMetadata };
  }

  private async fetchMetadata(url: string): Promise<YtDlpMetadata> {
    const binary = this.config.ytDlpBinary ?? "yt-dlp";
    this.logger.debug("Probing Instagram media via yt-dlp", { url, binary });

    const args = this.buildCommonArgs([
      "--dump-json",
      "--no-warnings",
      "-f",
      "bestvideo*+bestaudio/best",
      url,
    ]);

    try {
      const { stdout } = await execFileAsync(binary, args, {
        maxBuffer: MAX_BUFFER,
      });
      return JSON.parse(stdout) as YtDlpMetadata;
    } catch (error: any) {
      this.logger.error("yt-dlp metadata extraction failed", { error });
      throw new Error(
        `Failed to extract Instagram media metadata using yt-dlp: ${
          error?.message ?? error
        }`
      );
    }
  }

  private flattenMetadata(raw: YtDlpMetadata): YtDlpMetadata {
    if (!raw) {
      throw new Error("yt-dlp returned no metadata for Instagram media");
    }

    if (Array.isArray(raw.entries) && raw.entries.length > 0) {
      return this.flattenMetadata(raw.entries[0]);
    }

    return raw;
  }

  private inferKind(info: YtDlpMetadata): MediaKind {
    const extension = this.resolveExtension(info, "video");
    if (["jpg", "jpeg", "png", "webp"].includes(extension.toLowerCase())) {
      return "image";
    }
    return "video";
  }

  private resolveExtension(
    info: YtDlpMetadata,
    fallbackKind: MediaKind
  ): string {
    const extFromRequested = info.requested_downloads?.[0]?.ext;
    const extension = info.ext ?? extFromRequested;
    if (extension) {
      return extension;
    }
    return fallbackKind === "video" ? "mp4" : "jpg";
  }

  private async downloadMedia(
    url: string,
    targetPath: string,
    expectedExtension: string
  ): Promise<string> {
    const binary = this.config.ytDlpBinary ?? "yt-dlp";
    this.logger.debug("Downloading Instagram media via yt-dlp", {
      url,
      targetPath,
    });

    const parsed = path.parse(targetPath);
    const outputTemplate = path.join(parsed.dir, parsed.name);

    const args = this.buildCommonArgs([
      "--no-warnings",
      "--quiet",
      "--no-part",
      "--no-mtime",
      "--force-overwrites",
      "-o",
      `${outputTemplate}.%(ext)s`,
      url,
    ]);

    try {
      await execFileAsync(binary, args, { maxBuffer: MAX_BUFFER });
    } catch (error: any) {
      this.logger.error("yt-dlp media download failed", { error });
      throw new Error(
        `Failed to download Instagram media using yt-dlp: ${
          error?.message ?? error
        }`
      );
    }

    return this.ensureDownloadedFile(
      targetPath,
      outputTemplate,
      expectedExtension
    );
  }

  private buildCommonArgs(initial: string[]): string[] {
    const args = [...initial];
    const insertIndex = Math.max(args.length - 1, 0);

    const cookieArgs = this.buildCookieArgs();
    if (cookieArgs.length > 0) {
      args.splice(insertIndex, 0, ...cookieArgs);
    }

    return args;
  }

  private buildCookieArgs(): string[] {
    if (this.config.sessionId) {
      return ["--add-header", `Cookie: sessionid=${this.config.sessionId}`];
    }

    if (this.config.ytDlpCookiesFromBrowser) {
      return ["--cookies-from-browser", this.config.ytDlpCookiesFromBrowser];
    }

    if (this.config.ytDlpCookiesFile) {
      return ["--cookies", this.config.ytDlpCookiesFile];
    }

    return [];
  }

  private async ensureDownloadedFile(
    targetPath: string,
    outputTemplate: string,
    expectedExtension: string
  ): Promise<string> {
    const normalizedExt = expectedExtension.replace(/^\./, "");

    const candidatePaths = [
      targetPath,
      `${outputTemplate}.${normalizedExt}`,
      `${outputTemplate}.${normalizedExt.toLowerCase()}`,
      `${targetPath}.${normalizedExt}`,
      `${targetPath}.${normalizedExt.toLowerCase()}`,
    ];

    for (const candidate of candidatePaths) {
      const resolved = await this.tryResolveCandidate(candidate);
      if (resolved) {
        if (resolved !== targetPath) {
          await fs.rename(resolved, targetPath);
        }
        return targetPath;
      }
    }

    const parsed = path.parse(targetPath);
    try {
      const entries = await fs.readdir(parsed.dir);
      const match = entries
        .filter((entry) => entry.startsWith(parsed.name))
        .map((entry) => path.join(parsed.dir, entry))[0];

      if (match) {
        await fs.rename(match, targetPath);
        return targetPath;
      }
    } catch (error: any) {
      this.logger.warn("Failed to inspect download directory", {
        error,
        directory: parsed.dir,
      });
    }

    throw new Error(
      `yt-dlp did not produce a file at the expected path ${targetPath}`
    );
  }

  private async tryResolveCandidate(candidate: string): Promise<string | null> {
    try {
      await fs.stat(candidate);
      return candidate;
    } catch (error: any) {
      if (error?.code && error.code !== "ENOENT") {
        this.logger.warn("Unexpected error while probing candidate file", {
          error,
          candidate,
        });
      }
      return null;
    }
  }

  private async createAsset(
    sourceUrl: string,
    targetPath: string,
    kind: MediaKind,
    extension: string
  ): Promise<MediaAsset> {
    const stats = await fs.stat(targetPath);
    const mimeType = this.resolveMimeType(extension, kind);

    return {
      sourceUrl,
      kind,
      localPath: targetPath,
      fileName: path.basename(targetPath),
      mimeType,
      byteSize: stats.size,
    };
  }

  private resolveMimeType(extension: string, kind: MediaKind): string {
    const ext = extension.toLowerCase();
    if (kind === "image") {
      switch (ext) {
        case "jpg":
        case "jpeg":
          return "image/jpeg";
        case "png":
          return "image/png";
        case "webp":
          return "image/webp";
        default:
          return "image/jpeg";
      }
    }

    switch (ext) {
      case "mp4":
        return "video/mp4";
      case "mov":
        return "video/quicktime";
      case "webm":
        return "video/webm";
      default:
        return "video/mp4";
    }
  }

  private mapMetadata(
    info: YtDlpMetadata,
    requestUrl: string
  ): InstagramMediaMetadata {
    const id = info.id ?? this.extractIdFromUrl(requestUrl);
    const takenAt = this.resolveTimestamp(info);

    return {
      id,
      caption: info.title ?? info.description,
      ownerUsername: info.uploader_id ?? info.uploader,
      takenAt,
    };
  }

  private resolveTimestamp(info: YtDlpMetadata): Date | undefined {
    if (info.timestamp) {
      return new Date(info.timestamp * 1000);
    }

    if (info.upload_date) {
      const iso = `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(
        4,
        6
      )}-${info.upload_date.slice(6, 8)}`;
      return new Date(iso);
    }

    return undefined;
  }

  private extractIdFromUrl(url: string): string {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, "").replace(/\//g, "_");
  }
}
