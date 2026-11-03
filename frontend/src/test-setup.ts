// Fichier exécuté avant chaque fichier de tests (angular.json > test > setupFiles).
//
// Depuis Node 25, Node expose son propre `localStorage`/`sessionStorage` global (Web
// Storage natif). Sans l'option `--localstorage-file`, ce global est inutilisable
// (undefined ou exception) et masque celui de jsdom : les tests qui touchent au
// localStorage (auth, thème...) cassent alors en CI dès que `lts/*` passe à Node ≥ 25.
// On réinstalle donc un stockage en mémoire quand celui du global n'est pas utilisable.

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function isUsable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const storage = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
    return typeof storage?.getItem === 'function' && typeof storage?.clear === 'function';
  } catch {
    return false;
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!isUsable(name)) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
