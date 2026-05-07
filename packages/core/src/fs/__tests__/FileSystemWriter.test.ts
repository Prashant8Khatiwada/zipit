import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobFileSystemWriter, FileSystemWriter } from '../FileSystemWriter';

describe('FileSystemWriter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports native support only when the picker exists', () => {
    expect(FileSystemWriter.isSupported()).toBe(false);
  });

  it('accumulates bytes in the blob fallback writer', async () => {
    const createObjectURL = vi.fn(() => 'blob:zipit-test');
    const revokeObjectURL = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });

    const writer = new BlobFileSystemWriter('archive.zip');
    await writer.write(new Uint8Array([1, 2, 3]));
    await writer.close();

    expect(writer.getBytesWritten()).toBe(3);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });
});
