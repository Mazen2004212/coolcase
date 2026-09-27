'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FileUploadField } from '@/components/ui/file-upload-field';
import { LoadingButton } from '@/components/ui/feedback';
import { PaymentStatusBadge } from '@/components/ui/status-badge';
import { Upload } from 'lucide-react';

import { uploadPaymentProof } from '@/app/actions/payment-proofs';
import { preprocessClientImage } from '@/lib/images/client-preprocess';

export function PaymentProofUpload({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (status === 'PENDING_VERIFICATION') {
    return (
      <p className="payment-proof-state" role="status">
        Payment proof submitted — awaiting review.
      </p>
    );
  }

  if (!['PENDING', 'REJECTED'].includes(status)) return <PaymentStatusBadge status={status}/>;

  return (
    <form
      className="payment-proof-upload" aria-busy={isPending}
      action={formData => {
        setMessage('');
        startTransition(async () => {
          try {
          if (!file) {
            setMessage('Choose a payment proof image first.');
            return;
          }
          formData.set('file', file);
          const result = await uploadPaymentProof(orderId, formData);
          if (result.ok) {
            setStatus(result.status);
            if (inputRef.current) inputRef.current.value = '';
            router.refresh();
          } else {
            setMessage(result.error);
          }
          } catch { setMessage('Proof could not be uploaded. Please try again.'); }
        });
      }}
    >
      <FileUploadField label={status === 'REJECTED' ? 'Upload new payment proof' : 'Upload payment proof'} guidance="JPEG, PNG, or WebP · prepared to 1 MiB or less before upload" inputRef={inputRef} selectedFileName={file?.name ?? ''} error={message || undefined} name="file" accept="image/jpeg,image/png,image/webp" required disabled={isPending || isPreparing} onChange={async event => {
        const selected = event.target.files?.[0] ?? null;
        setMessage('');
        setFile(null);
        setPreview('');
        if (!selected) return;
        setIsPreparing(true);
        try {
          const processed = await preprocessClientImage(selected, 'payment-proof');
          setFile(processed);
          setPreview(URL.createObjectURL(processed));
        } catch (uploadError) {
          setMessage(uploadError instanceof Error ? uploadError.message : 'This image could not be prepared.');
          if (inputRef.current) inputRef.current.value = '';
        } finally {
          setIsPreparing(false);
        }
      }}/>
      {file && <div className="cc-file-preview">{preview && <Image src={preview} alt="Selected payment proof" width={160} height={120} unoptimized/>}<span>{file.name} · {(file.size / 1024).toFixed(0)} KB</span><button type="button" disabled={isPending} onClick={() => inputRef.current?.click()}>Replace proof</button></div>}
      <LoadingButton type="submit" busy={isPending || isPreparing} busyLabel={isPreparing ? "Preparing…" : "Uploading…"} disabled={!file}>
        <Upload aria-hidden="true" />
        Submit Proof
      </LoadingButton>
    </form>
  );
}
