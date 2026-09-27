'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Search, Trash2, X } from 'lucide-react';
import { deleteCollection, saveCollection, type CollectionInput } from '@/app/admin/actions/collections';
import { preprocessClientImage, fileToDataUrl } from '@/lib/images/client-preprocess';
import { requirePermission } from '@/lib/admin/permissions';
import { useAdmin } from './admin-provider';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { ActionLink, ConfirmReal, Empty, PageHeading, Panel, Pill, Table, Thumb, Toggle } from './admin-ui';

export type AdminCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  collection_type: 'CUSTOM' | 'NEW_ARRIVALS';
  banner_image_url: string | null;
  banner_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  product_count?: number;
  product_ids?: string[];
};

export type CollectionProductOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function CollectionsListLive({ collections }: { collections: AdminCollection[] }) {
  const { staff } = useAdmin();
  const canManage = requirePermission(staff, 'products.manage');
  const [target, setTarget] = useState<AdminCollection | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete(collection: AdminCollection) {
    setBusy(true);
    const result = await deleteCollection(collection.id, collection.slug);
    setBusy(false);
    setTarget(null);
    setMessage(result.error ?? `${collection.name} was deleted.`);
    if (!result.error) router.refresh();
  }

  return (
    <>
      <PageHeading title="Collections" description="Organize products into curated storefront groups." action={canManage ? <ActionLink href="/admin/collections/new">Create Collection</ActionLink> : undefined} />
      {message ? <div className="ad-notice" role="status"><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setMessage('')}>×</button></div> : null}
      <Panel title={`${collections.length} collections`}>
        {collections.length ? (
          <Table headings={['Banner', 'Collection', 'Type', 'Products', 'Status', 'Featured', 'Order', 'Actions']}>
            {collections.map(collection => (
              <tr key={collection.id}>
                <td><Thumb src={collection.banner_url ?? undefined} alt={collection.name} /></td>
                <td><Link href={`/admin/collections/${collection.id}`}><strong>{collection.name}</strong><small>/{collection.slug}</small></Link></td>
                <td><Pill color={collection.collection_type === 'NEW_ARRIVALS' ? 'amber' : 'grey'}>{collection.collection_type === 'NEW_ARRIVALS' ? 'Preset' : 'Custom'}</Pill></td>
                <td>{collection.product_count ?? 0}</td>
                <td><Pill color={collection.is_active ? 'green' : 'grey'}>{collection.is_active ? 'Active' : 'Inactive'}</Pill></td>
                <td>{collection.is_featured ? 'Yes' : 'No'}</td>
                <td>{collection.sort_order}</td>
                <td><div className="ad-actions"><Link href={`/admin/collections/${collection.id}`}>{canManage ? 'Edit' : 'View'}</Link>{collection.is_active ? <Link href={`/collections/${collection.slug}`} target="_blank">View Storefront</Link> : null}{canManage ? <button type="button" disabled={busy} onClick={() => setTarget(collection)}>Delete</button> : null}</div></td>
              </tr>
            ))}
          </Table>
        ) : <Empty>No collections yet. Create the first curated storefront group.</Empty>}
      </Panel>
      {target ? <ConfirmReal title={`Delete ${target.name}?`} description={target.collection_type === 'NEW_ARRIVALS' ? 'Its memberships will be removed and every NEW ribbon will disappear. Products will not be deleted.' : 'Its memberships and banner will be removed. Products will not be deleted.'} confirmLabel="Delete collection" close={() => setTarget(null)} onConfirm={() => void handleDelete(target)} /> : null}
    </>
  );
}

