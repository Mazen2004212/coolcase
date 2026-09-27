'use client';

import { useState, useRef, useTransition } from 'react';
import Image from 'next/image';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { uploadProductImage, deleteProductImage, updateImageMetadata } from '@/app/admin/actions/products';
import { Confirm } from './admin-ui';
import { preprocessClientImage } from '@/lib/images/client-preprocess';
import { resolvePublicMediaUrl } from '@/lib/storage/public-media-core';

export type LiveImage = {
  id: string;
  storagePath: string;
  src: string;
  alt: string;
  isPrimary: boolean;
  displayOrder: number;
};

type Props = {
  productId: string;
  initialImages: LiveImage[];
};

export function ImageManagerLive({ productId, initialImages }: Props) {
  const [images, setImages] = useState<LiveImage[]>(
    [...initialImages].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.displayOrder - b.displayOrder;
    })
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) return;
    setError('');
    if (files.length + images.length > 12) {
      setError('You can have at most 12 images per product.');
      return;
    }
    setBusy(true);
    try {
      for (const file of files) {
        const processed = await preprocessClientImage(file, 'product');
        const fd = new FormData();
        fd.append('file', processed);
        const result = await uploadProductImage(productId, fd);
        if ('error' in result) { setError(result.error); break; }
        // Derive public URL
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const newImage: LiveImage = {
          id:           result.imageId,
          storagePath:  result.storagePath,
          src:          resolvePublicMediaUrl(result.storagePath, supabaseUrl),
          alt:          file.name.replace(/\.[^.]+$/, ''),
          isPrimary:    images.length === 0,
          displayOrder: images.length,
        };
        setImages(prev => [...prev, newImage]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'This image could not be prepared for upload.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(imageId: string, storagePath: string) {
    setBusy(true);
    const result = await deleteProductImage(imageId, storagePath);
    setBusy(false);
    setRemoving(null);
    if (result.error) { setError(result.error); return; }
    const next = images.filter(img => img.id !== imageId);
    // If we removed the primary, make first remaining primary
    if (next.length > 0 && !next.some(img => img.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    setImages(next);
  }

  async function handleSetCover(imageId: string) {
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    setBusy(true);
    const result = await updateImageMetadata(imageId, image.alt, 0, true, productId);
    setBusy(false);
    if (result.error) { setError(result.error); return; }
    // Update all others to non-primary in DB (server action handles this already)
    setImages(prev => prev.map((img, i) => ({ ...img, isPrimary: img.id === imageId, displayOrder: i })));
  }

  async function handleAltUpdate(imageId: string, alt: string) {
    const image = images.find(img => img.id === imageId);
    if (!image) return;
    startTransition(async () => {
      await updateImageMetadata(imageId, alt, image.displayOrder, image.isPrimary, productId);
    });
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, alt } : img));
  }

  async function handleMove(index: number, to: number) {
    const next = [...images];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    const reordered = next.map((img, i) => ({ ...img, displayOrder: i }));
    setImages(reordered);
    // Persist reorder in background
    setBusy(true);
    for (const img of reordered) {
      await updateImageMetadata(img.id, img.alt, img.displayOrder, img.isPrimary, productId);
    }
    setBusy(false);
  }

  const removeTarget = images.find(img => img.id === removing);

  return (
    <>
      <FileUploadField label={busy ? 'Uploading…' : 'Add images'} guidance="PNG, JPEG, WebP or AVIF · optimized to 1.5 MB or less · 12 maximum" inputRef={inputRef} accept="image/png,image/jpeg,image/webp,image/avif" multiple disabled={busy} error={error || undefined} onChange={handleFileChange} />
      {busy && <p role="status" style={{ color: 'var(--muted)' }}>Working…</p>}
      <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
        Images upload immediately to the configured public media storage. The first image marked as cover appears on the storefront.
      </p>
      <div className="ad-image-grid">
        {images.map((image, i) => (
          <article key={image.id}>
            <div className="ad-image-preview">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="220px"
                unoptimized={false}
              />
              {image.isPrimary && (
                <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--accent)', color: '#fff', fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cover</span>
              )}
            </div>
            <strong>{i + 1} · {image.isPrimary ? 'Cover' : 'Gallery'}</strong>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: 4 }}>
                Alt text
                <input
                  style={{ width: '100%', marginTop: 2 }}
                  value={image.alt}
                  onChange={e => handleAltUpdate(image.id, e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="ad-actions" style={{ marginTop: 8 }}>
              <button type="button" disabled={image.isPrimary || busy} onClick={() => handleSetCover(image.id)}>Set cover</button>
              <button type="button" disabled={i === 0 || busy} aria-label="Move earlier" onClick={() => handleMove(i, i - 1)}>Earlier</button>
              <button type="button" disabled={i === images.length - 1 || busy} aria-label="Move later" onClick={() => handleMove(i, i + 1)}>Later</button>
              <button type="button" disabled={busy} onClick={() => setRemoving(image.id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
      {removing && removeTarget && (
        <Confirm
          title="Remove this image?"
          close={() => setRemoving(null)}
          onConfirm={() => handleRemove(removeTarget.id, removeTarget.storagePath)}
        />
      )}
    </>
  );
}
