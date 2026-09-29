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
- **Frontend** `apps/web`: Vue 3 + Vite 8 + TypeScript, Vue Router 5, TanStack Query (estado del servidor),
  lucide-vue-next (íconos), @vueuse/core. Sin Pinia: el estado local compartido (toasts, cola offline) son
  módulos con `ref` a nivel de módulo. PWA con vite-plugin-pwa (solo en el build; en `pnpm dev` no hay
  service worker).
- **Escáner**: `barcode-detector` (ponyfill) + `zxing-wasm` 3.1.3 (misma versión que usa barcode-detector).
  `features/scanner/detector.ts` usa la API nativa si trae EAN (Chrome Android) y si no el ponyfill; el
  `.wasm` se importa con `?url` y se sirve desde la app (nunca CDN: debe funcionar sin internet).
  Formatos: ean_13, ean_8, upc_a. Un código se acepta tras leerlo 2 veces seguidas; vibra y pausa. Al reanudar,
  el código recién aceptado se ignora hasta que falte ~4 fotogramas (sale del cuadro). Un producto conocido
  ofrece "Compré" (suma `pack_count` unidades) y "Usé uno" desde el mismo panel.
  La cámara exige HTTPS (o localhost); sin ella el componente ofrece ingreso manual.
- **Backend** `apps/api`: Hono sobre `@hono/node-server`. Validación con Zod 4 (`@hono/zod-validator`).
  Build con tsdown → `dist/server.mjs` (las dependencias npm quedan externas; `@rendi/*` se incluye en el bundle).
- **Base de datos**: SQLite con better-sqlite3 + Drizzle ORM; migraciones SQL versionadas con drizzle-kit (paso 2).
- **Auth**: usuario/contraseña, Argon2id (`@node-rs/argon2`), sesiones propias en tabla `sessions`
  (se guarda el hash SHA-256 del token), cookie `HttpOnly; Secure; SameSite=Lax`, 30 días deslizantes.
  Sin registro público: un adulto con sesión crea las cuentas de otros adultos desde Hogar (o por CLI).
  Reglas: nadie elimina su propia cuenta y el hogar siempre conserva al menos un adulto; eliminar un adulto
  borra su cuenta y sesiones (cascada). Cambio de contraseña solo por CLI (`pnpm user:passwd`). Login limitado a 5 intentos fallidos por usuario cada 15 min
  (en memoria). CSRF: se rechazan escrituras con `Sec-Fetch-Site` distinto de same-origin/none (independiente
  del Host, funciona detrás de `tailscale serve`). `COOKIE_SECURE` por defecto: true solo en producción.
- **Compartido** `packages/shared`: tipos de dominio, esquemas Zod, unidades y normalización, formato CLP.
  Es solo código fuente (sin build); Vite y tsdown lo compilan.
- Tests: Vitest (unitarios e integración de la API contra SQLite en memoria) y **Playwright** (e2e en Chromium
  con tamaño de celular Pixel 7, locale es-CL, zona America/Santiago). Lint: ESLint (flat config) + Prettier.

## Estructura

```
apps/api/src/
  app.ts            composición de rutas; exporta `AppType` para el cliente RPC
  server.ts         arranque HTTP
  env.ts            configuración validada con Zod (.env)
  modules/<dominio>/  routes.ts · service.ts · repo.ts (+ tests)
  db/
    schema/         un archivo por módulo (+ _columns.ts con helpers de columnas)
    client.ts       createDb(path) con pragmas; tipos Db, Tx, DbOrTx
    migrate.ts      runMigrations (con respaldo VACUUM INTO previo si hay pendientes)
    migrate-cli.ts  pnpm db:migrate
    seed/           data.ts (datos de ejemplo) + index.ts (seed, db:seed, db:reset)
  test/db.ts        createTestDb(): SQLite en memoria con todas las migraciones
  lib/              context.ts (AppEnv/AuthEnv), errors.ts (AppError + handleError), validation.ts (validate),
                    csrf.ts, rate-limit.ts
  cli/              comandos (crear usuario, reset de contraseña)
apps/api/drizzle/   migraciones SQL generadas (se commitean)
apps/web/src/
  features/<dominio>/  pages/, components/, queries.ts
  components/ui/    componentes base
  composables/      useTheme, etc.
  lib/api.ts        cliente `hc<AppType>` tipado
  styles/           tokens.css (claro/oscuro), base.css
packages/shared/src/  units.ts, money.ts, stock.ts, ...
deploy/             rendi.service, backup.sh, update.sh, crontab.example
```

