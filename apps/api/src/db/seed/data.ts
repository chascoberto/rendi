/**
 * Datos de ejemplo (ficticios) de un hogar de Chillán. Solo para desarrollo.
 * No incluye códigos de barra: se inventarían EAN que podrían chocar con productos
 * reales. Se asocian escaneando productos de verdad.
 */
import type { ContentUnit, StockMode } from '@rendi/shared'

export type LocationName = 'Despensa' | 'Refrigerador' | 'Congelador'

export const HOUSEHOLD_NAME = 'Hogar de ejemplo'

/** Alimentos genéricos → categoría. */
export const FOODS: Record<string, string> = {
  leche: 'lacteos',
  yogur: 'lacteos',
  quesillo: 'lacteos',
  queso: 'lacteos',
  mantequilla: 'lacteos',
  huevo: 'lacteos',
  arroz: 'abarrotes',
  fideos: 'abarrotes',
  aceite: 'abarrotes',
  azúcar: 'abarrotes',
  avena: 'abarrotes',
  atún: 'abarrotes',
  lentejas: 'abarrotes',
  porotos: 'abarrotes',
  pan: 'panaderia',
  pollo: 'carnes',
  'carne molida': 'carnes',
  pescado: 'carnes',
  vienesas: 'carnes',
  palta: 'frutas-verduras',
  tomate: 'frutas-verduras',
  plátano: 'frutas-verduras',
  manzana: 'frutas-verduras',
  zanahoria: 'frutas-verduras',
  papa: 'frutas-verduras',
  cebolla: 'frutas-verduras',
  lechuga: 'frutas-verduras',
  brócoli: 'frutas-verduras',
  'zapallo italiano': 'frutas-verduras',
  arvejas: 'congelados',
  jugo: 'bebidas',
  galletas: 'colaciones',
}

export interface SeedLot {
  quantity: number
  /** Días desde hoy hasta el vencimiento. */
  expiresInDays?: number
  location?: LocationName
}

export interface SeedProduct {
  name: string
  brand?: string
  food?: keyof typeof FOODS
  category: string
  amount: number
  unit: ContentUnit
  mode?: StockMode
  min?: number
  location: LocationName
  lots: SeedLot[]
}

