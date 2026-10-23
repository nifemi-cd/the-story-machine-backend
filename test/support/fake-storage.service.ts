import type { StorageService } from '../../src/storage/storage.service.js';

// keeps files in memory instead of azure so the e2e tests don't need
// secrets or internet and don't leave files behind
export class FakeStorageService implements Pick<
  StorageService,
  'upload' | 'download' | 'delete'
> {
  // tests look in here to check what got uploaded
  readonly files = new Map<string, Buffer>();

  // saves the file in memory and returns a fake url
  upload(name: string, content: Buffer): Promise<string> {
    this.files.set(name, content);
    return Promise.resolve(`https://fake.blob.local/stories/${name}`);
  }

  // returns the file, or rejects if it isn't there
  download(name: string): Promise<Buffer> {
    const content = this.files.get(name);
    // the real one throws too when the file doesn't exist
    return content
      ? Promise.resolve(content)
      : Promise.reject(new Error(`No file named ${name}`));
  }

  // removes the file from memory
  delete(name: string): Promise<void> {
    this.files.delete(name);
    return Promise.resolve();
  }
}
