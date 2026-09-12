'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

async function pushAction(action: string, subscription: PushSubscription) {
  const response = await fetch('/api/admin-push', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, subscription: subscription.toJSON() }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'No se pudo configurar el aviso')
  return data
}

export function AdminPushSettings({ onActive }: { onActive: (active: boolean) => void }) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  const [publicKey, setPublicKey] = useState('')
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('Comprobando notificaciones…')
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const manifest = document.createElement('link')
    manifest.rel = 'manifest'; manifest.href = '/admin.webmanifest'; document.head.appendChild(manifest)
    let cancelled = false
    async function check() {
      const compatible = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext
      setSupported(compatible)
      if (!compatible) { setMessage('En iPhone agrega esta página a Inicio y ábrela desde su icono. En otros equipos usa un navegador actualizado.'); setBusy(false); return }
      try {
        const response = await fetch('/api/admin-push', { cache: 'no-store' })
        if (!response.ok) throw new Error('Inicia sesión con permiso para ver pedidos.')
        const data = await response.json()
        if (cancelled) return
        setPublicKey(data.publicKey || '')
        if (!data.publicKey) { setMessage('Pendiente de configurar las claves de notificaciones en el servidor.'); return }
        const registration = await navigator.serviceWorker.getRegistration('/admin')
        const sub = await registration?.pushManager.getSubscription()
        const enabled = sub ? (await pushAction('status', sub)).active : false
        if (!cancelled) { setActive(Boolean(enabled)); onActive(Boolean(enabled)); setMessage(enabled ? 'Avisos activos en este dispositivo.' : 'Recibe avisos aunque cierres la página.') }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'No se pudo comprobar el dispositivo.') }
      finally { if (!cancelled) setBusy(false) }
    }
    void check()
    return () => { cancelled = true; manifest.remove() }
  }, [onActive])

  async function toggle() {
    setBusy(true)
    try {
      if (active) {
        const registration = await navigator.serviceWorker.getRegistration('/admin')
        const sub = await registration?.pushManager.getSubscription()
        if (sub) { await pushAction('disable', sub); await sub.unsubscribe() }
        setActive(false); onActive(false); setMessage('Notificaciones desactivadas en este dispositivo.'); return
      }
      // Keep permission request directly in the click gesture for Safari.
      if (await Notification.requestPermission() !== 'granted') throw new Error('Permite las notificaciones en los ajustes de este sitio y vuelve a intentarlo.')
      const registration = await navigator.serviceWorker.register('/admin-push-sw.js', { scope: '/admin', updateViaCache: 'none' })
      if (!registration.active) await new Promise<void>((resolve, reject) => {
        const worker = registration.installing || registration.waiting
        if (!worker) return reject(new Error('Recarga y vuelve a activar las notificaciones.'))
        const timer = setTimeout(() => reject(new Error('La activación tardó demasiado. Reintenta.')), 15000)
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timer); resolve() }
          else if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('No se pudo activar el dispositivo.')) }
        })
      })
      const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      let sub = await registration.pushManager.getSubscription()
      if (sub) {
        const key = sub.options.applicationServerKey
        if (!key || key.byteLength !== bytes.length || !new Uint8Array(key).every((value, index) => value === bytes[index])) { await sub.unsubscribe(); sub = null }
      }
      sub ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
      await pushAction('enable', sub)
      setActive(true); onActive(true); setMessage('Activadas. Pulsa «Probar aviso» para comprobarlo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron activar las notificaciones.') }
    finally { setBusy(false) }
  }
  async function test() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/admin')
      const sub = await registration?.pushManager.getSubscription()
      if (!sub) throw new Error('Activa de nuevo las notificaciones.')
      await pushAction('test', sub)
      setMessage('Aviso enviado. Si no aparece, revisa los permisos y No molestar del dispositivo.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo enviar el aviso.') }
    finally { setBusy(false) }
  }
  return <section className="mb-4 rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 text-primary" />Avisos de pedidos</p><p className="mt-1 text-xs text-muted-foreground" role="status">{message}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={active ? 'outline' : 'default'} disabled={busy || !supported || !publicKey} onClick={toggle}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{active ? 'Desactivar aquí' : 'Activar notificaciones'}</Button>
        {active && <Button size="sm" variant="outline" disabled={busy} onClick={test}>Probar aviso</Button>}
        <Button size="sm" variant="ghost" onClick={() => setHelp(!help)} aria-expanded={help}>Ayuda</Button>
      </div>
    </div>
    {help && <div className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
      <p>Android: abre administración en Chrome, activa y acepta «Permitir». Revisa que Chrome tenga notificaciones permitidas en los ajustes del teléfono.</p>
      <p>PC: abre administración en Chrome, Edge o Firefox, activa y permite los avisos. Con el navegador totalmente cerrado, la entrega depende del sistema y la ejecución en segundo plano.</p>
      <p>iPhone: Safari → Compartir → Agregar a Inicio. Abre ese icono, inicia sesión y activa los avisos (iOS 16.4 o posterior).</p>
      <p>Actívalas en cada dispositivo personal. Cerrar la página conserva los avisos; cerrar sesión los desactiva en ese navegador. No molestar, ahorro de batería o falta de conexión pueden retrasarlos.</p>
    </div>}
  </section>
}