// prettier-ignore
export const PRODUCTS: SeedProduct[] = [
  // Lácteos y huevos
  { name: 'Leche entera', brand: 'Colun', food: 'leche', category: 'lacteos', amount: 1, unit: 'L', min: 4, location: 'Despensa', lots: [{ quantity: 3, expiresInDays: 60 }] },
  { name: 'Leche sabor chocolate', brand: 'Soprole', food: 'leche', category: 'colaciones', amount: 200, unit: 'ml', min: 6, location: 'Despensa', lots: [{ quantity: 8, expiresInDays: 45 }] },
  { name: 'Yogur batido frutilla', brand: 'Soprole', food: 'yogur', category: 'lacteos', amount: 125, unit: 'g', min: 6, location: 'Refrigerador', lots: [{ quantity: 2, expiresInDays: 2 }, { quantity: 4, expiresInDays: 12 }] },
  { name: 'Quesillo', brand: 'Colun', food: 'quesillo', category: 'lacteos', amount: 350, unit: 'g', location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 4 }] },
  { name: 'Queso gauda laminado', brand: 'Colun', food: 'queso', category: 'lacteos', amount: 250, unit: 'g', min: 1, location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 10 }] },
  { name: 'Mantequilla con sal', brand: 'Colun', food: 'mantequilla', category: 'lacteos', amount: 250, unit: 'g', location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 40 }] },
  { name: 'Huevos blancos', food: 'huevo', category: 'lacteos', amount: 12, unit: 'u', min: 1, location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 18 }] },
  // Abarrotes
  { name: 'Arroz grado 2', brand: 'Tucapel', food: 'arroz', category: 'abarrotes', amount: 1, unit: 'kg', min: 1, location: 'Despensa', lots: [{ quantity: 2 }] },
  { name: 'Tallarines N°5', brand: 'Carozzi', food: 'fideos', category: 'abarrotes', amount: 400, unit: 'g', min: 2, location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Espirales', brand: 'Carozzi', food: 'fideos', category: 'abarrotes', amount: 400, unit: 'g', location: 'Despensa', lots: [{ quantity: 2 }] },
  { name: 'Aceite de maravilla', food: 'aceite', category: 'abarrotes', amount: 1, unit: 'L', min: 1, location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Azúcar', brand: 'Iansa', food: 'azúcar', category: 'abarrotes', amount: 1, unit: 'kg', location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Avena tradicional', brand: 'Quaker', food: 'avena', category: 'abarrotes', amount: 500, unit: 'g', location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Atún lomitos en agua', brand: "Van Camp's", food: 'atún', category: 'abarrotes', amount: 160, unit: 'g', min: 3, location: 'Despensa', lots: [{ quantity: 4, expiresInDays: 700 }] },
  { name: 'Lentejas', food: 'lentejas', category: 'abarrotes', amount: 1, unit: 'kg', location: 'Despensa', lots: [{ quantity: 1 }] },
  // Panadería
  { name: 'Pan de molde integral', brand: 'Ideal', food: 'pan', category: 'panaderia', amount: 720, unit: 'g', location: 'Despensa', lots: [{ quantity: 1, expiresInDays: 5 }] },
  // Carnes (en bandeja: se cuentan como envases)
  { name: 'Pechuga de pollo deshuesada', brand: 'Super Pollo', food: 'pollo', category: 'carnes', amount: 1, unit: 'kg', min: 1, location: 'Congelador', lots: [{ quantity: 2, expiresInDays: 80 }, { quantity: 1, expiresInDays: 1, location: 'Refrigerador' }] },
  { name: 'Carne molida 7% grasa', food: 'carne molida', category: 'carnes', amount: 500, unit: 'g', location: 'Congelador', lots: [{ quantity: 1, expiresInDays: 60 }] },
  { name: 'Vienesas de pollo', brand: 'San Jorge', food: 'vienesas', category: 'carnes', amount: 250, unit: 'g', location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 6 }] },
  // Frutas y verduras: contadas por pieza (unit) o a granel (bulk)
  { name: 'Palta Hass', food: 'palta', category: 'frutas-verduras', amount: 1, unit: 'u', min: 2, location: 'Despensa', lots: [{ quantity: 3 }] },
  { name: 'Tomate', food: 'tomate', category: 'frutas-verduras', amount: 1, unit: 'u', location: 'Despensa', lots: [{ quantity: 4, expiresInDays: 5 }] },
  { name: 'Lechuga escarola', food: 'lechuga', category: 'frutas-verduras', amount: 1, unit: 'u', location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 3 }] },
  { name: 'Brócoli', food: 'brócoli', category: 'frutas-verduras', amount: 1, unit: 'u', location: 'Refrigerador', lots: [{ quantity: 1, expiresInDays: 4 }] },
  { name: 'Plátano', food: 'plátano', category: 'frutas-verduras', amount: 1, unit: 'kg', mode: 'bulk', min: 2, location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Manzana roja', food: 'manzana', category: 'frutas-verduras', amount: 1, unit: 'kg', mode: 'bulk', min: 2, location: 'Despensa', lots: [{ quantity: 2 }] },
  { name: 'Zanahoria', food: 'zanahoria', category: 'frutas-verduras', amount: 1, unit: 'kg', mode: 'bulk', location: 'Refrigerador', lots: [{ quantity: 2 }] },
  { name: 'Papa', food: 'papa', category: 'frutas-verduras', amount: 1, unit: 'kg', mode: 'bulk', min: 2, location: 'Despensa', lots: [{ quantity: 2 }] },
  { name: 'Cebolla', food: 'cebolla', category: 'frutas-verduras', amount: 1, unit: 'kg', mode: 'bulk', location: 'Despensa', lots: [{ quantity: 0 }] },
  // Congelados
  { name: 'Arvejas congeladas', brand: 'Minuto Verde', food: 'arvejas', category: 'congelados', amount: 500, unit: 'g', location: 'Congelador', lots: [{ quantity: 1, expiresInDays: 200 }] },
  // Bebidas
  { name: 'Agua mineral sin gas', brand: 'Cachantun', category: 'bebidas', amount: 1.6, unit: 'L', min: 2, location: 'Despensa', lots: [{ quantity: 3 }] },
  { name: 'Néctar de durazno', brand: "Watt's", food: 'jugo', category: 'bebidas', amount: 1.5, unit: 'L', location: 'Despensa', lots: [{ quantity: 1, expiresInDays: 90 }] },
  // Colaciones
  { name: 'Galletas de soda', brand: 'McKay', food: 'galletas', category: 'colaciones', amount: 150, unit: 'g', location: 'Despensa', lots: [{ quantity: 3, expiresInDays: 120 }] },
  // Limpieza e higiene
  { name: 'Lavalozas limón', brand: 'Quix', category: 'limpieza', amount: 750, unit: 'ml', min: 1, location: 'Despensa', lots: [{ quantity: 1 }] },
  { name: 'Papel higiénico doble hoja', brand: 'Elite', category: 'higiene', amount: 12, unit: 'u', min: 1, location: 'Despensa', lots: [] },
  { name: 'Pasta dental infantil', brand: 'Colgate', category: 'higiene', amount: 50, unit: 'g', location: 'Despensa', lots: [{ quantity: 1 }] },
]

