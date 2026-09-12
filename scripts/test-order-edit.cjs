// Isolated regression tests: actual edit handler + commerce rules, no network/database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
let order, coupon, products, redemption, duplicate, permissions, writes
const db = {
  $queryRawUnsafe: async (sql, code, subtotal) => {
    if (sql.includes('CommerceSetting')) return []
    if (sql.includes('DiscountCoupon')) return coupon && coupon.active && coupon.code === code && coupon.minPurchase <= subtotal && (!coupon.endsAt || coupon.endsAt >= new Date()) && (!coupon.startsAt || coupon.startsAt <= new Date()) && (coupon.usageLimit == null || coupon.usageCount < coupon.usageLimit) ? [coupon] : []
    return []
  },
  product: { findMany: async () => products },
  order: { findUnique: async () => order, update: async ({ data }) => { writes++; return { ...order, ...data, couponRedemption: redemption } } },
  orderItem: { deleteMany: async () => { writes++ } },
  discountCoupon: { findUnique: async () => coupon },
  couponRedemption: {
    findFirst: async () => duplicate ? { id: 'other' } : null,
    deleteMany: async () => { writes++; redemption = null },
    create: async ({ data }) => { writes++; redemption = data },
  },
  $transaction: async (fn) => fn(db),
}
const cache = {}
function load(file) {
  const filename = path.resolve(__dirname, '..', file)
  if (cache[filename]) return cache[filename].exports
  const mod = new Module(filename, module); cache[filename] = mod
  mod.filename = filename; mod.paths = module.paths
  mod.require = (id) => {
    if (id === '@/lib/db') return { db }
    if (id === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }
    if (id === '@/lib/admin-auth') return { requireAdmin: async () => ({ name: 'Test', permissions }), hasPermission: (p, key) => p === null || p.includes(key), auditLog: async () => {} }
    if (id === '@/lib/utils') return { formatPrice: (n) => `$${n}` }
    if (id === '@/lib/promotion-schema') return { ensurePromotionSchema: async () => {} }
    if (id === '@/lib/daily-sales') return { getDailySaleSelection: async () => ({ ids: new Set(['daily']) }) }
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
    return require(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
const { PUT } = load('src/app/api/orders/[id]/route.ts')
function reset() {
  coupon = { id: 'coupon', code: 'TEST', active: true, minPurchase: 20, discount: 10, usageLimit: 5, usageCount: 0 }
  order = { id: 'order', orderNumber: 'FAM-000001', status: 'pending', customerPhone: '0991234567', observations: '', couponRedemption: null }
  products = [{ id: 'normal', name: 'Normal', code: 'N', price: 10, stock: 100, status: 'available', variants: null, isOnSale: false }, { id: 'sale', name: 'Sale', code: 'S', price: 10, stock: 100, status: 'available', variants: null, isOnSale: true }]
  duplicate = false; permissions = null; writes = 0; redemption = null
}
const request = (body) => PUT({ json: async () => body }, { params: Promise.resolve({ id: 'order' }) })
const item = (quantity, productId = 'normal') => ({ productId, quantity })
async function run() {
  reset()
  let result = await request({ items: [item(5), item(1, 'sale')], couponCode: 'TEST', preview: true })
  assert.equal(result.status, 200); assert.equal(result.body.total, 52.5); assert.equal(result.body.source, 'Descuento mayorista'); assert.equal(writes, 0)
  reset(); result = await request({ items: [item(1), item(2, 'sale')], couponCode: 'TEST' })
  assert.equal(result.status, 400); assert.equal(writes, 0)
  reset(); coupon.endsAt = new Date(0); order.couponRedemption = { coupon, discount: 10 }
  result = await request({ items: [item(3)] }); assert.equal(result.status, 400)
  reset(); coupon.usageCount = 5
  result = await request({ items: [item(3)], couponCode: 'TEST' }); assert.equal(result.status, 400)
  reset(); order.couponRedemption = { coupon, discount: 10 }
  result = await request({ items: [item(3)], customerPhone: '0997654321' })
  assert.equal(result.status, 200); assert.equal(result.body.total, 27); assert.equal(redemption.customerPhone, '0997654321')
  reset(); duplicate = true
  result = await request({ items: [item(3)], couponCode: 'TEST' }); assert.equal(result.status, 409); assert.equal(writes, 0)
  reset(); order.observations = '[Pedido manual · mayorista no habilitado]'
  result = await request({ items: [item(10)] }); assert.equal(result.body.total, 100)
  reset(); order.couponRedemption = { coupon, discount: 10 }
  result = await request({ items: [item(3)], couponCode: '' }); assert.equal(result.body.total, 30); assert.equal(redemption, null)
  reset(); permissions = ['orders:edit']
  result = await request({ items: [item(3)], couponCode: 'TEST' }); assert.equal(result.status, 403)
  reset(); products[0].stock = 3
  result = await request({ items: [item(2), item(2)] }); assert.equal(result.status, 409)
  reset(); result = await request({ items: [item(1)], customerPhone: '123' }); assert.equal(result.status, 400)
  reset(); products[0].id = 'daily'
  result = await request({ items: [item(10, 'daily')], preview: true }); assert.equal(result.body.total, 75); assert.equal(result.body.amount, 0)
  reset(); coupon.discount = 25
  result = await request({ items: [item(10)], couponCode: 'TEST' }); assert.equal(result.body.total, 75); assert.equal(redemption.discount, 25)
  reset(); products[0].variants = JSON.stringify([{ id: 'red', name: 'Rojo', stock: 2 }])
  result = await request({ items: [item(1)] }); assert.equal(result.status, 409)
  result = await request({ items: [{ ...item(3), variantId: 'red' }] }); assert.equal(result.status, 409)
  result = await request({ items: [{ ...item(2), variantId: 'red' }], preview: true }); assert.equal(result.body.total, 20)
  reset(); permissions = ['orders:edit']; order.observations = '[Pedido manual · mayorista no habilitado]'
  result = await request({ items: [item(5)], applyWholesaleDiscount: true }); assert.equal(result.status, 403)
  reset(); coupon.startsAt = new Date(Date.now() + 86400000)
  result = await request({ items: [item(3)], couponCode: 'TEST' }); assert.equal(result.status, 400)
  reset(); order.status = 'confirmed'
  result = await request({ items: [item(3)] }); assert.equal(result.status, 400)
  reset(); result = await request({ items: [{ ...item(3), price: 0.01 }], total: 0.01 })
  assert.equal(result.body.total, 30)
  console.log('20 order editing scenarios passed; no real orders or database modified.')
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
