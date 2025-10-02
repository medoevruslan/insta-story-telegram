import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { CustomFile } from 'telegram/client/uploads';
import { TelegramStoryPublisher, PublishStoryOptions } from '../../application/ports/telegram-story-publisher';
import { MediaAsset } from '../../domain/entities/media-asset';
import { InstagramMediaMetadata } from '../../domain/entities/instagram-media';
import { Logger } from '../../application/ports/logger';

export interface MtProtoCredentials {
  appId: number;
  appHash: string;
  botPhone: string;
  session: string;
}

export class MtProtoStoryPublisher implements TelegramStoryPublisher {
  private constructor(private readonly client: TelegramClient, private readonly logger: Logger) {}

  static async initialize(creds: MtProtoCredentials, logger: Logger): Promise<MtProtoStoryPublisher> {
    const session = new StringSession(creds.session);
    const client = new TelegramClient(session, creds.appId, creds.appHash, {
      connectionRetries: 5,
    });

    await client.connect();

    if (!client.connected) {
      // Require pre-authenticated session to avoid interactive login.
      await client.start({
        phoneNumber: async () => creds.botPhone,
        phoneCode: async () => {
          throw new Error('Interactive MTProto login is not supported in this environment. Generate a session string offline.');
        },
        onError: (err) => logger.error('MTProto login error', err),
      });
    }

    return new MtProtoStoryPublisher(client, logger);
  }

  async publish(media: MediaAsset, metadata: InstagramMediaMetadata, options?: PublishStoryOptions): Promise<void> {
    const caption = options?.caption ?? metadata.caption ?? '';

    this.logger.debug('Uploading media through MTProto', { media: media.fileName });
    const uploadSource = new CustomFile(media.fileName, media.byteSize, media.localPath);

    const uploaded = await this.client.uploadFile({
      file: uploadSource,
      workers: 1,
    });

    const mediaInput =
      media.kind === 'video'
        ? new Api.InputMediaUploadedDocument({
            file: uploaded,
            mimeType: media.mimeType,
            attributes: [
              new Api.DocumentAttributeVideo({
                duration: 0,
                w: 0,
                h: 0,
                supportsStreaming: true,
              }),
            ],
          })
        : new Api.InputMediaUploadedPhoto({ file: uploaded });

    await this.client.invoke(
      new Api.stories.SendStory({
        peer: new Api.InputPeerSelf(),
        media: mediaInput,
        caption,
        period: options?.expiresInSeconds,
        privacyRules: [new Api.InputPrivacyValueAllowAll()],
      }),
    );

    this.logger.info('Published Telegram story through MTProto');
  }
}
