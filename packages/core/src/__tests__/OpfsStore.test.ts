import { describe, expect, it } from 'vitest';
import OpfsStore, { InMemoryOpfsBackend, ZipitQuotaError } from '../storage/OpfsStore';

class QuotaBackend extends InMemoryOpfsBackend {
  override async write(): Promise<void> {
    throw new DOMException('quota reached', 'QuotaExceededError');
  }
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

describe('OpfsStore', () => {
  it('writes chunks at offsets and reads the partial file', async () => {
    const store = OpfsStore.fromBackend('session-1', new InMemoryOpfsBackend());

    await store.writeChunk('file-1', 0, new Uint8Array([1, 2]));
    await store.writeChunk('file-1', 2, new Uint8Array([3, 4]));

    await expect(store.getDownloadedBytes('file-1')).resolves.toBe(4);
    await expect(streamToBytes(await store.readFile('file-1'))).resolves.toEqual(
      new Uint8Array([1, 2, 3, 4])
    );
  });

  it('checks existence and deletes files', async () => {
    const store = OpfsStore.fromBackend('session-1', new InMemoryOpfsBackend());
    await store.writeChunk('file-1', 0, new Uint8Array([1]));

    await expect(store.exists('file-1')).resolves.toBe(true);
    await store.deleteFile('file-1');
    await expect(store.exists('file-1')).resolves.toBe(false);
  });

  it('deletes a full session prefix', async () => {
    const backend = new InMemoryOpfsBackend();
    const store = OpfsStore.fromBackend('session-1', backend);
    await store.writeChunk('file-1', 0, new Uint8Array([1]));

    await store.deleteSession('session-1');

    await expect(store.exists('file-1')).resolves.toBe(false);
  });

  it('normalizes quota errors', async () => {
    const store = OpfsStore.fromBackend('session-1', new QuotaBackend());

    await expect(store.writeChunk('file-1', 0, new Uint8Array([1]))).rejects.toBeInstanceOf(
      ZipitQuotaError
    );
  });
});
