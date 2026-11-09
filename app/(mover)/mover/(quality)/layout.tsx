import type { ReactNode } from 'react';
import { WorkspaceProvider } from '@/components/features/workspace/workspace-context';

/**
 * Member 6's quality screens (claims, reviews, assistant) inside the mover app:
 * same pages as the client workspace, rendered in the mover shell. They read the
 * signed-in user from the workspace context, so it is provided here too.
 */
export default function MoverQualityLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}
