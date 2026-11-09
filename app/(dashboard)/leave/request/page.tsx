import { redirect } from 'next/navigation';

/** Legacy deep link from the local module — leave submissions live in /me now. */
export default function LeaveRequestPage() {
  redirect('/me');
}
