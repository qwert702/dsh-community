// 生成随机子域名池(80 个,写入 data/random-domains.json)
// 格式: r<4位随机> (如 r7k2.dsh.cbnac.com);去掉易混淆字符 0/O/1/l
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const CHARS = 'abcdefghijkmnpqrstuvwxyz23456789' // 去 0/O/1/l
const COUNT = 80

function rand4(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}

const seen = new Set<string>()
while (seen.size < COUNT) seen.add(rand4())

const domains = [...seen].map((r) => `r${r}.dsh.cbnac.com`)
const out = path.join(process.cwd(), 'data', 'random-domains.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(domains, null, 2))
console.log(`[random-domains] 生成 ${domains.length} 个: ${domains.slice(0, 5).join(', ')} …`)
