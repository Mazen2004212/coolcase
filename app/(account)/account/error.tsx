'use client';
import { FeedbackRegion } from '@/components/ui/feedback';
export default function AccountError({ reset }: { reset: () => void }) {
  return <FeedbackRegion tone="danger"><h2>Could not load your account information</h2><p>Please try again. If this continues, contact Coolcase support.</p><button type="button" className="cc-button" onClick={reset}>Retry</button></FeedbackRegion>;
}
