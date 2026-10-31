import { MoveTracking } from '@/components/features/moves/move-tracking';
export default async function TrackMoveByIdPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) { const [{ id }, { token }] = await Promise.all([params, searchParams]); return <MoveTracking moveId={id} trackingToken={token ?? ''} />; }
