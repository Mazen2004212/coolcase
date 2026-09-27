'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveCustomCaseTemplate, setCustomCaseTemplateActive } from '@/app/admin/actions/custom-cases';
import { FeedbackRegion } from '@/components/ui/feedback';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { requirePermission } from '@/lib/admin/permissions';
import { productAssetUrl, type NamedCaseTemplate } from '@/lib/custom-cases/templates';
import { preprocessClientImage } from '@/lib/images/client-preprocess';
import { ActionLink, Empty, Field, PageHeading, Panel, Pill, Table, Toggle } from './admin-ui';
import { useAdmin } from './admin-provider';

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Keep legacy typography settings untouched on edit; new designs receive safe fixed defaults.
function preservedStyle(template: NamedCaseTemplate | null) {
  return {
    englishMaxCharacters: template?.english_max_characters ?? 7,
    englishFontKey: template?.english_font_key ?? 'ARIAL',
    englishFontSize: template?.english_font_size ?? 96,
    englishFontWeight: template?.english_font_weight ?? 900,
    englishTextColor: template?.english_text_color ?? '#111111',
    englishTextX: Number(template?.english_text_x ?? 51.5),
    englishTextY: Number(template?.english_text_y ?? 55),
    englishTextRotation: Number(template?.english_text_rotation ?? 0),
    englishTextAlign: template?.english_text_align ?? 'center',
    englishTextTransform: template?.english_text_transform ?? 'UPPERCASE',
    arabicMaxCharacters: template?.arabic_max_characters ?? 7,
    arabicFontKey: template?.arabic_font_key ?? 'TAHOMA',
    arabicFontSize: template?.arabic_font_size ?? 64,
    arabicFontWeight: template?.arabic_font_weight ?? 700,
    arabicTextColor: template?.arabic_text_color ?? '#111111',
    arabicTextX: Number(template?.arabic_text_x ?? 54),
    arabicTextY: Number(template?.arabic_text_y ?? 57),
    arabicTextRotation: Number(template?.arabic_text_rotation ?? 0),
    arabicTextAlign: template?.arabic_text_align ?? 'center',
  };
}

export function CustomCaseTemplatesLive({ templates }: { templates: NamedCaseTemplate[] }) {
  const { staff } = useAdmin();
  const canEdit = requirePermission(staff, 'products.manage');
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);

  return <>
    <PageHeading title="Custom Cases" description="Manage design titles, artwork, and availability." action={canEdit ? <ActionLink href="/admin/custom-cases/new">Add Custom Case</ActionLink> : undefined} />
    <FeedbackRegion tone={failed ? 'danger' : 'success'}>{feedback}</FeedbackRegion>
    <Panel title={`${templates.length} designs`}>
      {templates.length ? <Table headings={['Design', 'Order', 'Status', 'Actions']}>
        {templates.map(template => <tr key={template.id}>
          <td><div className="ad-product-cell"><Image className="ad-thumb" src={productAssetUrl(template.image_path)} alt="" width={40} height={50} /><Link href={`/admin/custom-cases/${template.id}`}><strong>{template.name}</strong></Link></div></td>
          <td>{template.sort_order}</td>
          <td><Pill color={template.is_active ? 'green' : 'grey'}>{template.is_active ? 'Active' : 'Inactive'}</Pill></td>
          <td><div className="ad-actions"><Link href={`/admin/custom-cases/${template.id}`}>{canEdit ? 'Edit' : 'View'}</Link>{canEdit ? <button type="button" disabled={pending !== null} onClick={async () => {
            setPending(template.id); setFeedback('');
            const result = await setCustomCaseTemplateActive(template.id, !template.is_active);
            setPending(null);
            if ('error' in result) { setFailed(true); setFeedback(result.error ?? 'Could not update design.'); }
            else { setFailed(false); setFeedback(template.is_active ? 'Design deactivated.' : 'Design activated.'); router.refresh(); }
          }}>{pending === template.id ? 'Saving…' : template.is_active ? 'Deactivate' : 'Activate'}</button> : null}</div></td>
        </tr>)}
      </Table> : <Empty>No custom case designs yet. Add the first design when its artwork is ready.</Empty>}
    </Panel>
  </>;
}

export function CustomCaseTemplateEditorLive({ template }: { template: NamedCaseTemplate | null }) {
  const router = useRouter();
  const { staff } = useAdmin();
  const canEdit = requirePermission(staff, 'products.manage');
  const [name, setName] = useState(template?.name ?? '');
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(template?.sort_order ?? 0);
  const [file, setFile] = useState<File | null>(null);
  const [blob, setBlob] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  useEffect(() => () => { if (blob) URL.revokeObjectURL(blob); }, [blob]);
  const image = blob || (template ? productAssetUrl(template.image_path) : '');

  async function submit() {
    const slug = template?.slug ?? (slugify(name) || `custom-case-${crypto.randomUUID().slice(0, 8)}`);
    if (!name.trim()) { setMessage('Enter a design title.'); return; }
    setBusy(true); setMessage('');
    const formData = new FormData();
    if (file) formData.append('file', file);
    const result = await saveCustomCaseTemplate(template?.id ?? null, { name, slug, isActive, sortOrder, ...preservedStyle(template) }, formData);
    setBusy(false);
    if ('error' in result) { setMessage(result.error ?? 'Could not save the design.'); return; }
    router.push('/admin/custom-cases'); router.refresh();
  }

  return <>
    <PageHeading title={template ? 'Edit Custom Case' : 'Add Custom Case'} description="Add a title and artwork, then choose its active status." />
    <div className="ad-editor cc-template-editor">
      <Panel title="Design details">
        {!canEdit ? <p>Read-only access. Changes require products.manage permission.</p> : null}
        <fieldset disabled={!canEdit || busy}>
          <Field label="Custom Case Name / Title"><input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Couple Case" /></Field>
          <FileUploadField label={template ? 'Replace template image (optional)' : 'Template / Preview Image'} guidance="JPEG, PNG, WebP, or AVIF · optimized to 1.5 MB or less." selectedFileName={file?.name ?? ''} accept="image/jpeg,image/png,image/webp,image/avif" error={uploadError || undefined} onChange={async event => {
            const next = event.target.files?.[0] ?? null;
            setMessage(''); setUploadError('');
            if (!next) { setFile(null); setBlob(''); return; }
            setBusy(true);
            try { const processed = await preprocessClientImage(next, 'product'); setFile(processed); setBlob(URL.createObjectURL(processed)); }
            catch (error) { setFile(null); setBlob(''); setUploadError(error instanceof Error ? error.message : 'This image could not be prepared.'); event.target.value = ''; }
            finally { setBusy(false); }
          }} />
          <Field label="Sort order"><input type="number" min={0} max={10000} value={sortOrder} onChange={event => setSortOrder(Number(event.target.value))} /></Field>
          <Toggle label="Active" checked={isActive} onChange={setIsActive} />
          {message ? <p className="ad-error" role="alert">{message}</p> : null}
          <div className="ad-savebar"><Link href="/admin/custom-cases">Cancel</Link><button type="button" className="ad-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save Custom Case'}</button></div>
        </fieldset>
      </Panel>
      <Panel title="Artwork preview">{image ? <div className="ad-template-image-preview"><Image src={image} alt={`${name || 'Custom case'} artwork preview`} fill unoptimized={image.startsWith('blob:')} sizes="(max-width: 900px) 100vw, 360px" /></div> : <Empty>Choose an image to preview the design.</Empty>}</Panel>
    </div>
  </>;
}
