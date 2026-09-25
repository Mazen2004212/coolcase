'use client';
import { useState } from 'react';
import { formatPrice } from '@/lib/data/product-options';
import { FeedbackRegion } from '@/components/ui/feedback';
export function TransferDetails({ amount, recipient }: { amount: number; recipient: string }) {
  const [message, setMessage] = useState('');
  return <div className="cc-transfer"><p>Amount to transfer</p><strong className="cc-payable">{formatPrice(amount)}</strong><p>Official InstaPay recipient</p><strong dir="ltr">{recipient || 'Contact support for payment instructions.'}</strong>{recipient && <button type="button" className="cc-button" onClick={async () => { try { await navigator.clipboard.writeText(recipient); setMessage('InstaPay number copied.'); } catch { setMessage('Copy unavailable. Select and copy the number above.'); } }}>Copy number</button>}<FeedbackRegion>{message}</FeedbackRegion></div>;
}
