import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';

// Keeps all the azure code in one place so the rest of the app doesn't
// touch the SDK. The container name comes from env so testing can use a
// separate container from the real one.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly container: ContainerClient;
  private readonly logger = new Logger(StorageService.name);

  constructor(configService: ConfigService) {
    const client = BlobServiceClient.fromConnectionString(
      configService.getOrThrow<string>('AZURE_STORAGE_CONNECTION_STRING'),
    );
    this.container = client.getContainerClient(
      configService.get<string>('AZURE_STORAGE_CONTAINER') ?? 'stories',
    );
  }

  // runs on startup, makes the container if it doesn't exist yet
  async onModuleInit() {
    await this.container.createIfNotExists();
  }

  // uploads a file and returns its url
  // uploading to a name that already exists just replaces the old file
  async upload(
    name: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    const blob = this.container.getBlockBlobClient(name);
    await blob.uploadData(content, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return blob.url;
  }

  // returns the file contents
  // loads the whole file into memory, fine for small text files but
  // would need streaming if we ever allow big uploads
  async download(name: string): Promise<Buffer> {
    return await this.container.getBlockBlobClient(name).downloadToBuffer();
  }

  // deletes a file, returns nothing
  // a file that's already gone is fine (e.g. a story that never had a draft).
  // any other error (network, expired key) is logged instead of thrown, so
  // the story delete that called this still succeeds, but the leftover file
  // shows up in the logs and can be cleaned up by hand
  async delete(name: string): Promise<void> {
    try {
      await this.container.getBlockBlobClient(name).deleteIfExists();
    } catch (error) {
      this.logger.error(
        `Couldn't delete ${name}, it's been left in storage`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
