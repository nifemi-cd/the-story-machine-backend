import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service.js';

// hoisted so the vi.mock below (which runs before the imports) can use it
const { fromConnectionString } = vi.hoisted(() => ({
  fromConnectionString: vi.fn(),
}));

// swap the azure client for a mock so these tests never call azure
vi.mock('@azure/storage-blob', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@azure/storage-blob')>()),
  BlobServiceClient: { fromConnectionString },
}));

describe('StorageService', () => {
  // the parts of the azure sdk the service uses
  const blob = {
    url: 'https://account.blob.core.windows.net/stories/drafts/1.txt',
    uploadData: vi.fn(),
    downloadToBuffer: vi.fn(),
    deleteIfExists: vi.fn(),
  };
  const container = {
    createIfNotExists: vi.fn(),
    getBlockBlobClient: vi.fn(() => blob),
  };
  const client = { getContainerClient: vi.fn(() => container) };

  // env values the service reads, change per test as needed
  let env: Record<string, string | undefined>;
  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      if (env[key] === undefined) throw new Error(`${key} is missing`);
      return env[key];
    },
  } as unknown as ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    fromConnectionString.mockReturnValue(client);
    env = { AZURE_STORAGE_CONNECTION_STRING: 'connection-string' };
  });

  describe('setup', () => {
    it('connects with the connection string and uses the stories container by default', () => {
      new StorageService(config);

      expect(fromConnectionString).toHaveBeenCalledWith('connection-string');
      expect(client.getContainerClient).toHaveBeenCalledWith('stories');
    });

    it('uses the container from AZURE_STORAGE_CONTAINER when set', () => {
      env.AZURE_STORAGE_CONTAINER = 'test-stories';

      new StorageService(config);

      expect(client.getContainerClient).toHaveBeenCalledWith('test-stories');
    });

    it('fails to start without a connection string', () => {
      env = {};

      expect(() => new StorageService(config)).toThrow(
        'AZURE_STORAGE_CONNECTION_STRING is missing',
      );
    });

    it('creates the container on startup if it does not exist', async () => {
      await new StorageService(config).onModuleInit();

      expect(container.createIfNotExists).toHaveBeenCalled();
    });
  });

  it('uploads a file with its content type and returns its url', async () => {
    const content = Buffer.from('Once upon a time');

    const url = await new StorageService(config).upload(
      'drafts/1.txt',
      content,
      'text/plain; charset=utf-8',
    );

    expect(container.getBlockBlobClient).toHaveBeenCalledWith('drafts/1.txt');
    expect(blob.uploadData).toHaveBeenCalledWith(content, {
      blobHTTPHeaders: { blobContentType: 'text/plain; charset=utf-8' },
    });
    expect(url).toBe(blob.url);
  });

  it('downloads a file', async () => {
    const content = Buffer.from('Once upon a time');
    blob.downloadToBuffer.mockResolvedValue(content);

    await expect(
      new StorageService(config).download('drafts/1.txt'),
    ).resolves.toBe(content);
    expect(container.getBlockBlobClient).toHaveBeenCalledWith('drafts/1.txt');
  });

  describe('delete', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    it('deletes the file', async () => {
      blob.deleteIfExists.mockResolvedValue({ succeeded: true });

      await new StorageService(config).delete('drafts/1.txt');

      expect(container.getBlockBlobClient).toHaveBeenCalledWith('drafts/1.txt');
      expect(blob.deleteIfExists).toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
    });

    it('does nothing for a file that is already gone', async () => {
      // azure reports a missing file as succeeded: false, not an error
      blob.deleteIfExists.mockResolvedValue({ succeeded: false });

      await expect(
        new StorageService(config).delete('drafts/1.txt'),
      ).resolves.toBeUndefined();
      expect(logError).not.toHaveBeenCalled();
    });

    it('logs other errors instead of throwing, naming the file left behind', async () => {
      blob.deleteIfExists.mockRejectedValue(
        new Error('Server failed to authenticate'),
      );

      await expect(
        new StorageService(config).delete('drafts/1.txt'),
      ).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(
        "Couldn't delete drafts/1.txt, it's been left in storage",
        expect.stringContaining('Server failed to authenticate'),
      );
    });
  });
});
