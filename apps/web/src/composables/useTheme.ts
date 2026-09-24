import { ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'rendi:theme'

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // localStorage no disponible: seguimos al sistema.
  }
  return 'system'
}

const preference = ref<ThemePreference>(readPreference())

function apply(value: ThemePreference) {
  const root = document.documentElement
  if (value === 'system') delete root.dataset.theme
  else root.dataset.theme = value
  try {
    if (value === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Ignorado: la preferencia vive solo en esta sesión.
  }
}

apply(preference.value)
watch(preference, apply)

const ORDER: ThemePreference[] = ['system', 'light', 'dark']

export function useTheme() {
  function cycle() {
    const next = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]
    preference.value = next ?? 'system'
  }
  return { preference, cycle }
}
