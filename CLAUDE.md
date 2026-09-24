# Rendi — contexto del proyecto

Aplicación web (PWA, mobile-first) para organizar la alimentación y las compras de un hogar.
Se usa principalmente desde el celular, incluso dentro del supermercado.
**Leer este archivo al iniciar cada sesión.** Actualizarlo al terminar cada paso importante.

## Contexto del hogar

- 4 personas: dos adultos (ambos con cuenta y permisos completos) y dos niños (4 y 6 años),
  que son sub-perfiles sin login. Los niños son selectivos con la comida: sus preferencias
  (acepta / rechaza / notas) son clave para el futuro planificador de menús.
- Chillán, Chile. Moneda CLP (enteros, sin decimales). Interfaz en español de Chile.
  Zona horaria `America/Santiago`.
- Supermercados:
  | Nombre   | Precios en línea | Notas                                                       |
  | -------- | ---------------- | ----------------------------------------------------------- |
  | Lider    | sí               | compra principal                                            |
  | Jumbo    | sí               | compra principal                                            |
  | Alvi     | no (presencial)  | mayorista: packs → comparar por precio unitario normalizado |
  | aCuenta  | no (presencial)  |                                                             |
  | Super 10 | no (presencial)  |                                                             |
  | Ganga    | no (presencial)  |                                                             |
  | Cugat    | no (presencial)  |                                                             |

## Stack

- **Monorepo** pnpm workspaces (pnpm 10, Node ≥ 22). **TypeScript fijado en `~6.0.3`**:
  TS 7 (compilador nativo) no es compatible con typescript-eslint (`<6.1.0`) ni está garantizado con vue-tsc.
  Revisar al actualizar dependencias.
- **Frontend** `apps/web`: Vue 3 + Vite 8 + TypeScript, Vue Router. PWA con vite-plugin-pwa (paso 7).
  Por agregar: TanStack Query (estado del servidor, actualizaciones optimistas), Pinia (mínimo),
  `barcode-detector` (escáner EAN: API nativa o zxing-cpp WASM servido localmente), lucide-vue-next.
- **Backend** `apps/api`: Hono sobre `@hono/node-server`. Validación con Zod 4 (`@hono/zod-validator`).
  Build con tsdown → `dist/server.mjs` (las dependencias npm quedan externas; `@rendi/*` se incluye en el bundle).
- **Base de datos**: SQLite con better-sqlite3 + Drizzle ORM; migraciones SQL versionadas con drizzle-kit (paso 2).
- **Auth**: usuario/contraseña, Argon2id (`@node-rs/argon2`), sesiones propias en tabla `sessions`
  (se guarda el hash SHA-256 del token), cookie `HttpOnly; Secure; SameSite=Lax`, 30 días deslizantes.
  Sin registro público: los usuarios se crean por CLI.
- **Compartido** `packages/shared`: tipos de dominio, esquemas Zod, unidades y normalización, formato CLP.
  Es solo código fuente (sin build); Vite y tsdown lo compilan.
- Tests: Vitest. Lint: ESLint (flat config) + Prettier.

## Estructura

```
apps/api/src/
  app.ts            composición de rutas; exporta `AppType` para el cliente RPC
  server.ts         arranque HTTP
  env.ts            configuración validada con Zod (.env)
  modules/<dominio>/  routes.ts · service.ts · repo.ts (+ tests)
  db/               schema/ (un archivo por módulo), client.ts, migrate.ts, seed/   (paso 2)
  lib/              utilidades transversales (errores, ids, tiempo, sesión)
  cli/              comandos (crear usuario, reset de contraseña)
apps/api/drizzle/   migraciones SQL generadas (se commitean)
apps/web/src/
  features/<dominio>/  pages/, components/, queries.ts
  components/ui/    componentes base
  composables/      useTheme, etc.
  lib/api.ts        cliente `hc<AppType>` tipado
  styles/           tokens.css (claro/oscuro), base.css
packages/shared/src/  units.ts, money.ts, stock.ts, ...
deploy/             rendi.service, script de respaldo, crontab de ejemplo (paso 7)
```

## Convenciones

- Código e identificadores en inglés; textos de UI, comentarios y documentación en español de Chile.
- Prettier: sin punto y coma, comillas simples, 100 columnas.
- `import type` obligatorio para importaciones solo de tipos.
- Dependencias entre paquetes: `web → shared`, `api → shared`, y `web` importa **solo tipos** de `@rendi/api/app`.
- Dentro de la API, un módulo usa otro solo a través de su `service`, nunca tocando sus tablas.
- Todas las rutas de la API cuelgan de `/api`. En desarrollo, Vite hace de proxy de `/api` → `127.0.0.1:3000`.
- IDs: UUIDv7 en texto (pueden generarse en el cliente para la cola offline).
  Timestamps: enteros en ms UTC. Fechas de calendario (vencimientos, semanas): texto `YYYY-MM-DD` en hora de Chile.
  Dinero: CLP enteros. Cantidades: `real`.
