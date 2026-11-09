import { redirect } from 'next/navigation';

/** Legacy deep link from the local module — check-in lives in /me now. */
export default function CheckInPage() {
  redirect('/me');
}