export function CollectionEditorLive({ collection, products }: { collection: AdminCollection | null; products: CollectionProductOption[] }) {
  const { staff } = useAdmin();
  const canManage = requirePermission(staff, 'products.manage');
  const router = useRouter();
  const [name, setName] = useState(collection?.name ?? '');
  const [slug, setSlug] = useState(collection?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(collection));
  const [description, setDescription] = useState(collection?.description ?? '');
  const [collectionType, setCollectionType] = useState<'CUSTOM' | 'NEW_ARRIVALS'>(collection?.collection_type ?? 'CUSTOM');
  const [selectedIds, setSelectedIds] = useState(collection?.product_ids ?? []);
  const [isActive, setIsActive] = useState(collection?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(collection?.is_featured ?? false);
  const [sortOrder, setSortOrder] = useState(collection?.sort_order ?? 0);
  const [search, setSearch] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState(collection?.banner_url ?? '');
  const [removeBanner, setRemoveBanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const byId = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const selectedProducts = selectedIds.map(id => byId.get(id)).filter((item): item is CollectionProductOption => Boolean(item));
  const visibleProducts = products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()) || product.slug.includes(search.toLowerCase()));

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function selectType(value: 'CUSTOM' | 'NEW_ARRIVALS') {
    setCollectionType(value);
    if (value === 'NEW_ARRIVALS') {
      setName('New Arrivals');
      if (!collection || collection.collection_type !== 'NEW_ARRIVALS') {
        setSlug('new-arrivals');
        setSlugTouched(false);
      }
    }
  }

  function moveProduct(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setSelectedIds(next);
  }

  async function chooseBanner(file: File | undefined) {
    if (!file) return;
    setMessage('');
    try {
      const processed = await preprocessClientImage(file, 'product');
      setBannerFile(processed);
      setBannerPreview(await fileToDataUrl(processed));
      setRemoveBanner(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The banner could not be prepared.');
    }
  }

  async function submit() {
    if (!canManage || busy) return;
    if (!name.trim()) { setMessage('Collection name is required.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setMessage('Slug must use lowercase letters, numbers, and hyphens.'); return; }
    setBusy(true);
    setMessage('');
    const input: CollectionInput = {
      id: collection?.id ?? null, name: name.trim(), slug, description: description.trim(), collectionType,
      bannerImageUrl: collection?.banner_image_url ?? null, removeBanner, isActive, isFeatured,
      sortOrder: Math.max(0, sortOrder), productIds: selectedIds,
    };
    const formData = bannerFile ? new FormData() : undefined;
    if (bannerFile && formData) formData.set('file', bannerFile);
    const result = await saveCollection(input, formData);
    setBusy(false);
    if (result.error) { setMessage(result.error); return; }
    router.push('/admin/collections');
    router.refresh();
  }

  return (
    <>
      <PageHeading title={collection ? `Edit ${collection.name}` : 'Create Collection'} description="Curate a real product group for storefront discovery." />
      {message ? <p className={message.includes('saved') ? 'ad-notice' : 'ad-error'} role="status">{message}</p> : null}
      <div className="ad-editor ad-collection-editor">
        <div className="ad-stack">
          <Panel title="Collection details">
            <label className="ad-field">Collection Name<input value={name} disabled={!canManage || collectionType === 'NEW_ARRIVALS'} maxLength={120} onChange={event => updateName(event.target.value)} /></label>
            <label className="ad-field">Slug<input value={slug} disabled={!canManage} onChange={event => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
            <label className="ad-field">Description<textarea value={description} disabled={!canManage} maxLength={1200} rows={4} onChange={event => setDescription(event.target.value)} /></label>
          </Panel>
          <Panel title="Collection type">
            <div className="ad-collection-type-grid">
              <button type="button" aria-pressed={collectionType === 'CUSTOM'} disabled={!canManage || Boolean(collection)} onClick={() => selectType('CUSTOM')}><strong>Custom Collection</strong><span>Use any name and curated product mix.</span></button>
              <button type="button" aria-pressed={collectionType === 'NEW_ARRIVALS'} disabled={!canManage || Boolean(collection)} onClick={() => selectType('NEW_ARRIVALS')}><strong>Preset Collection</strong><span>Semantic New Arrivals with storefront ribbons.</span></button>
            </div>
            {collectionType === 'NEW_ARRIVALS' ? <label className="ad-field">Preset<select value="NEW_ARRIVALS" disabled><option value="NEW_ARRIVALS">New Arrivals</option></select></label> : null}
          </Panel>
          <Panel title={`Products · ${selectedIds.length} selected`}>
            <label className="ad-collection-search"><Search size={17} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products" /></label>
            <div className="ad-product-picker" role="group" aria-label="Choose collection products">
              {visibleProducts.map(product => <label key={product.id}><input type="checkbox" disabled={!canManage} checked={selectedIds.includes(product.id)} onChange={event => setSelectedIds(event.target.checked ? [...selectedIds, product.id] : selectedIds.filter(id => id !== product.id))} /><Thumb src={product.imageUrl ?? undefined} alt={product.name} /><span><strong>{product.name}</strong><small>{product.isActive ? (product.isAvailable ? 'In stock' : 'Sold out') : 'Inactive'}</small></span></label>)}
            </div>
          </Panel>
          {selectedProducts.length ? <Panel title="Storefront product order"><ol className="ad-selected-products">{selectedProducts.map((product, index) => <li key={product.id}><span><b>{index + 1}</b><Thumb src={product.imageUrl ?? undefined} alt={product.name} /><strong>{product.name}</strong></span><div className="ad-actions"><button type="button" disabled={!canManage || index === 0} aria-label={`Move ${product.name} up`} onClick={() => moveProduct(index, -1)}><ArrowUp size={15} /></button><button type="button" disabled={!canManage || index === selectedProducts.length - 1} aria-label={`Move ${product.name} down`} onClick={() => moveProduct(index, 1)}><ArrowDown size={15} /></button><button type="button" disabled={!canManage} aria-label={`Remove ${product.name}`} onClick={() => setSelectedIds(selectedIds.filter(id => id !== product.id))}><X size={15} /></button></div></li>)}</ol></Panel> : null}
        </div>
        <div className="ad-stack">
          <Panel title="Collection banner">
            <div className="ad-collection-banner-preview">{bannerPreview && !removeBanner ? <Image src={bannerPreview} alt="Collection banner preview" fill unoptimized={bannerPreview.startsWith('data:')} /> : <span>No banner selected</span>}</div>
            {canManage ? <><FileUploadField label="Collection banner" guidance="JPEG, PNG, WebP, or AVIF. The image is optimized before upload." accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => void chooseBanner(event.target.files?.[0])} />{bannerPreview && !removeBanner ? <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(''); setRemoveBanner(true); }}><Trash2 size={15} /> Remove banner</button> : null}</> : null}
          </Panel>
          <Panel title="Publishing">
            <Toggle label="Active on storefront" checked={isActive} disabled={!canManage} onChange={setIsActive} />
            <Toggle label="Feature in collection discovery" checked={isFeatured} disabled={!canManage} onChange={setIsFeatured} />
            <label className="ad-field">Display order<input type="number" min={0} value={sortOrder} disabled={!canManage} onChange={event => setSortOrder(Number(event.target.value) || 0)} /></label>
          </Panel>
          {canManage ? <button type="button" className="ad-primary ad-collection-save" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : 'Save Collection'}</button> : null}
        </div>
      </div>
    </>
  );
}

