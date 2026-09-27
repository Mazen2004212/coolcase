'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProduct, updateProduct, deleteProduct, setProductActive } from '@/app/admin/actions/products';
import type { StoreSettings } from '@/lib/catalog/types';
import { PriceDisplay } from '@/components/ui/price-display';
import { ActionLink, ConfirmReal, Empty, Field, PageHeading, Panel, Pill, Table, Thumb, Toggle } from './admin-ui';
import { ImageManagerLive } from './image-manager-live';
import type { LiveImage } from './image-manager-live';
import { useAdmin } from './admin-provider';
import { requirePermission } from '@/lib/admin/permissions';
import { resolvePublicMediaUrl } from '@/lib/storage/public-media-core';

// ─── Types matching fetchAdminProducts() output ───────────────────────────────

export type LiveProduct = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  is_active: boolean;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  silicone_original_price_override: number | null;
  acrylic_original_price_override: number | null;
  double_layer_original_price_override: number | null;
  silicone_price_override: number | null;
  acrylic_price_override: number | null;
  double_layer_price_override: number | null;
  silicone_enabled: boolean;
  acrylic_enabled: boolean;
  double_layer_enabled: boolean;
  created_at: string;
  updated_at: string;
  categories: { id: string; name: string; slug: string } | null;
  product_images: Array<{ id: string; storage_path: string; alt_text: string | null; display_order: number; is_primary: boolean }>;
};

export type LiveCategory = { id: string; name: string; slug: string; display_order: number };

// ─── Status helpers ──────────────────────────────────────────────────────────

function productStatusLabel(p: LiveProduct): string {
  if (!p.is_active) return 'Draft';
  if (!p.is_available) return 'Out of Stock';
  return 'Active';
}

function productStatusColor(p: LiveProduct): string {
  if (!p.is_active) return 'grey';
  if (!p.is_available) return 'amber';
  return 'green';
}

function coverSrc(p: LiveProduct): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const primary = p.product_images.find(i => i.is_primary) ?? p.product_images[0];
  if (!primary) return '';
  return resolvePublicMediaUrl(primary.storage_path, supabaseUrl);
}

// ─── Products List ────────────────────────────────────────────────────────────