## Convenciones

- Código e identificadores en inglés; textos de UI, comentarios y documentación en español de Chile.
- Prettier: sin punto y coma, comillas simples, 100 columnas.
- **Nombres visibles** se normalizan al guardar (funciones de `packages/shared/src/text.ts`, aplicadas en los
  esquemas Zod y al crear desde servicios/CLI/seed):
  - Personas: `capitalizePersonName`, mayúscula en cada palabra y tras guion, salvo las partículas
    de/del/la/las/los/y/e fuera del comienzo ("María de los Ángeles", "Ana-María").
  - Alimentos, productos y hogar: `capitalizeFirst`, solo la primera letra ("Zapallo italiano").
  - Los usernames se guardan en minúsculas.
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
- `members` (household, name, kind `adult|child`, birth_date?, notes?, avatar_emoji?, diet_profile json? ← Fase 5).
  `avatar_emoji`: exactamente un emoji RGI (`avatarEmojiSchema` en shared), o null = inicial del nombre.
  Adultos y niños son todos miembros; un adulto es el que tiene un `user`.
- `users` (member_id único, username, password_hash) · `sessions` (id = sha256 del token, user_id, expires_at)
- `member_food_prefs` (member_id, food_id, stance `accepts|rejects`, notes)

**Catálogo** (API en `modules/catalog`: products.ts, foods.ts, lookup/)

- `categories` (globales) · `foods` (alimento genérico: "leche", "brócoli"; lo que usan preferencias y recetas)
- `products` (SKU concreto: name, brand, food_id?, category_id?, content_amount + content_unit `g|kg|ml|L|u`,
  base_unit `g|ml|u` + base_quantity normalizados, **stock_mode `unit|bulk`**, min_stock?, default_location_id?, archived_at?)
- `product_barcodes` (ean, product_id, **pack_count** = 1). Un EAN de pack (p. ej. Alvi 6 × 1 L) apunta al mismo
  producto con pack_count 6. EAN-13 que empiezan con `2` = peso variable: no se tratan como EAN de producto.
- `product_store_refs` (product, supermarket, sku?, url?, receipt_alias?) — Fases 3 y 4

**Despensa**

- `locations` (Despensa, Refrigerador, Congelador; el usuario puede agregar más)
- `stock_items` = lotes (product, location, quantity, expires_on?, opened_at?, added_at)
- `stock_movements` (action_id, product, stock_item?, delta, reason `purchase|consume|depleted|adjust|receipt`, user?,
  purchase_id?, undone_at?). `action_id` agrupa los movimientos de una acción rápida para deshacerlos juntos.
  `receipt_id` se agrega en la Fase 3.

**Compras**

- `shopping_list_items`: **una sola lista permanente por hogar**. Campos: product_id? | food_id? | free_text?,
  quantity?, note?, source `manual|min_stock|menu|lunchbox`, source_ref?, supermarket_id?, checked_at?, checked_by?,
  check_updated_at? (instante del cliente, para la cola offline), purchase_id? (se llena al finalizar la compra),
  added_by?. Índice único parcial: un solo ítem `min_stock` abierto por producto. CHECK: exactamente un destino.
- `purchases` (household, supermarket_id, purchased_at, user_id; `receipt_id` se agrega en la Fase 3)
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
  `apps/api/src/web.ts` (`withWebApp`): `/api/*` va a la API; el resto, archivos de `WEB_DIST_DIR` (por defecto
  `../web/dist` en producción, nada en desarrollo) con fallback a index.html para rutas sin extensión.
  `/assets/*` (con hash) se guardan un año; index.html, sw.js y manifest llevan `no-cache`.