- Tema: tokens CSS en `:root`; modo oscuro con `prefers-color-scheme` o forzado con `data-theme` en `<html>`.

## Modelo de datos

Las tablas marcadas con _(futura)_ están diseñadas pero **no existen aún**: cada fase crea las suyas
en su propia migración.

**Hogar y personas**

- `households` (name, timezone, currency)
- `members` (household, name, kind `adult|child`, birth_date?, notes?, diet_profile json? ← Fase 5).
  Adultos y niños son todos miembros; un adulto es el que tiene un `user`.
- `users` (member_id único, username, password_hash) · `sessions` (id = sha256 del token, user_id, expires_at)
- `member_food_prefs` (member_id, food_id, stance `accepts|rejects`, notes)

**Catálogo**

- `categories` (globales) · `foods` (alimento genérico: "leche", "brócoli"; lo que usan preferencias y recetas)
- `products` (SKU concreto: name, brand, food_id?, category_id?, content_amount + content_unit `g|kg|ml|L|u`,
  base_unit `g|ml|u` + base_quantity normalizados, **stock_mode `unit|bulk`**, min_stock?, default_location_id?, archived_at?)
- `product_barcodes` (ean, product_id, **pack_count** = 1). Un EAN de pack (p. ej. Alvi 6 × 1 L) apunta al mismo
  producto con pack_count 6. EAN-13 que empiezan con `2` = peso variable: no se tratan como EAN de producto.
- `product_store_refs` (product, supermarket, sku?, url?, receipt_alias?) — Fases 3 y 4

**Despensa**

- `locations` (Despensa, Refrigerador, Congelador; el usuario puede agregar más)
- `stock_items` = lotes (product, location, quantity, expires_on?, opened_at?, added_at)
- `stock_movements` (product, stock_item?, delta, reason `purchase|consume|depleted|adjust|receipt`, user, purchase_id?, receipt_id?)

**Compras**

- `shopping_list_items`: **una sola lista permanente por hogar**. Campos: product_id? | food_id? | free_text?,
  quantity?, note?, source `manual|min_stock|menu|lunchbox`, source_ref?, supermarket_id?, checked_at?, checked_by?,
  purchase_id? (se llena al finalizar la compra). Índice único parcial para evitar duplicados automáticos.
- `purchases` (household, supermarket_id, purchased_at, user_id, receipt_id? ← Fase 3)
- `supermarkets` (globales: name, slug, has_online_prices, is_wholesale, website_url?, sort_order, active)

**Precios (Fases 2 a 4, futuras)**: `price_observations` (product, supermarket, price_clp, pack_count, is_offer,
regular_price_clp?, observed_on, source `in_store|receipt|manual|scraper`, receipt_id?), `receipts`, `receipt_lines`,
`ai_calls`, vista `v_latest_unit_prices`.

**Menús (Fases 5 a 7, futuras)**: `recipes`, `recipe_ingredients` (→ foods), `meal_plans`, `meal_plan_entries`
(meal `desayuno|almuerzo|once|cena|colacion`, member_id? → colaciones por niño), `meal_plan_entry_items`,
`meal_plan_variants`.

## Reglas de negocio (Fase 1)

- **Conteo de stock, modo `unit`**: cantidades en envases enteros (entero ≥ 0). "Usé uno" descuenta un envase del
  lote que vence primero (FEFO). Para contar piezas sueltas (tomates, paltas), el producto va en modo `unit`.
- **Conteo de stock, modo `bulk`** (fruta y verdura suelta): solo un nivel, Hay (2) / Queda poco (1) / Se acabó (0).
  Se guarda como cantidad para compartir la regla del mínimo, pero **no es un conteo**: el valor está limitado a
  0, 1 o 2, un producto `bulk` tiene a lo más un lote, y el "ajuste manual" es solo elegir uno de los tres niveles.
  Nunca se registran gramos. Validación en `packages/shared/src/stock.ts` (`stockQuantitySchema`, `minStockSchema`),
  usada por la API y por los formularios; la UI de `bulk` muestra tres botones, nunca un input numérico.
- **Cambio de modo** de un producto: `unit → bulk` consolida en un solo lote con nivel 2 si había stock, o 0 si no;
  `bulk → unit` exige ingresar el conteo.
