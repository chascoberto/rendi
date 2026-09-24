# Rendi

Organizador de alimentación y compras del hogar: despensa, lista de compras y, más adelante,
precios, boletas y menús. PWA mobile-first.

> Documentación en construcción. Instalación en desarrollo, despliegue en Ubuntu Server con systemd,
> Tailscale Serve y respaldos se completan en el paso 7 de la Fase 1. Ver `CLAUDE.md`.

## Desarrollo

Requisitos: Node ≥ 22 y pnpm 10.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm dev        # API en :3000, web en http://localhost:5173
pnpm check      # lint + typecheck + tests
```
