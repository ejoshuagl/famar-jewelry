// Actual handlers/sender/service worker with isolated DB and push transport.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const vm = require('node:vm')
const ts = require('typescript')
let actor = { username: 'joshua', name: 'Joshua' }, records = [], sent = [], audits = [], rateAllowed = true
let fault = 0
const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/test-only', keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') } }
const admin = { active: true, username: 'joshua', permissions: '[]' }
const db = {
  $executeRaw: async () => 0, $executeRawUnsafe: async () => 0,
  $transaction: async (fn) => fn(db),
  adminUser: { findUniqueOrThrow: async () => ({ id: 'owner' }) },
  adminPushSubscription: {
    findMany: async () => records,
    findUnique: async ({ where }) => records.find((r) => r.endpointHash === where.endpointHash) || null,
    count: async ({ where } = {}) => records.filter((r) => !where || r.adminId === where.adminId).length,
    deleteMany: async ({ where }) => { records = records.filter((r) => !Object.entries(where).every(([key, value]) => r[key] === value)) },
    upsert: async ({ where, create, update }) => {
      const current = records.find((r) => r.endpointHash === where.endpointHash)
      if (current) Object.assign(current, update)
      else records.push({ ...create, id: 'device', admin })
    },
  },
}
const cache = {}
function load(file) {
  const filename = path.resolve(__dirname, '..', file)
  if (cache[filename]) return cache[filename].exports
  const mod = new Module(filename, module); cache[filename] = mod; mod.filename = filename; mod.paths = module.paths
  mod.require = (id) => {
    if (id === 'server-only') return {}
    if (id === '@/lib/db') return { db }
    if (id === 'web-push') return { default: { sendNotification: async (subscription, payload, options) => { if (fault) throw { statusCode: fault }; sent.push({ subscription, payload: JSON.parse(payload), options }) } } }
    if (id === '@/lib/admin-auth') return { requireAdmin: async () => actor, auditLog: async (event) => audits.push(event), isSuperAdminUsername: (name) => name === 'joshua' }
    if (id === '@/lib/public-rate-limit') return { consumePublicRateLimit: async () => rateAllowed }
    if (id === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
    return require(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
const push = load('src/lib/admin-push.ts')
const route = load('src/app/api/admin-push/route.ts')
const req = (action, subscription = sub, origin = 'https://example.test') => ({ headers: new Headers({ origin }), nextUrl: new URL('https://example.test/api/admin-push'), text: async () => JSON.stringify({ action, subscription }) })
async function run() {
  let checks = 0
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com:8443/x', 'https://user:password@fcm.googleapis.com/x']) {
    assert.equal(push.validPushSubscription({ ...sub, endpoint }), false); checks++
  }
  assert.equal(push.validPushSubscription(sub), true); checks++
  assert.equal(push.validPushSubscription({ ...sub, keys: { ...sub.keys, auth: 'short' } }), false); checks++
  delete process.env.WEB_PUSH_PUBLIC_KEY
  await push.notifyNewOrder('order'); assert.equal(sent.length, 0); checks++
  assert.equal((await route.GET(req('status'))).body.publicKey, null); checks++
  process.env.WEB_PUSH_PUBLIC_KEY = 'public-test'; process.env.WEB_PUSH_PRIVATE_KEY = 'private-test'; process.env.WEB_PUSH_SUBJECT = 'https://example.test'
  let result = await route.GET(req('status'))
  assert.deepEqual(result.body, { publicKey: 'public-test' }); checks++
  actor = null; assert.equal((await route.POST(req('enable'))).status, 401); checks++
  actor = { username: 'joshua', name: 'Joshua' }
  assert.equal((await route.POST(req('enable', sub, 'https://evil.test'))).status, 403); checks++
  result = await route.POST(req('enable')); assert.equal(result.status, 200); assert.equal(records.length, 1); checks++
  await route.POST(req('enable')); assert.equal(records.length, 1); checks++
  assert.equal((await route.POST(req('status'))).body.active, true); checks++
  await push.notifyNewOrder('order-1')
  assert.equal(sent.length, 1); assert.equal(sent[0].payload.title, 'Nuevo pedido en FAMAR'); assert.equal(sent[0].options.timeout, 5000)
  assert.deepEqual(Object.keys(sent[0].payload).sort(), ['body', 'tag', 'title']); checks++
  records[0].admin = { active: false, username: 'joshua', permissions: null }
  await push.notifyNewOrder('order-2'); assert.equal(sent.length, 1); assert.equal(records.length, 0); checks++
  await route.POST(req('enable')); records[0].admin = { active: true, username: 'seller', permissions: '["products:view"]' }
  await push.notifyNewOrder('order-3'); assert.equal(sent.length, 1); assert.equal(records.length, 0); checks++
  await route.POST(req('enable')); fault = 410
  await push.notifyNewOrder('order-4'); assert.equal(records.length, 0); checks++
  fault = 0; await route.POST(req('enable')); fault = 503
  await push.notifyNewOrder('order-5'); assert.equal(records.length, 1); checks++
  fault = 0; await route.POST(req('test')); assert.equal(sent.at(-1).payload.title, 'Notificaciones activadas'); checks++
  records[0].adminId = 'another'; assert.equal((await route.POST(req('test'))).status, 403); checks++
  await route.POST(req('disable')); assert.equal(records.length, 1); checks++
  records[0].adminId = 'owner'; await route.POST(req('disable')); assert.equal(records.length, 0); checks++
  rateAllowed = false; assert.equal((await route.POST(req('enable'))).status, 429); checks++
  rateAllowed = true
  records = Array.from({ length: 5 }, (_, i) => ({ id: String(i), adminId: 'owner', endpointHash: String(i) }))
  assert.equal((await route.POST(req('enable'))).status, 409); checks++
  assert.ok(audits.length > 0); assert.ok(audits.every((entry) => !JSON.stringify(entry).includes(sub.endpoint))); checks++
  const handlers = {}, notifications = [], opened = []
  const self = { addEventListener: (name, cb) => { handlers[name] = cb }, registration: { showNotification: async (...args) => notifications.push(args) }, clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) } }
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../public/admin-push-sw.js'), 'utf8'), { self, URL })
  assert.equal(handlers.fetch, undefined); checks++
  let task
  handlers.push({ data: { json: () => ({ title: 'Test', url: 'https://evil.test' }) }, waitUntil: (promise) => { task = promise } }); await task
  assert.equal(notifications.length, 1); checks++
  handlers.notificationclick({ notification: { close() {} }, waitUntil: (promise) => { task = promise } }); await task
  assert.deepEqual(opened, ['/admin/pedidos']); checks++
  console.log(`${checks} checks passed; no real database, orders or notifications used.`)
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
