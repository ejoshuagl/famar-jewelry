// Runs the actual authorization code with an isolated in-memory database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const Module = require('node:module')
process.env.ADMIN_SESSION_SECRET = 'test-only-permissions-secret-never-used-in-production'
let actor = { username: 'seller', name: 'Seller', active: true, permissions: '[]' }
let target = { id: 'target', username: 'employee', permissions: '[]', active: true }
let writes = 0
const db = { adminUser: {
  findUnique: async ({ where }) => where.username ? actor : target,
  create: async () => { writes++; return {} },
  update: async () => { writes++; return {} },
  delete: async () => { writes++; return {} },
}, auditLog: { create: async () => ({}) } }
const cache = {}
function load(file) {
  const filename = path.resolve(__dirname, '..', file)
  if (cache[filename]) return cache[filename].exports
  const mod = new Module(filename, module)
  cache[filename] = mod
  mod.filename = filename
  mod.paths = module.paths
  mod.require = (id) => {
    if (id === '@/lib/db') return { db }
    if (id === '@/lib/utils') return { hashPassword: async () => 'test-hash' }
    if (id === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } }
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
    return require(id)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
  return mod.exports
}
const p = load('src/lib/admin-permissions.ts')
const auth = load('src/lib/admin-auth.ts')
const token = auth.issueAdminToken('Seller', 'seller', null)
const req = (method, pathname, body) => new Request(`https://example.test${pathname}`, { method, headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
async function run() {
  let checks = 0
  for (const section of p.PERMISSION_SECTIONS) {
    actor.permissions = JSON.stringify([`${section.id}:view`])
    assert.ok(await auth.requireAdmin(req('GET', `/api/${section.id}`), section.id)); checks++
    for (const method of ['POST', 'PUT', 'DELETE']) { assert.equal(await auth.requireAdmin(req(method, `/api/${section.id}`), section.id), null); checks++ }
    for (const action of section.actions) { assert.equal(p.hasPermission([section.id], `${section.id}:${action}`), true); checks++ }
  }
  actor.permissions = JSON.stringify(['orders:view', 'orders:confirm'])
  assert.ok(await auth.requireAdmin(req('PUT', '/api/orders/123', { status: 'confirmed' }), 'orders')); checks++
  assert.equal(await auth.requireAdmin(req('PUT', '/api/orders/123', { status: 'cancelled' }), 'orders'), null); checks++
  assert.equal(await auth.requireAdmin(req('PUT', '/api/orders/123', { status: 'confirmed', items: [{}] }), 'orders'), null); checks++
  actor.permissions = '["users:view"]'
  assert.equal(await auth.requireAdmin(req('GET', '/api/audit-logs'), 'users'), null); checks++
  actor.permissions = '["themes:edit"]'
  assert.ok(await auth.requireAdmin(req('POST', '/api/theme'), 'themes')); checks++
  actor.permissions = '["products:edit"]'
  assert.equal(await auth.requireAdmin(req('POST', '/api/products/bulk'), 'products'), null); checks++
  actor.permissions = 'invalid json'
  assert.equal(await auth.requireAdmin(req('GET', '/api/orders'), 'orders'), null); checks++
  actor.permissions = '[]' // A previously signed full-access token cannot bypass revocation.
  assert.equal(await auth.requireAdmin(req('GET', '/api/orders'), 'orders'), null); checks++
  actor.active = false
  assert.equal(await auth.requireAdmin(req('GET', '/api/auth')), null); checks++
  actor.active = true
  actor.username = 'joshua'
  for (const permission of p.ALL_ACTION_PERMISSIONS) { assert.ok(await auth.requireAdmin(req('GET', '/api/auth'), permission)); checks++ }
  actor.username = 'seller'
  const users = load('src/app/api/admin-users/route.ts')
  const user = load('src/app/api/admin-users/[id]/route.ts')
  actor.permissions = '["users:create", "users:edit", "users:permissions"]'
  const params = { params: Promise.resolve({ id: 'target' }) }
  assert.equal((await users.POST(req('POST', '/api/admin-users', { name: 'Test User', username: 'test-user', password: 'test-password', permissions: ['orders'] }))).status, 403); checks++
  assert.equal((await user.PUT(req('PUT', '/api/admin-users/target', { permissions: ['orders:confirm'] }), params)).status, 403); checks++
  assert.equal((await user.PUT(req('PUT', '/api/admin-users/target', { username: 'joshua' }), params)).status, 403); checks++
  target.username = 'joshua'
  actor.permissions = null
  assert.equal((await user.PUT(req('PUT', '/api/admin-users/target', { name: 'Changed' }), params)).status, 403); checks++
  assert.equal((await user.DELETE(req('DELETE', '/api/admin-users/target'), params)).status, 403); checks++
  assert.equal(writes, 0)
  console.log(`${checks} permission checks passed; no real database, users or orders modified.`)
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
