const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function show(mobileOrEmail) {
  const u = await p.user.findFirst({
    where: { OR: [{ mobile: mobileOrEmail }, { email: mobileOrEmail }] },
    include: {
      userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      member: { include: { families: { include: { family: true } } } },
    },
  })
  if (!u) return console.log(`${mobileOrEmail}: NOT FOUND`)
  const roles = u.userRoles.map((r) => r.role.code + (r.familyId ? ` (scoped→family ${r.familyId.slice(-6)})` : ' (global)'))
  const perms = [...new Set(u.userRoles.flatMap((r) => r.role.rolePermissions.map((rp) => rp.permission.code)))]
  console.log(`\n${u.email || u.mobile}`)
  console.log(`  joinIntent : ${u.joinIntent ?? '(none)'}   status: ${u.status}`)
  console.log(`  roles      : ${roles.join(', ')}`)
  console.log(`  permissions: ${perms.sort().join(', ') || '(none)'}`)
  console.log(`  family     : ${u.member?.families.map((f) => `${f.family.name} isKarta=${f.isKarta} status=${f.family.status}`).join(', ') || '(none)'}`)
}

;(async () => {
  for (const id of process.argv.slice(2)) await show(id)
  await p.$disconnect()
})().catch((e) => { console.error(e); process.exit(1) })