export function ProductsListLive({ products }: { products: LiveProduct[] }) {
  const { staff } = useAdmin();
  const canManage = requirePermission(staff, 'products.manage');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [archiveConfirm, setArchiveConfirm] = useState<string[] | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LiveProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'Active' && (!p.is_active || !p.is_available)) return false;
    if (statusFilter === 'Draft' && p.is_active) return false;
    if (statusFilter === 'Out of Stock' && (!p.is_active || p.is_available)) return false;
    if (categoryFilter && p.categories?.slug !== categoryFilter) return false;
    return true;
  });

  const categories = [...new Map(products.filter(p => p.categories).map(p => [p.categories!.slug, p.categories!])).values()];

  async function bulkSetActive(ids: string[], active: boolean) {
    setBusy(true);
    for (const id of ids) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      await setProductActive(id, active, p.slug);
    }
    setMessage(`${ids.length} product(s) ${active ? 'published' : 'unpublished'}.`);
    setSelected([]);
    setBusy(false);
    router.refresh();
  }

  async function handleDelete(product: LiveProduct) {
    setBusy(true);
    const result = await deleteProduct(product.id, product.slug);
    setBusy(false);
    setDeleteConfirm(null);
    if (result.error) { setMessage(`Error: ${result.error}`); return; }
    setMessage(`${product.name} deleted.`);
    router.refresh();
  }

  return (
    <>
      <PageHeading
        title="Products"
        description="Manage your catalog in Supabase. Changes publish to the storefront immediately."
        action={canManage ? <ActionLink href="/admin/products/new">Add Product</ActionLink> : undefined}
      />
      {message && (
        <div className="ad-notice" role="status">
          {message}
          <button aria-label="Dismiss" onClick={() => setMessage('')}>×</button>
        </div>
      )}
      <Panel title={`${filtered.length} products`}>
        <div className="ad-filters">
          <Field label="Search products">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name" />
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option>Active</option>
              <option>Draft</option>
              <option>Out of Stock</option>
            </select>
          </Field>
          <Field label="Category">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {canManage && <div className="ad-actions ad-bulk">
          <label>
            <input
              type="checkbox"
              aria-label="Select visible products"
              checked={filtered.length > 0 && filtered.every(p => selected.includes(p.id))}
              onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])}
            />
            Select visible
          </label>
          <span>{selected.length} selected</span>
          <button disabled={!selected.length || busy} onClick={() => bulkSetActive(selected, true)}>Publish</button>
          <button disabled={!selected.length || busy} onClick={() => bulkSetActive(selected, false)}>Unpublish</button>
          <button disabled={!selected.length || busy} onClick={() => setArchiveConfirm(selected)}>Delete</button>
        </div>}
        <Table headings={['', 'Product', 'Category', 'Materials', 'Status', 'Available', 'Featured', 'Actions']}>
          {filtered.map(p => (
            <tr key={p.id}>
              <td>
                {canManage ? <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /> : null}
              </td>
              <td>
                <Link className="ad-product-cell" href={`/admin/products/${p.id}`}>
                  <Thumb src={coverSrc(p)} alt={p.name} />
                  <strong>{p.name}</strong>
                </Link>
              </td>
              <td>{p.categories?.name ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
              <td>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {p.silicone_enabled && <Pill color="grey">Silicone</Pill>}
                  {p.acrylic_enabled && <Pill color="grey">Acrylic</Pill>}
                  {p.double_layer_enabled && <Pill color="grey">Double Layer</Pill>}
                </div>
              </td>
              <td><Pill color={productStatusColor(p)}>{productStatusLabel(p)}</Pill></td>
              <td>{p.is_available ? '✓ In Stock' : '✗ Sold Out'}</td>
              <td>{p.is_featured ? '★' : '—'}</td>
              <td>
                <div className="ad-actions">
                  <Link href={`/admin/products/${p.id}`}>{canManage ? 'Edit' : 'View'}</Link>
                  {canManage && <button disabled={busy} onClick={async () => {
                    setBusy(true);
                    await setProductActive(p.id, !p.is_active, p.slug);
                    setBusy(false);
                    router.refresh();
                  }}>
                    {p.is_active ? 'Unpublish' : 'Publish'}
                  </button>}
                  {canManage && <button disabled={busy} onClick={() => setDeleteConfirm(p)}>Delete</button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!filtered.length && <Empty />}
      </Panel>

      {archiveConfirm && (
        <ConfirmReal
          title={`Delete ${archiveConfirm.length} product(s)?`}
          description="This removes the products and all their public media permanently."
          confirmLabel="Delete permanently"
          close={() => setArchiveConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            for (const id of archiveConfirm) {
              const p = products.find(x => x.id === id);
              if (p) await deleteProduct(p.id, p.slug);
            }
            setBusy(false);
            setArchiveConfirm(null);
            setSelected([]);
            router.refresh();
          }}
        />
      )}
      {deleteConfirm && (
        <ConfirmReal
          title={`Delete "${deleteConfirm.name}"?`}
          description="This removes the product and all its public media permanently."
          confirmLabel="Delete permanently"
          close={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
        />
      )}
    </>
  );
}

// ─── Product Editor ───────────────────────────────────────────────────────────

type EditorProps = {
  id: string;               // 'new' | existing UUID
  product: LiveProduct | null;
  categories: LiveCategory[];
};

export function ProductEditorLive({ id, product, categories, pricingSettings }: EditorProps & { pricingSettings: StoreSettings }) {
  const router = useRouter();
  const isNew = id === 'new';
  const { staff } = useAdmin();
  const canEdit = requirePermission(staff, 'products.manage');

  const [name, setName]               = useState(product?.name ?? '');
  const [slug, setSlug]               = useState(product?.slug ?? '');
  const [categoryId, setCategoryId]   = useState(product?.categories?.id ?? '');
  const [shortDesc, setShortDesc]     = useState(product?.short_description ?? '');
  const [desc, setDesc]               = useState(product?.description ?? '');
  const [isActive, setIsActive]       = useState(product?.is_active ?? false);
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true);
  const [isFeatured, setIsFeatured]   = useState(product?.is_featured ?? false);
  const [displayOrder, setDisplayOrder] = useState(product?.display_order ?? 0);
  
  const [siliconeOriginalPrice, setSiliconeOriginalPrice] = useState<string>(product?.silicone_original_price_override?.toString() ?? '');
  const [acrylicOriginalPrice, setAcrylicOriginalPrice] = useState<string>(product?.acrylic_original_price_override?.toString() ?? '');
  const [doubleLayerOriginalPrice, setDoubleLayerOriginalPrice] = useState<string>(product?.double_layer_original_price_override?.toString() ?? '');
  
  const [siliconePrice, setSiliconePrice]     = useState<string>(product?.silicone_price_override?.toString() ?? '');
  const [acrylicPrice, setAcrylicPrice]       = useState<string>(product?.acrylic_price_override?.toString() ?? '');
  const [doubleLayerPrice, setDoubleLayerPrice] = useState<string>(product?.double_layer_price_override?.toString() ?? '');

  const [siliconeEnabled, setSiliconeEnabled]     = useState(product?.silicone_enabled ?? true);
  const [acrylicEnabled, setAcrylicEnabled]       = useState(product?.acrylic_enabled ?? true);
  const [doubleLayerEnabled, setDoubleLayerEnabled] = useState(product?.double_layer_enabled ?? true);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Build initial images for ImageManagerLive
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const initialImages: LiveImage[] = (product?.product_images ?? [])
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.display_order - b.display_order;
    })
    .map(img => ({
      id:           img.id,
      storagePath:  img.storage_path,
      src:          resolvePublicMediaUrl(img.storage_path, supabaseUrl),
      alt:          img.alt_text ?? '',
      isPrimary:    img.is_primary,
      displayOrder: img.display_order,
    }));

  function autoSlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('Product name is required.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return setError('Slug must be lowercase letters, numbers, and hyphens.');

    const input = {
      name:                    name.trim(),
      slug:                    slug.trim(),
      categoryId:              categoryId || null,
      shortDescription:        shortDesc,
      description:             desc,
      isActive,
      isAvailable,
      isFeatured,
      displayOrder,
      siliconeOriginalPriceOverride: siliconeOriginalPrice ? parseInt(siliconeOriginalPrice, 10) : null,
      acrylicOriginalPriceOverride:  acrylicOriginalPrice ? parseInt(acrylicOriginalPrice, 10) : null,
      doubleLayerOriginalPriceOverride: doubleLayerOriginalPrice ? parseInt(doubleLayerOriginalPrice, 10) : null,
      siliconePriceOverride:   siliconePrice ? parseInt(siliconePrice, 10) : null,
      acrylicPriceOverride:    acrylicPrice ? parseInt(acrylicPrice, 10) : null,
      doubleLayerPriceOverride:doubleLayerPrice ? parseInt(doubleLayerPrice, 10) : null,
      siliconeEnabled,
      acrylicEnabled,
      doubleLayerEnabled,
    };

    setBusy(true);

    if (isNew) {
      const result = await createProduct(input);
      setBusy(false);
      if ('error' in result) return setError(result.error);
      // Created — go to edit page so images can be uploaded
      router.push(`/admin/products/${result.id}`);
      return;
    }

    const result = await updateProduct(id, input);
    setBusy(false);
    if (result.error) return setError(result.error);
    router.push('/admin/products');
  }

  async function handleDelete() {
    if (!product) return;
    setBusy(true);
    const result = await deleteProduct(product.id, product.slug);
    setBusy(false);
    if (result.error) return setError(result.error);
    router.push('/admin/products');
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <PageHeading
        title={isNew ? 'Add Product' : `Edit ${product?.name ?? ''}`}
        description={isNew
          ? 'Create a product. Add images on the next step after saving.'
          : 'Saved changes appear on the storefront.'}
        action={<Link href="/admin/products">Back to products</Link>}
      />
      {!canEdit && <p className="cc-helper">Read-only access. Product changes require manage permission.</p>}<form onSubmit={handleSubmit}><fieldset disabled={!canEdit || busy}>
        <div className="ad-editor">
          {/* Left column */}
          <div className="ad-stack">
            <Panel title="Basic information">
              <div className="ad-form-grid">
                <Field label="Product name">
                  <input
                    required
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (isNew) setSlug(autoSlug(e.target.value));
                    }}
                  />
                </Field>
                <Field label="URL slug">
                  <input
                    required
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    title="Lowercase letters, numbers, hyphens only"
                  />
                </Field>
                <Field label="Category">
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Display order">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={displayOrder}
                    onChange={e => setDisplayOrder(Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Short description">
                <textarea value={shortDesc} onChange={e => setShortDesc(e.target.value)} rows={2} />
              </Field>
              <Field label="Full description">
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} />
              </Field>
            </Panel>

            {/* Pricing overrides */}
            <Panel title="Pricing overrides (optional)"><p>Only enabled materials are offered to customers. Preview values below reflect the current form.</p><div className="cc-price-preview">{[
  { label:'Silicone', enabled:siliconeEnabled, original:siliconeOriginalPrice, sale:siliconePrice, originalDefault:pricingSettings.siliconOriginalPrice, saleDefault:pricingSettings.siliconSellingPrice },
  { label:'Acrylic', enabled:acrylicEnabled, original:acrylicOriginalPrice, sale:acrylicPrice, originalDefault:pricingSettings.acrylicOriginalPrice, saleDefault:pricingSettings.acrylicSellingPrice },
  { label:'Double Layer', enabled:doubleLayerEnabled, original:doubleLayerOriginalPrice, sale:doubleLayerPrice, originalDefault:pricingSettings.doubleLayerOriginalPrice, saleDefault:pricingSettings.doubleLayerSellingPrice },
].map(row=><div key={row.label}><strong>{row.label} · {row.enabled?'Available':'Disabled'}</strong><PriceDisplay current={row.sale?Number.parseInt(row.sale,10):row.saleDefault} original={row.original?Number.parseInt(row.original,10):row.originalDefault}/><p>Original: {row.original?'Product override':'Global default'} · Selling: {row.sale?'Product override':'Global default'}</p></div>)}</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
                Leave blank to use global store settings. Enter an EGP value to override for this product. Original Price should be &gt;= Sale Price.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Silicone</h4>
                <div className="ad-form-grid">
                  <Field label="Silicone Original Price Override (EGP)">
                    <input type="number" min={1} step={1} value={siliconeOriginalPrice} onChange={e => setSiliconeOriginalPrice(e.target.value)} placeholder="Global default" />
                  </Field>
                  <Field label="Silicone Sale Price Override (EGP)">
                    <input type="number" min={1} step={1} value={siliconePrice} onChange={e => setSiliconePrice(e.target.value)} placeholder="Global default" />
                  </Field>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Acrylic</h4>
                <div className="ad-form-grid">
                  <Field label="Acrylic Original Price Override (EGP)">
                    <input type="number" min={1} step={1} value={acrylicOriginalPrice} onChange={e => setAcrylicOriginalPrice(e.target.value)} placeholder="Global default" />
                  </Field>
                  <Field label="Acrylic Sale Price Override (EGP)">
                    <input type="number" min={1} step={1} value={acrylicPrice} onChange={e => setAcrylicPrice(e.target.value)} placeholder="Global default" />
                  </Field>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Double Layer</h4>
                <div className="ad-form-grid">
                  <Field label="Double Layer Original Price Override (EGP)">
                    <input type="number" min={1} step={1} value={doubleLayerOriginalPrice} onChange={e => setDoubleLayerOriginalPrice(e.target.value)} placeholder="Global default" />
                  </Field>
                  <Field label="Double Layer Sale Price Override (EGP)">
                    <input type="number" min={1} step={1} value={doubleLayerPrice} onChange={e => setDoubleLayerPrice(e.target.value)} placeholder="Global default" />
                  </Field>
                </div>
              </div>
            </Panel>

            {/* Material availability */}
            <Panel title="Material availability">
              <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
                Disable a material if this product cannot be manufactured in it.
              </p>
              <Toggle label="Silicone Enabled" checked={siliconeEnabled} onChange={setSiliconeEnabled} />
              <Toggle label="Acrylic Enabled" checked={acrylicEnabled} onChange={setAcrylicEnabled} />
              <Toggle label="Double Layer Enabled" checked={doubleLayerEnabled} onChange={setDoubleLayerEnabled} />
            </Panel>

            {/* Images — only on edit */}
            {!isNew && product && (
              <Panel title="Images">
                <ImageManagerLive productId={product.id} initialImages={initialImages} />
              </Panel>
            )}
            {isNew && (
              <Panel title="Images">
                <p style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>
                  Save the product first. You will be redirected to the edit page where you can upload images.
                </p>
              </Panel>
            )}
          </div>

          {/* Right column */}
          <div className="ad-stack">
            <Panel title="Publication">
              <Toggle label="Published (visible on storefront)" checked={isActive} onChange={setIsActive} />
              <Toggle label="In Stock (available to add to cart)" checked={isAvailable} onChange={setIsAvailable} />
              <Toggle label="Featured (shown on homepage)" checked={isFeatured} onChange={setIsFeatured} />
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, fontSize: '0.8125rem' }}>
                <strong>Current status: </strong>
                {!isActive ? 'Draft — hidden from storefront' : !isAvailable ? 'Active but Sold Out' : 'Active — visible and purchasable'}
              </div>
            </Panel>

            {!isNew && product && (
              <Panel title="Danger zone">
                <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: 12 }}>
                  Deleting removes the product and all its public media permanently.
                </p>
                <button type="button" className="ad-danger" disabled={busy} onClick={() => setShowDeleteConfirm(true)}>
                  Delete product
                </button>
              </Panel>
            )}
          </div>
        </div>

        {error && <p className="ad-error" role="alert">{error}</p>}
        <div className="ad-savebar">
          <Link href="/admin/products">Cancel</Link>
          <button className="ad-primary" type="submit" disabled={!canEdit || busy}>
            {busy ? 'Saving…' : isNew ? 'Create & add images' : 'Save Changes'}
          </button>
        </div>
      </fieldset></form>

      {showDeleteConfirm && (
        <ConfirmReal
          title={`Delete "${product?.name}"?`}
          description="This removes the product and all its public media permanently."
          confirmLabel="Delete permanently"
          close={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
