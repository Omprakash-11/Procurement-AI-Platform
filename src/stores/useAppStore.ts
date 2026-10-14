import { create } from 'zustand'

// UI state only — never API data (Tech Stack §7.2).
// The "sidebar collapsed" field from the Plan is deferred to Phase 4 (conflict #18:
// Content Guidelines says the sidebar never collapses on desktop).
type AppState = {
  activeModal: string | null
  globalSearchQuery: string
  openModal: (id: string) => void
  closeModal: () => void
  setGlobalSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>()((set) => ({
  activeModal: null,
  globalSearchQuery: '',
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
}))
