import type { AdminProductImage } from './types';

// Future storage adapter must validate content server-side and return stored URLs.
// Data URLs here are local previews only; nothing is uploaded.
export async function previewAdminImages(files: File[]): Promise<AdminProductImage[]> {
  if (files.some(f => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024)) throw new Error('Choose PNG, JPEG, or WebP images up to 5 MB each.');
  return Promise.all(files.map(file => new Promise<AdminProductImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.onload = () => { const image = new Image(); image.onerror = () => reject(new Error('This file is not a readable image.')); image.onload = () => resolve({ id: crypto.randomUUID(), src: String(reader.result), alt: file.name, group: 'General Gallery' }); image.src = String(reader.result); };
    reader.readAsDataURL(file);
  })));
}
