import '@testing-library/jest-dom/vitest'

// Node ≥22 expose un `localStorage` natif (nécessitant --localstorage-file, sans quoi
// il est inutilisable) qui masque celui fourni par jsdom : vitest ne recopie pas la
// clé "localStorage" du window jsdom sur le global de test car elle existe déjà
// (voir populateGlobal dans vitest). On la remplace ici par une implémentation
// en mémoire, suffisante pour les tests.
class MemoryStorage implements Storage {
  private magasin = new Map<string, string>()
  get length() { return this.magasin.size }
  clear() { this.magasin.clear() }
  getItem(cle: string) { return this.magasin.has(cle) ? this.magasin.get(cle)! : null }
  key(index: number) { return Array.from(this.magasin.keys())[index] ?? null }
  removeItem(cle: string) { this.magasin.delete(cle) }
  setItem(cle: string, valeur: string) { this.magasin.set(cle, String(valeur)) }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
})
