# Avisos de pedidos para administración

## Activación por dispositivo

En `/admin`, inicia sesión con permiso para ver pedidos. Arriba del panel:
**Activar notificaciones → Permitir → Probar aviso**.

- Android: Chrome actualizado. Permitir notificaciones del sitio y de Chrome en Android.
- PC: Chrome, Edge o Firefox. Permitir notificaciones del sitio y del navegador en Windows/macOS. Con el navegador completamente cerrado la entrega depende del sistema y de los procesos en segundo plano; no se garantiza.
- iPhone/iPad (16.4+): Safari → Compartir → Agregar a Inicio. Abrir ese icono, iniciar sesión y activar.
- Habilitar por separado en cada dispositivo. Máximo 5 por administrador y 50 en total.
- Cerrar la página conserva los avisos. Cerrar sesión o «Desactivar aquí» los desactiva en ese navegador.
- No molestar, restricciones de batería, desconexión y cierre forzado pueden impedir o retrasar avisos. Los pedidos en la base de datos siguen siendo la fuente fiable, no las notificaciones.

## Configuración antes de publicar

1. Ejecutar `node scripts/generate-web-push-env.cjs` una sola vez. No muestra secretos y rechaza sobrescribir el archivo existente.
2. Configurar en Vercel **Production** `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` y `WEB_PUSH_SUBJECT` usando los valores del archivo local `.env.web-push.local`. La clave privada debe ser sensible y nunca llevar el prefijo `NEXT_PUBLIC_`. El archivo es de aprovisionamiento: Next.js no lo carga automáticamente.
3. Publicar y activar desde un dispositivo autorizado. No configurar estas claves de producción en previews que compartan la base de datos, para evitar notificaciones por pruebas.
4. Probar el aviso desde Android y PC, con el panel cerrado. Luego comprobar con un pedido real autorizado; no crear pedidos ficticios en producción.

Sin claves, el envío es un no-op y el panel indica que falta configuración. Al primer uso configurado, se crea exclusivamente `AdminPushSubscription` mediante una transacción aditiva, con RLS y sin permisos de `anon`/`authenticated`. No se alteran tablas de pedidos/productos ni se descargan imágenes. La relación con AdminUser elimina suscripciones al eliminar al usuario. Si se requiere desactivar globalmente, retirar las variables y volver a desplegar; no borrar tablas existentes.

## Funcionamiento y límites

- `after()` envía después de guardar pedidos web y manuales. Editar/confirmar no genera un nuevo aviso.
- Web Push cifrado con VAPID, sin plataforma de WhatsApp ni proveedor de pago contratado. Sí consume recursos de ejecución y transferencia del alojamiento.
- Mensaje genérico, sin información personal, total, fotos ni claves. Al pulsar abre `/admin/pedidos`, con autenticación normal.
- El service worker solo procesa notificaciones: no registra `fetch`, no guarda catálogo y no cambia caché de la tienda.
- Usuarios inactivos o sin `orders:view` quedan excluidos antes de enviar; sus suscripciones se eliminan. Joshua mantiene acceso completo.
- Al activar push se suspende el sondeo periódico existente en esa pestaña; los mensajes invalidan consultas del panel. Sin push se conserva el aviso interno anterior.
- Un envío por dispositivo, lotes de 10 y timeout de 5 segundos por envío. Sin cron ni reintentos ilimitados. Fallos de red no anulan pedidos. Entrega best-effort, no garantizada; TTL de una hora.
- 404/410 eliminan suscripciones expiradas. Las URLs de destino se restringen a servicios push conocidos para evitar SSRF. Los endpoints y claves nunca se imprimen en logs.
- Activación/desactivación registrada en AuditLog. Límite de solicitudes y límite de dispositivos. La prueba solo envía al dispositivo del administrador autenticado.

## Verificaciones

Ejecutar `node scripts/test-admin-push.cjs`, ESLint, `npx tsc --noEmit` y `npm run build`.
La recepción real exige permiso explícito del dueño en cada dispositivo; no puede validarse mediante tests simulados.

Referencias: https://github.com/web-push-libs/web-push · https://nextjs.org/docs/app/api-reference/functions/after · https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