/** Contraseña de las cuentas de ejemplo (solo desarrollo). */
export const SEED_PASSWORD = 'rendi1234'

export interface SeedMember {
  name: string
  /** Solo adultos: crea una cuenta con este usuario y `SEED_PASSWORD`. */
  username?: string
  kind: 'adult' | 'child'
  birthDate?: string
  notes?: string
  avatarEmoji?: string
  accepts?: string[]
  rejects?: (string | { food: string; notes: string })[]
}

export const MEMBERS: SeedMember[] = [
  { name: 'Camila', kind: 'adult', username: 'camila', avatarEmoji: '🌻' },
  { name: 'Diego', kind: 'adult', username: 'diego', avatarEmoji: '☕' },
  {
    name: 'Sofía',
    kind: 'child',
    avatarEmoji: '🦄',
    birthDate: '2020-03-14',
    notes: 'Come verduras solo si van molidas en la salsa o en puré.',
    accepts: ['arroz', 'fideos', 'pollo', 'plátano', 'manzana', 'yogur', 'palta', 'huevo'],
    rejects: ['brócoli', 'tomate', 'cebolla', 'pescado'],
  },
  {
    name: 'Tomás',
    kind: 'child',
    avatarEmoji: '🦖',
    birthDate: '2022-05-02',
    notes: 'No le gusta que los alimentos se toquen en el plato.',
    accepts: ['fideos', 'vienesas', 'huevo', 'plátano', 'leche', 'pan', 'quesillo'],
    rejects: [
      'carne molida',
      'lechuga',
      'palta',
      'lentejas',
      { food: 'zanahoria', notes: 'Cruda no; cocida en puré a veces.' },
    ],
  },
]

/** Ítems manuales de la lista (los automáticos se calculan según el stock mínimo). */
export type SeedListItem = ({ freeText: string } | { food: string } | { product: string }) & {
  note?: string
  quantity?: number
}

export const MANUAL_LIST_ITEMS: SeedListItem[] = [
  { freeText: 'Pan amasado', note: 'De la panadería', quantity: 10 },
  { freeText: 'Velas de cumpleaños' },
  { food: 'pescado', note: 'Merluza o reineta, lo que esté fresco' },
  { product: 'Yogur batido frutilla', quantity: 6 },
]
