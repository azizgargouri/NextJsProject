/**
 * Claims, reviews and the assistant are shared by two workspaces: clients use
 * them under /dashboard, movers inside their own app under /mover. Links follow
 * the signed-in role so nobody is sent to the other workspace.
 */
export function qualityBase(role: string | undefined): '/mover' | '/dashboard' {
  return role === 'MOVER' ? '/mover' : '/dashboard';
}

/** Every path a quality change must refresh, whichever workspace showed it. */
export function qualityPaths(path: `/${string}`): string[] {
  return [`/dashboard${path}`, `/mover${path}`];
}
