/** Shared by the server and UI. Bare section names are legacy full-section grants. */
export const PERMISSION_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', actions: ['view', 'reset'] },
  { id: 'products', label: 'Productos', actions: ['view', 'create', 'edit', 'delete', 'prices', 'stock', 'offers', 'bulk'] },
  { id: 'orders', label: 'Pedidos', actions: ['view', 'create', 'edit', 'delete', 'confirm', 'cancel', 'coupon', 'wholesale'] },
  { id: 'categories', label: 'Categorías', actions: ['view', 'create', 'delete'] },
  { id: 'campaigns', label: 'Publicidad', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'themes', label: 'Temas y estilos', actions: ['view', 'edit'] },
  { id: 'wholesale', label: 'Mayoristas y ofertas diarias', actions: ['view', 'edit'] },
  { id: 'coupons', label: 'Cupones', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'investments', label: 'Inversiones y ganancias', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'users', label: 'Usuarios', actions: ['view', 'create', 'edit', 'delete', 'permissions', 'audit'] },
] as const
export type AdminSection = typeof PERMISSION_SECTIONS[number]['id']
export type AdminPermission = AdminSection | `${AdminSection}:${string}`
export const ACTION_LABELS: Record<string, string> = {
  view: 'Ver', create: 'Crear', edit: 'Editar', delete: 'Eliminar', prices: 'Cambiar precios',
  stock: 'Modificar stock y variantes', offers: 'Cambiar ofertas', bulk: 'Cambios masivos',
  confirm: 'Confirmar pago', cancel: 'Cancelar pedido', coupon: 'Aplicar cupón', wholesale: 'Aplicar mayorista',
  permissions: 'Asignar permisos', audit: 'Ver actividad', reset: 'Reiniciar embudo',
}
export const ADMIN_PERMISSIONS: AdminPermission[] = PERMISSION_SECTIONS.flatMap((s) => [s.id, ...s.actions.map((a) => `${s.id}:${a}` as AdminPermission)])
export const ALL_ACTION_PERMISSIONS = ADMIN_PERMISSIONS.filter((p) => p.includes(':'))
export function hasPermission(permissions: readonly string[] | null, requested: string): boolean {
  const [section, action = 'view'] = requested.split(':')
  if (!ADMIN_PERMISSIONS.includes(`${section}:${action}` as AdminPermission)) return false
  return permissions === null || permissions.includes(section) || permissions.includes(`${section}:${action}`)
}
export function expandPermissions(value: unknown): AdminPermission[] {
  if (value === null) return [...ALL_ACTION_PERMISSIONS]
  if (!Array.isArray(value)) return []
  return ALL_ACTION_PERMISSIONS.filter((p) => hasPermission(value, p))
}
export function readPermissions(value: string | null): AdminPermission[] | null {
  if (value === null) return null
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? expandPermissions(parsed) : [] } catch { return [] }
}
export const PERMISSION_PROFILES: Record<string, { label: string; permissions: AdminPermission[] }> = {
  seller: { label: 'Vendedor', permissions: ['products:view', 'orders:view', 'orders:create', 'orders:coupon'] },
  inventory: { label: 'Inventario', permissions: ['products:view', 'products:create', 'products:edit', 'products:stock', 'categories:view'] },
  reader: { label: 'Solo lectura', permissions: PERMISSION_SECTIONS.filter((s) => s.id !== 'users').map((s) => `${s.id}:view` as AdminPermission) },
  admin: { label: 'Administrador', permissions: [...ALL_ACTION_PERMISSIONS] },
}
