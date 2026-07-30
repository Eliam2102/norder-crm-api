# Stripe Checkout resiliente — despliegue

## Variables obligatorias en Railway

```env
NODE_ENV=production
PUBLIC_APP_URL=https://crm-norder-health.vercel.app
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_BASICA=...
STRIPE_PRICE_PREMIUM=...
STRIPE_PORTAL_CONFIGURATION_ID=...
```

`PUBLIC_APP_URL` debe ser una sola URL HTTPS. El backend rechaza `localhost`
en producción para evitar crear sesiones con retornos rotos.

## Variable obligatoria en Vercel

```env
VITE_API_URL=https://norder-crm-api-production-e521.up.railway.app
```

## Webhook de Stripe

Destino:

```text
https://norder-crm-api-production-e521.up.railway.app/api/webhooks/stripe
```

Eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

El `STRIPE_WEBHOOK_SECRET` debe pertenecer exactamente a este destino y al
mismo modo de Stripe (test o live) que `STRIPE_SECRET_KEY`.

## Portal de actualización de Básico a Premium

La configuración indicada por `STRIPE_PORTAL_CONFIGURATION_ID` debe:

- Tener activada la actualización de suscripciones.
- Incluir los productos y Prices de Básico y Premium.
- Aplicar la política de prorrateo acordada.

El cambio de Básico a Premium usa el flujo alojado
`subscription_update_confirm`, para que Stripe muestre el importe, gestione
prorrateos, fallos y autenticación 3D Secure antes de confirmar.

## Orden de despliegue

1. Desplegar backend para aplicar la migración `stripe_checkout_resilience`.
2. Configurar `PUBLIC_APP_URL` en Railway.
3. Crear o actualizar el webhook en Stripe y guardar su nuevo secret en Railway.
4. Confirmar `VITE_API_URL` en Vercel.
5. Desplegar frontend.

## Prueba de aceptación

Realizarla primero en modo test:

1. Entrar como paciente Gratis y abrir Plan Básico.
2. Usar **Regresar** en Stripe: debe abrir `/norder-health/cancelado`, conservar
   el plan elegido y permitir continuar la misma sesión.
3. Volver al portal y elegir nuevamente el mismo plan: debe regresar al mismo
   `sessionId`, sin crear otro Checkout.
4. Volver al portal y elegir un plan diferente: la sesión abierta anterior
   debe quedar `expired` antes de crear la sesión del plan nuevo. El enlace
   anterior ya no debe aceptar el pago.
5. Si el Checkout anterior está completo pero su pago sigue pendiente, la API
   debe responder `checkout_pendiente` y no crear otra sesión.
6. Completar un pago: Stripe debe regresar con `session_id`; la pantalla solo
   debe decir “confirmado” después de consultar al backend.
7. Reenviar el mismo evento desde Stripe: no debe duplicar la activación.
8. Cortar internet después de pagar y recuperarlo: el webhook debe activar la
   membresía y “Revisar nuevamente” debe mostrarla como confirmada.
9. Confirmar en base de datos nivel, estado, vigencia mensual, customer,
   subscription, checkout y evento procesado.
10. Intentar iniciar otro Checkout con la suscripción activa: debe responder
   `suscripcion_activa` sin crear otro cobro.
