import { describe, it, expect } from 'vitest';
import {
  filenameFromUrl,
  idFromUrl,
  formatBytes,
  formatEta,
} from '../../src/utils/helpers';

// ─── filenameFromUrl ──────────────────────────────────────────────────────────
describe('filenameFromUrl', () => {
  it('extracts filename from simple URL', () => {
    expect(filenameFromUrl('https://cdn.example.com/photos/img_001.jpg')).toBe('img_001.jpg');
  });

  it('strips query params from URL', () => {
    expect(
      filenameFromUrl('https://s3.amazonaws.com/bucket/photo.jpg?X-Amz-Expires=3600&X-Amz-Credential=...')
    ).toBe('photo.jpg');
  });

  it('decodes URI-encoded characters', () => {
    expect(filenameFromUrl('https://cdn.example.com/my%20photo%20album.jpg')).toBe('my photo album.jpg');
  });

  it('falls back to download- prefix for bare paths', () => {
    const result = filenameFromUrl('https://example.com/api/item');
    expect(result).toMatch(/^download-\d+$/);
  });

  it('handles invalid URLs gracefully', () => {
    const result = filenameFromUrl('not-a-url');
    expect(result).toMatch(/^download-\d+$/);
  });
});

// ─── idFromUrl ────────────────────────────────────────────────────────────────
describe('idFromUrl', () => {
  it('returns a consistent ID for the same URL', () => {
    const id1 = idFromUrl('https://example.com/photo.jpg');
    const id2 = idFromUrl('https://example.com/photo.jpg');
    expect(id1).toBe(id2);
  });

  it('returns different IDs for different URLs', () => {
    const id1 = idFromUrl('https://example.com/photo1.jpg');
    const id2 = idFromUrl('https://example.com/photo2.jpg');
    expect(id1).not.toBe(id2);
  });

  it('returns a non-empty string', () => {
    expect(idFromUrl('https://example.com/file')).toBeTruthy();
  });
});

// ─── formatBytes ──────────────────────────────────────────────────────────────
describe('formatBytes', () => {
  it('formats zero bytes', () => expect(formatBytes(0)).toBe('0 B'));
  it('formats bytes', () => expect(formatBytes(500)).toBe('500 B'));
  it('formats kilobytes', () => expect(formatBytes(1536)).toBe('1.5 KB'));
  it('formats megabytes', () => expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB'));
  it('formats gigabytes', () => expect(formatBytes(1024 ** 3)).toBe('1 GB'));
});

// ─── formatEta ────────────────────────────────────────────────────────────────
describe('formatEta', () => {
  it('shows em-dash for non-finite values', () => {
    expect(formatEta(Infinity)).toBe('—');
    expect(formatEta(-1)).toBe('—');
  });
  it('formats seconds', () => expect(formatEta(45)).toBe('45s'));
  it('formats minutes', () => expect(formatEta(90)).toBe('2m'));
  it('formats hours', () => expect(formatEta(3661)).toBe('1h 1m'));
});
