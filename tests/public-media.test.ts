import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPublicMediaStore,
  parsePublicMediaBackend,
  resolvePublicMediaUrl,
  type PublicMediaDriver,
} from '../lib/storage/public-media-core';

function mockDriver(calls: string[]): PublicMediaDriver {
  return {
    async put(key) { calls.push(`put:${key}`); },
    async delete(key) { calls.push(`delete:${key}`); },
  };
}

test('backend selection defaults to Supabase and rejects invalid values', () => {
  assert.equal(parsePublicMediaBackend(undefined), 'supabase');
  assert.equal(parsePublicMediaBackend(' S3 '), 's3');
  assert.throws(() => parsePublicMediaBackend('filesystem'));
});

test('S3 upload generates an immutable relative media path', async () => {
  const supabaseCalls: string[] = [];
  const s3Calls: string[] = [];
  const store = createPublicMediaStore('s3', {
    supabase: mockDriver(supabaseCalls),
    s3: mockDriver(s3Calls),
  }, () => 'fixed-id');

  const path = await store.upload('products', 'products/product-id', {
    bytes: new Uint8Array([1]), contentType: 'image/webp', extension: 'webp',
  });

  assert.equal(path, '/media/products/fixed-id.webp');
  assert.deepEqual(s3Calls, ['put:media/products/fixed-id.webp']);
  assert.deepEqual(supabaseCalls, []);
});

test('Supabase upload preserves the historical storage-path model', async () => {
  const calls: string[] = [];
  const store = createPublicMediaStore('supabase', {
    supabase: mockDriver(calls), s3: mockDriver([]),
  }, () => 'fixed-id');

  const path = await store.upload('products', 'products/product-id', {
    bytes: new Uint8Array([1]), contentType: 'image/webp', extension: 'webp',
  });

  assert.equal(path, 'products/product-id/fixed-id.webp');
  assert.deepEqual(calls, ['put:products/product-id/fixed-id.webp']);
});

test('collection banners use the shared public-media pipeline', async () => {
  const calls: string[] = [];
  const store = createPublicMediaStore('s3', {
    supabase: mockDriver([]), s3: mockDriver(calls),
  }, () => 'collection-id');
  const path = await store.upload('collections', 'collections/source-id', {
    bytes: new Uint8Array([1]), contentType: 'image/webp', extension: 'webp',
  });
  assert.equal(path, '/media/collections/collection-id.webp');
  assert.deepEqual(calls, ['put:media/collections/collection-id.webp']);
});

test('delete routing follows the stored path, not the current backend', async () => {
  const supabaseCalls: string[] = [];
  const s3Calls: string[] = [];
  const store = createPublicMediaStore('s3', {
    supabase: mockDriver(supabaseCalls), s3: mockDriver(s3Calls),
  });

  await store.delete('/media/products/new.webp');
  await store.delete('products/legacy.webp');
  await store.delete('https://example.supabase.co/storage/v1/object/public/product-assets/already-absolute.webp');

  assert.deepEqual(s3Calls, ['delete:media/products/new.webp']);
  assert.deepEqual(supabaseCalls, ['delete:products/legacy.webp', 'delete:already-absolute.webp']);
});

test('URL resolution supports S3 relative, local, absolute, and historical Supabase paths', () => {
  const base = 'https://example.supabase.co';
  assert.equal(resolvePublicMediaUrl('/media/products/new.webp', base), '/media/products/new.webp');
  assert.equal(resolvePublicMediaUrl('/assets/example.png', base), '/assets/example.png');
  assert.equal(resolvePublicMediaUrl('https://cdn.example.com/image.webp', base), 'https://cdn.example.com/image.webp');
  assert.equal(
    resolvePublicMediaUrl('products/legacy.webp', base),
    'https://example.supabase.co/storage/v1/object/public/product-assets/products/legacy.webp',
  );
});