- **PWA** (`vite.config.ts`): manifest (íconos en `apps/web/public`, maskable con margen), precaché de todo el build
  incluido el WASM del escáner, fallback de navegación a index.html. Caché de API `rendi-api` (NetworkFirst, 4 s)
  solo para lo que necesita la lista sin conexión: `/api/auth/me`, `/api/shopping/items`, `/api/shopping/supermarkets`,
  `/api/catalog/categories`; `clearCachedData` la borra al cerrar sesión. `registerType: 'prompt'`: una versión
  nueva se ofrece con un toast persistente "Actualizar" (`src/pwa.ts`), nunca recarga sola.
- **`foods` separado de `products`**: preferencias, recetas y "¿hay leche?" trabajan sobre alimentos genéricos.
- **Packs en el código de barras o en la observación de precio**, no como productos duplicados.
- **`members` unificado** para adultos y niños (porciones y variantes de menú sobre una sola tabla).
- **Búsqueda externa por código** (`modules/catalog/lookup/`): interfaz `ProductLookup` inyectada en
  `createApp({ productLookup })` y disponible como `c.var.productLookup`. Implementación: Open Food Facts
  (consulta desde el servidor, timeout 2,5 s, caché 24 h en memoria, nunca lanza). `OPEN_FOOD_FACTS=false` la
  desactiva (las e2e la desactivan). Mismo patrón que tendrán las fuentes de precio.
- **Productos**: se archivan (`archived_at`), no se borran, para conservar historial. La búsqueda acepta
  texto sin tildes o un EAN exacto. Cambio de modo con stock: `pantry/service.convertStockMode` en la misma
  transacción (unit→bulk antes de cambiar el modo: consolida en un lote nivel 2/0; bulk→unit después: exige
  `unitCount` si había stock).
- **Despensa** (`modules/pantry`): `service.ts` = funciones de bajo nivel sin dependencia del catálogo
  (ubicaciones, totales, lotes, orden FEFO, `convertStockMode`); `stock.ts` = acciones (usé uno, se acabó, compré,
  nivel a granel, ajuste de lote, deshacer, por vencer), que obtienen el producto vía `catalog/products`
  (`getProductRef`, `listProductRefs`). Así no hay importación circular: `catalog → pantry/service` y
  `pantry/stock → catalog`. Cada acción devuelve `{ actionId, stock }`; `actionId` es null si nada cambió.
  "Compré" en `unit` suma a un lote igual (misma ubicación y vencimiento, sin abrir) o crea uno; en `bulk` deja
  el nivel en Hay. Deshacer marca `undone_at` y revierte los deltas; el servidor lo acepta hasta 10 min
  (`UNDO_WINDOW_MS`) y responde 409 `undo_conflict` si el resultado ya no es válido. Los lotes en 0 no se
  borran (se ocultan). "Por vencer" = lotes con stock y vencimiento hasta hoy + 30 días, incluidos los vencidos.
- **Lista de compras** (`modules/shopping`): `auto.ts` = regla del mínimo (`syncMinStockItem`), sin
  dependencias: quien la llama entrega el mínimo y el stock total. La llaman `catalog/products` (crear, editar,
  archivar) y `pantry/stock` (cada acción y deshacer, vía `settle`). No duplica: si el producto ya está en la
  lista como ítem manual, no agrega el automático. Si alguien borra un ítem automático y el producto sigue bajo
  el mínimo, vuelve con el próximo movimiento. `service.ts` = lista (nombres vía catalog/household), agregar
  (409 `already_listed` si el producto o alimento ya está), editar, quitar, marcar y finalizar. Marcar: última
  escritura gana según `at` del cliente (un `at` futuro se limita a ahora). Finalizar: primero cierra los ítems
  (`purchase_id`) y después pasa los productos al stock con `pantry/stock.purchase(..., purchaseId)`; cantidad =
  `quantities[itemId]` ?? cantidad del ítem ?? 1 (la UI sugiere lo que falta para el mínimo).
- **Fuentes de precio intercambiables** (futuro): interfaz `PriceSource` en `modules/prices/sources/`,
  todas escriben en `price_observations`.
