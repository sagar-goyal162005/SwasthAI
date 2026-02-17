type UsedProof = {
  hash: string;
  usedAt: string;
  capturedAt?: string;
  context?: string;
};

function storageKey(userId: string) {
  return `healthzen:usedProofs:v1:${userId}`;
}

function safeParseUsedProofs(raw: string | null): UsedProof[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is UsedProof => !!p && typeof p === 'object')
      .map((p) => p as UsedProof)
      .filter((p) => typeof p.hash === 'string' && typeof p.usedAt === 'string');
  } catch {
    return [];
  }
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getUsedProofs(userId: string): UsedProof[] {
  if (!canUseStorage()) return [];
  return safeParseUsedProofs(window.localStorage.getItem(storageKey(userId)));
}

export function isProofHashUsed(userId: string, hash: string): boolean {
  if (!hash) return false;
  return getUsedProofs(userId).some((p) => p.hash === hash);
}

export function markProofHashUsed(userId: string, proof: UsedProof): void {
  if (!canUseStorage()) return;
  const existing = getUsedProofs(userId);
  if (existing.some((p) => p.hash === proof.hash)) return;

  const MAX = 200;
  const next = [proof, ...existing].slice(0, MAX);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
