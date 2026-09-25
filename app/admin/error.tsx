'use client';
import { FeedbackRegion } from '@/components/ui/feedback';
export default function AdminError({ reset }: { reset: () => void }) {
  return <FeedbackRegion tone="danger"><h2>Could not load this workspace</h2><p>Your data has not been replaced with an empty list. Please retry.</p><button type="button" className="cc-button" onClick={reset}>Retry</button></FeedbackRegion>;
}