- **Migraciones**: se generan con drizzle-kit y se commitean; **nunca editar una migración ya aplicada**, crear otra.
  Lo que drizzle-kit no expresa (triggers, datos de referencia) va en migraciones `--custom`:
  `0004_member_avatar` (columna avatar_emoji), `0003_capitalize_names` (mayúscula inicial en nombres existentes, con mapeo manual de á/é/í/ó/ú/ü/ñ porque
  `upper()` de SQLite solo convierte ASCII), `0001_stock_mode_guards` (triggers de invariantes de stock; errores con prefijo estable `stock_bulk_level`,
  `stock_unit_integer`, `stock_bulk_single_lot`) y `0002_reference_data` (categorías y supermercados, ids = slugs).
  La API aplica las pendientes al arrancar; en producción, antes crea `data/pre-migration-<fecha>.db`.
  Nota: la tabla `__drizzle_migrations` deja `id` en NULL; se identifica cada migración por `created_at`.
- **Columnas**: casing `snake_case` automático (en TS se escribe camelCase). Timestamps con `mode: 'timestamp_ms'`
  (se exponen como `Date`).
- **Inyección de dependencias**: `createApp({ db, config })`; los handlers leen `c.var.db` y `c.var.config`.
  Rutas protegidas: `new Hono<AuthEnv>().use(requireAuth)` → `c.var.user` (SessionUser con householdId).
  **Todo acceso a datos se filtra por `c.var.user.householdId`**; un recurso de otro hogar responde 404.
- **Errores**: la API siempre responde `{ error: { code, message, issues? } }` (`ApiErrorBody` en shared).
  `AppError(status, code, mensaje)` para errores de dominio; los triggers de SQLite se traducen a 422 y los UNIQUE
  a 409. Zod usa el locale español (`z.config(z.locales.es())` en API y web). En el frontend, `apiFetch` lanza
  `ApiError`, y `call(api.x.$get())` devuelve el cuerpo de éxito ya tipado. Un 401 `unauthenticated` redirige
  al login.
