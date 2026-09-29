# Rendi

Organizador de alimentación y compras del hogar: despensa con vencimientos, lista de compras
compartida (que se llena sola con lo que falta) y escáner de códigos de barras. Más adelante:
precios, boletas y menús. Es una PWA pensada para el celular, incluso dentro del supermercado.

- Un solo proceso Node sirve la API y la app; la base es un archivo SQLite.
- Acceso remoto privado y con HTTPS mediante [Tailscale](https://tailscale.com) (`tailscale serve`).
- Contexto del proyecto, decisiones y reglas de negocio: [`CLAUDE.md`](CLAUDE.md).

## Contenido

- [Desarrollo](#desarrollo)
- [Despliegue en Ubuntu Server](#despliegue-en-ubuntu-server)
- [Acceso con Tailscale (HTTPS)](#acceso-con-tailscale-https)
- [Cuentas](#cuentas)
- [Actualizar](#actualizar)
- [Respaldos y restauración](#respaldos-y-restauración)
- [Instalar la app en el celular](#instalar-la-app-en-el-celular)
- [Problemas frecuentes](#problemas-frecuentes)

## Desarrollo

Requisitos: Node ≥ 22, pnpm 10, `build-essential` y `python3` (better-sqlite3 se compila al
instalar). Para las e2e del escáner, `ffmpeg`.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:seed          # datos de ejemplo: usuarios camila y diego, contraseña rendi1234
pnpm dev              # API en :3000, web en http://localhost:5173 (proxy de /api)
```

| Comando                                    | Qué hace                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm check`                               | lint + tipos + tests unitarios e integración                                |
| `pnpm e2e`                                 | pruebas end-to-end en Chromium con tamaño de celular (API y web propias)    |
| `pnpm e2e:screens`                         | capturas claro/oscuro en `test-results/screens/`                            |
| `pnpm e2e:prod`                            | compila y prueba el build de producción (service worker, uso sin conexión)  |
| `pnpm build`                               | web → `apps/web/dist`, API → `apps/api/dist/server.mjs`                     |
| `pnpm --filter @rendi/web dev:https`       | web con HTTPS autofirmado, para probar la cámara desde el celular en la LAN |
| `pnpm db:migrate` / `db:seed` / `db:reset` | migraciones y datos de ejemplo (`db:reset` borra la base)                   |

La primera vez: `pnpm exec playwright install chromium`.

## Despliegue en Ubuntu Server

Sin Docker: se clona el repo en el servidor, se instala y compila allí, y systemd mantiene el
proceso. Los pasos suponen `/opt/rendi` y un usuario de sistema `rendi`.

### 1. Requisitos

```bash
sudo apt update
sudo apt install -y git build-essential python3 sqlite3 curl
# Node 22 (NodeSource) y pnpm (vía corepack)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
```

### 2. Usuario y código

```bash
# El home del usuario va aparte, para que las cachés de pnpm/corepack no queden dentro del repo.
sudo useradd --system --create-home --home-dir /var/lib/rendi --shell /bin/bash rendi
sudo mkdir /opt/rendi && sudo chown rendi: /opt/rendi
sudo -u rendi git clone <URL-del-repo> /opt/rendi
cd /opt/rendi
sudo -u rendi pnpm install --frozen-lockfile     # compila better-sqlite3
sudo -u rendi pnpm build
```

### 3. Configuración

```bash
sudo -u rendi cp apps/api/.env.example apps/api/.env
sudo -u rendi nano apps/api/.env
```

Valores para producción:

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATABASE_PATH=./data/rendi.db
MIGRATIONS_DIR=./drizzle
OPEN_FOOD_FACTS=true
```

`HOST=127.0.0.1` es intencional: solo `tailscale serve` llega a la app. La cookie de sesión exige
HTTPS en producción, así que **no funciona abriendo `http://ip-del-servidor:3000`**.

### 4. Primera cuenta

No hay registro público. La primera cuenta crea también el hogar:

```bash
cd /opt/rendi
sudo -u rendi pnpm user:create
```

Las demás cuentas de adultos se crean desde la app (Hogar → Agregar adulto) o con el mismo comando.

### 5. Servicio

```bash
sudo cp deploy/rendi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rendi
systemctl status rendi
journalctl -u rendi -f          # logs
curl http://127.0.0.1:3000/api/system/health
```

El servicio usa `/usr/bin/node` (NodeSource). Si Node está en otra ruta, ajusta `ExecStart`.
Solo puede escribir en `apps/api/data` (`ProtectSystem=strict`).

## Acceso con Tailscale (HTTPS)

1. Instala Tailscale en el servidor y en cada celular, con la misma cuenta:

   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

2. En el [panel de Tailscale](https://login.tailscale.com/admin/dns) activa **MagicDNS** y
   **HTTPS Certificates**.
3. Publica la app dentro de tu red privada (queda activo tras reiniciar):

   ```bash
   sudo tailscale serve --bg 3000
   tailscale serve status        # muestra la URL, p. ej. https://servidor.tu-red.ts.net
   ```

4. Abre esa URL en el celular (con Tailscale conectado). El certificado es válido, así que la cámara
   funciona sin advertencias, también fuera de casa y con datos móviles.

`tailscale serve` no expone nada a internet: solo los dispositivos de tu red Tailscale la ven.
No uses `tailscale funnel`.

## Cuentas

```bash
sudo -u rendi pnpm user:create    # nuevo adulto con cuenta
sudo -u rendi pnpm user:passwd    # cambiar contraseña (cierra sus sesiones)
sudo -u rendi pnpm user:list
```

Ejecutar desde `/opt/rendi` (toman la configuración de `apps/api/.env`). Los niños no tienen cuenta: se agregan desde Hogar.

## Actualizar

Como administrador (con sudo):

```bash
/opt/rendi/deploy/update.sh    # respaldo + git pull + install + build + reinicio
```

Los pasos del repo corren como `rendi`; solo el reinicio usa sudo. Al arrancar, la API aplica las
migraciones pendientes y antes guarda `apps/api/data/pre-migration-<fecha>.db`.

Los celulares ven un aviso **"Hay una versión nueva de Rendi → Actualizar"**: la app no se recarga
sola para no interrumpir una compra.

## Respaldos y restauración

`deploy/backup.sh` usa `sqlite3 .backup` (seguro con la base en uso; **nunca copies el archivo con
`cp` mientras corre**), verifica la copia con `integrity_check`, la comprime y conserva las últimas
14 en `/var/backups/rendi`.

```bash
sudo mkdir -p /var/backups/rendi && sudo chown rendi: /var/backups/rendi
sudo -u rendi /opt/rendi/deploy/backup.sh                 # probarlo una vez
sudo crontab -u rendi /opt/rendi/deploy/crontab.example   # diario a las 03:30
```

Variables opcionales: `RENDI_DB`, `RENDI_BACKUP_DIR`, `RENDI_BACKUP_KEEP`.
Recomendado: copiar `/var/backups/rendi` a otro equipo (rsync, rclone o un disco externo).

Restaurar:

```bash
sudo systemctl stop rendi
cd /opt/rendi/apps/api/data
sudo -u rendi mv rendi.db rendi.db.antes-de-restaurar
sudo -u rendi rm -f rendi.db-wal rendi.db-shm
gunzip -c /var/backups/rendi/rendi-AAAAMMDD-HHMMSS.db.gz | sudo -u rendi tee rendi.db > /dev/null
sudo systemctl start rendi
```

## Instalar la app en el celular

- **Android (Chrome):** abre la URL de Tailscale → menú ⋮ → **Instalar app**.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.

Instalada, abre a pantalla completa y funciona sin conexión en lo esencial: la última lista de
compras se ve y se puede marcar; las marcas se envían solas al volver la señal. Crear productos,
mover stock o finalizar la compra requiere conexión.

## Problemas frecuentes

- **No puedo iniciar sesión en el servidor:** en producción la cookie exige HTTPS. Entra por la URL
  `https://…ts.net`, no por `http://ip:3000`.
- **La cámara no abre:** requiere HTTPS (o `localhost`). Usa la URL de Tailscale; en desarrollo,
  `dev:https`. Siempre queda el ingreso manual del código.
- **`pnpm install` falla compilando better-sqlite3:** faltan `build-essential` y `python3`.
- **El servicio no arranca:** `journalctl -u rendi -n 50`. Revisa `apps/api/.env` y que exista
  `apps/api/dist/server.mjs` (`pnpm build`).
