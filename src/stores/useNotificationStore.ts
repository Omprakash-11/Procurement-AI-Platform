import { create } from 'zustand'

// UI state only (Tech Stack §7.2): the badge count mirror and dropdown visibility.
// Notification records themselves live in the TanStack Query cache.
type NotificationState = {
  unreadCount: number
  isDropdownOpen: boolean
  setUnreadCount: (count: number) => void
  setDropdownOpen: (open: boolean) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  isDropdownOpen: false,
  setUnreadCount: (count) => set({ unreadCount: count }),
  setDropdownOpen: (open) => set({ isDropdownOpen: open }),
}))