- **Stock mínimo**: se repone cuando `stock total < min_stock`. `unit`: null o entero ≥ 1. `bulk`: null o 2, que se
  muestra como el switch "agregar a la lista cuando quede poco". Tras cada movimiento, `shopping` agrega el ítem
  automático si falta, o lo retira si el stock se repuso y el ítem no estaba marcado. Los ítems manuales nunca se tocan.
- **Acciones rápidas**: usé uno, se acabó, compré, con toast "Deshacer" durante 5 s (revierte el movimiento).
- **Varios compradores a la vez**: cada ítem marcado guarda `checked_by`, y la UI muestra quién lo marcó.
  **Finalizar compra** toma solo los ítems marcados por el usuario que finaliza (`checked_by = usuario actual`):
  elige el supermercado → se crea `purchase` → esos ítems reciben purchase_id, pasan al stock y salen de la lista.
  Lo marcado por otra persona y lo no marcado siguen en la lista.
- **Offline**: solo marcar/desmarcar ítems de la lista funciona sin conexión (cola local; se sincroniza
  "estado en el instante T", última escritura gana). El resto requiere red.
- **Open Food Facts**: al escanear un EAN desconocido se consulta (opcional, con timeout corto) para prellenar
  el formulario. Nunca bloquea la creación manual.

## Decisiones de arquitectura

- **Hono sobre Fastify**: el cliente RPC `hc<AppType>` da tipos de extremo a extremo sin codegen.
- **Drizzle sobre Kysely**: el esquema en TS es la única fuente de tipos y migraciones SQL generadas y revisables.
- **better-sqlite3**: estable y síncrono (`node:sqlite` sigue experimental). SQLite en modo WAL.
- **Un proceso en producción**: la API sirve también el frontend compilado; `tailscale serve` apunta a un puerto.
- **`foods` separado de `products`**: preferencias, recetas y "¿hay leche?" trabajan sobre alimentos genéricos.
- **Packs en el código de barras o en la observación de precio**, no como productos duplicados.
- **`members` unificado** para adultos y niños (porciones y variantes de menú sobre una sola tabla).
- **Fuentes de precio intercambiables** (futuro): interfaz `PriceSource` en `modules/prices/sources/`,
  todas escriben en `price_observations`.
- **Respaldo**: `sqlite3 .backup` (o `VACUUM INTO`), nunca `cp` del archivo en caliente con WAL.
- **Despliegue**: Ubuntu Server x64, sin Docker, servicio systemd. Se clona el repo y se ejecuta `pnpm install`
  en el servidor (no se copia node_modules). Acceso remoto vía Tailscale (`tailscale serve`, HTTPS).

## Hoja de ruta

| Fase | Descripción                                                                                           | Estado       |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------ |
| 1    | Despensa: catálogo, stock, lista de compras, escáner, vencimientos                                    | **en curso** |
| 2    | Captura rápida de precios en tienda                                                                   | pendiente    |
| 3    | Boletas con foto + extracción con la API de Claude (visión)                                           | pendiente    |
| 4    | Comparación de precios (fuentes intercambiables, precio unitario, total por supermercado, antigüedad) | pendiente    |
| 5    | Perfil alimentario de adultos + planificador semanal de menús con la API de Claude                    | pendiente    |
| 6    | Colaciones escolares lunes a viernes por niño                                                         | pendiente    |
| 7    | Lista de compras generada desde menú y colaciones (necesario − stock)                                 | pendiente    |

### Pasos de la Fase 1

1. ✅ Andamiaje: workspace, tsconfig, lint, paquete `shared` (unidades, CLP, validación de stock por modo), API y web mínimas.
2. ⏳ Base de datos: esquema Drizzle, primera migración, seed chileno.
3. ⏳ Auth + hogar (miembros, preferencias de niños) + shell de la app (layout, navegación).
4. ⏳ Catálogo + escáner EAN (+ Open Food Facts, packs).
5. ⏳ Despensa: lotes, acciones rápidas con deshacer, próximos a vencer.
6. ⏳ Lista de compras: manual + automática, finalizar compra, cola offline de marcado.
7. ⏳ PWA + despliegue: manifest, service worker, build, `rendi.service`, respaldo con cron, README completo.

## Comandos

```bash
pnpm install                 # instalar dependencias
cp apps/api/.env.example apps/api/.env
pnpm dev                     # API (:3000, tsx watch) + web (:5173, proxy /api)
pnpm --filter @rendi/web dev:https   # web con HTTPS autofirmado (cámara desde el celular en la LAN)
pnpm check                   # lint + typecheck + tests
pnpm build                   # web → apps/web/dist, API → apps/api/dist/server.mjs
pnpm --filter @rendi/api start       # arranca la API compilada
```

Migraciones, seed, CLI de usuarios y despliegue: se agregan en los pasos 2, 3 y 7.