- **Frontend**: `features/<dominio>/queries.ts` concentra consultas y mutaciones (TanStack Query) de cada dominio.
  El router verifica la sesión con `ensureQueryData(meQuery)` y la app se monta tras `router.isReady()`.
  Componentes base en `components/ui/`: AppButton, AppCard, TextField (con ojo en contraseñas), SegmentedControl,
  PageHeader, EmptyState, MemberAvatar (emoji o inicial; úsalo donde se muestre una persona: quién marcó un ítem,
  menús, colaciones) y BottomSheet (`<dialog>` nativo con showModal: foco, Escape y fondo sin librerías).
  Selector de avatar: grilla curada `AVATAR_EMOJI_GROUPS` (shared) + campo libre; sin librería de emojis.
  La regex `\p{RGI_Emoji}` (flag v) se construye en tiempo de ejecución con fallback: navegadores antiguos no
  validan en el cliente y decide el servidor.
  Barra inferior: Despensa · Lista · Escanear (botón central) · Vence · Hogar.
  Las páginas usan `mutate(..., { onSuccess })` (o `mutateAsync` dentro de try/catch): el error se muestra
  desde el estado de la mutación y nunca queda una promesa rechazada sin manejar.
  Lista: `features/shopping/checkQueue.ts` es la cola offline (estado de módulo + localStorage, sin Pinia):
  cada toque guarda `{ checked, at }` por ítem y se envía al instante, al volver la red y cada 15 s; `401`/sin
  red la conservan, otro error la descarta. `useShoppingList` superpone las marcas pendientes (ícono "Sin
  sincronizar"). Finalizar vacía la cola antes. La lista se refresca cada 10 s (varios compradores).
  `clearCachedData` también vacía la cola (las marcas son de quien salió).
  Toasts: `showToast` (`composables/useToast.ts`) + `ToastHost` en App.vue (región `status` "Aviso", 5 s).
  Las mutaciones de stock (`features/pantry/queries.ts`, `useStockAction`) muestran "Deshacer" si hay `actionId`.
  Ojo: un toast queda detrás de un `BottomSheet` abierto (top layer): cerrar el panel al terminar la acción.
  Logout: `useLogout` deja `me` en null → navegar al login → `clearCachedData()` (en ese orden).
  Sugerencias y desplegables van en el flujo normal de la página, no flotando: en el celular no deben tapar
  botones de acción.
- **E2E del escáner**: proyecto Playwright `scanner` con cámara falsa de Chromium. `e2e/global-setup.ts` genera
  (con zxing-wasm/writer + **ffmpeg**) un video `.y4m` con el EAN `4006381333931` en `e2e/.generated/`. La
  prueba bloquea jsdelivr/unpkg para garantizar que el WASM sale de la app. El resto va en el proyecto `mobile`.
- **E2E** (`e2e/`): levantan su propia API (puerto 3101, `apps/api/data/e2e.db` recreada con el seed) y su propio
  Vite (puerto 5174; `WEB_PORT` y `API_URL` configuran vite.config), así que corren con `pnpm dev` abierto.
  Selectores por rol y nombre accesible (`getByRole`, `getByLabel`), lo que obliga a mantener la accesibilidad.
  `pnpm e2e:screens` guarda capturas claro/oscuro en `test-results/screens/` para revisión visual: **revisarlas
  antes de dar por terminado un paso con cambios de UI.** Para paneles o diálogos animados usar
  `animations: 'disabled'` en la captura, o saldrán semitransparentes. `pnpm e2e` borra `test-results/`. Las capturas `fullPage` muestran la barra inferior
  fija a media página: es un artefacto de la captura, no un bug. Los servicios reciben
  `DbOrTx` para poder componerse dentro de una transacción (better-sqlite3 es síncrono: transacciones síncronas).
- **Base de desarrollo** (`apps/api/data/rendi.db`): contiene datos ingresados a mano por el usuario. **Nunca
  resetearla**; aplicar migraciones con `pnpm db:migrate`. Para verificar, usar `data/e2e.db` o una base temporal.
- **Seed** sin códigos de barra (inventarlos podría chocar con EAN reales). Nombres de miembros ficticios.
- **better-sqlite3 se compila desde el código fuente** con node-gyp en la instalación: el servidor necesita
  `build-essential` y `python3` antes de `pnpm install`.
- **Respaldo**: `sqlite3 .backup` (o `VACUUM INTO`), nunca `cp` del archivo en caliente con WAL.
- **Despliegue**: Ubuntu Server x64, sin Docker, servicio systemd. Se clona el repo en `/opt/rendi` (usuario de
  sistema `rendi`, home en `/var/lib/rendi`) y se ejecuta `pnpm install` + `pnpm build` en el servidor (no se copia
  node_modules). `rendi.service` endurecido (solo escribe en `apps/api/data`). Acceso remoto vía Tailscale
  (`tailscale serve --bg 3000`, HTTPS válido, sin exponer a internet); en producción `HOST=127.0.0.1` y la cookie
  exige HTTPS. `deploy/update.sh` (admin con sudo): respaldo → pull → install → build → restart. Guía completa en
  el README.
- **E2E de producción** (`pnpm e2e:prod`, `playwright.prod.config.ts`, `e2e/prod/`): compila, siembra
  `data/e2e-prod.db` y levanta `node dist/server.mjs` con NODE_ENV=production y `COOKIE_SECURE=false` (puerto 3102).
  Prueba el service worker: la lista abre y se marca sin conexión, y cerrar sesión borra `rendi-api`.
  `pnpm e2e` no incluye esta carpeta.

## Hoja de ruta

| Fase | Descripción                                                                                           | Estado       |
| ---- | ----------------------------------------------------------------------------------------------------- | ------------ |
| 1    | Despensa: catálogo, stock, lista de compras, escáner, vencimientos                                    | ✅ terminada |
| 2    | Captura rápida de precios en tienda                                                                   | pendiente    |
| 3    | Boletas con foto + extracción con la API de Claude (visión)                                           | pendiente    |
| 4    | Comparación de precios (fuentes intercambiables, precio unitario, total por supermercado, antigüedad) | pendiente    |
| 5    | Perfil alimentario de adultos + planificador semanal de menús con la API de Claude                    | pendiente    |
| 6    | Colaciones escolares lunes a viernes por niño                                                         | pendiente    |
| 7    | Lista de compras generada desde menú y colaciones (necesario − stock)                                 | pendiente    |

### Pasos de la Fase 1

1. ✅ Andamiaje: workspace, tsconfig, lint, paquete `shared` (unidades, CLP, validación de stock por modo), API y web mínimas.
2. ✅ Base de datos: esquema Drizzle (15 tablas), migraciones 0000–0002, seed chileno, tests de invariantes.
3. ✅ Auth (login, sesiones, CLI de usuarios) + hogar (crear/eliminar adultos y niños, preferencias acepta/rechaza
   con notas) + shell de la app + e2e con Playwright.
4. ✅ Catálogo (crear/editar/archivar, búsqueda, códigos con packs) + escáner EAN (cámara + manual) + Open Food Facts.
5. ✅ Despensa: lotes (FEFO, ajuste manual), acciones rápidas con deshacer (detalle, lista y escáner), por vencer.
6. ✅ Lista de compras: manual + automática (stock mínimo), varios compradores, finalizar compra, cola offline.
7. ✅ PWA (manifest, service worker, lista sin conexión, aviso de versión nueva) + despliegue (API sirve la app,
   `rendi.service`, respaldo con cron, `update.sh`, README completo).

## Flujo de trabajo con git

- **Una rama por paso** desde la Fase 2: `faseN/paso-M-descripcion` (p. ej. `fase2/paso-1-captura-precios`),
  creada desde `main` actualizado. Los commits del paso van en esa rama (Conventional Commits, en español).
- **Al terminar un paso** (verificado: `pnpm check`, `pnpm e2e`, capturas si hubo UI): merge a `main` con
  `git merge --no-ff` y mensaje `Fin de la Fase N, paso M: <resumen>`; después tag anotado `faseN-pasoM`
  sobre ese merge. La rama se puede borrar tras el merge.
- **Versiones** (tags anotados `vX.Y.Z`): cada fase terminada sube el menor (Fase 1 = `v0.1.0`, Fase 2 = `v0.2.0`);
  correcciones posteriores, el parche (`v0.1.1`). `v1.0.0` cuando se decida que está en uso real.
- La Fase 1 se hizo con commits directos a `main`; sus tags (`fase1-paso1` … `fase1-paso7`, `v0.1.0`) se
  agregaron después sobre esos commits.
- **Push solo cuando el usuario lo pida.** `origin` publica en GitHub y GitLab; los tags requieren
  `git push --follow-tags` (o `--tags`).

## Comandos

```bash
pnpm install                 # instalar dependencias
cp apps/api/.env.example apps/api/.env
pnpm dev                     # API (:3000, tsx watch) + web (:5173, proxy /api)
pnpm --filter @rendi/web dev:https   # web con HTTPS autofirmado (cámara desde el celular en la LAN)
pnpm check                   # lint + typecheck + tests unitarios/integración
pnpm e2e                     # pruebas end-to-end (Playwright, Chromium)
pnpm e2e:screens             # capturas claro/oscuro en test-results/screens/
pnpm e2e:prod                # compila y prueba el build de producción (service worker, sin conexión)
pnpm exec playwright install chromium   # una vez por equipo (~115 MB en ~/.cache/ms-playwright)
# las e2e del escáner requieren ffmpeg instalado en el sistema
pnpm build                   # web → apps/web/dist, API → apps/api/dist/server.mjs
pnpm --filter @rendi/api start       # arranca la API compilada
```

Base de datos (desde la raíz; rutas relativas a `apps/api`):

```bash
pnpm --filter @rendi/api db:generate   # genera una migración a partir de cambios en src/db/schema
pnpm --filter @rendi/api db:generate --custom --name <nombre>   # migración SQL manual (triggers, datos)
pnpm --filter @rendi/api db:migrate    # aplica migraciones pendientes (la API también lo hace al arrancar)
pnpm --filter @rendi/api db:seed       # siembra datos de ejemplo si la base está vacía (no en producción)
pnpm --filter @rendi/api db:reset      # borra la base, migra y siembra (no en producción)
pnpm --filter @rendi/api db:studio     # explorador visual de Drizzle
```

Cuentas (no hay registro público; piden los datos de forma interactiva):

```bash
pnpm user:create     # crea un adulto con cuenta (y el hogar, si no existe)
pnpm user:passwd     # cambia la contraseña y cierra las sesiones de ese usuario
pnpm user:list
```

Seed de desarrollo: usuarios `camila` y `diego`, contraseña `rendi1234`. También existen atajos en la raíz:
`pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`. Despliegue, Tailscale, respaldos y restauración: README.
