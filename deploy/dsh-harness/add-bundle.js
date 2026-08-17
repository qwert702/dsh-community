#!/usr/bin/env node
// 容器内:安装插件后把新增依赖加入 dsh.profile.bundles(供 dsh 加载)
// 用法: node add-bundle.js <profileDir>
const fs = require('node:fs')
const path = require('node:path')

const profileDir = process.argv[2] || '/home/node/.dsh/profiles/web'
const pkgPath = path.join(profileDir, 'package.json')
const j = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const deps = Object.keys(j.dependencies || {})
const bundles = (j.dsh?.profile?.bundles || []).slice()
for (const d of deps) {
  if (!bundles.includes(d)) bundles.push(d)
}
j.dsh = j.dsh || {}
j.dsh.profile = j.dsh.profile || {}
j.dsh.profile.bundles = bundles
fs.writeFileSync(pkgPath, JSON.stringify(j, null, 2))
console.log('[add-bundle] bundles:', bundles.join(', '))
