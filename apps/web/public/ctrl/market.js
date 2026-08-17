// dsh 实例页面的插件市场面板(经 nginx sub_filter 注入)
// 只能安装本站商店(https://dsh.cbnac.com)approved 插件,经实例安装 API 在容器内执行
(() => {
  if (window.__dshMarketLoaded) return
  window.__dshMarketLoaded = true

  const API = 'https://dsh.cbnac.com'
  const HOST = location.hostname
  let instanceId = null

  const style = document.createElement('style')
  style.textContent = `
#dsh-market{position:fixed;right:0;top:0;bottom:0;width:320px;z-index:2147483002;display:flex;flex-direction:column;background:rgba(13,17,23,.96);backdrop-filter:blur(8px);border-left:1px solid rgba(148,163,184,.15);color:#cbd5e1;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5;box-shadow:-2px 0 12px rgba(0,0,0,.35);transform:translateX(100%);transition:transform .2s ease}
#dsh-market.open{transform:translateX(0)}
#dsh-market *{box-sizing:border-box;margin:0;padding:0}
.dsh-mk-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.15);font-weight:700;color:#f1f5f9}
.dsh-mk-close{background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1}
.dsh-mk-close:hover{color:#fff}
.dsh-mk-list{flex:1;overflow-y:auto;padding:10px 12px}
.dsh-mk-item{border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:rgba(30,41,59,.5)}
.dsh-mk-item h4{font-size:13px;color:#e2e8f0;font-weight:600}
.dsh-mk-item p{font-size:11px;color:#94a3b8;margin-top:3px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsh-mk-cat{display:inline-block;margin-top:6px;font-size:10px;color:#fbbf24;border:1px solid rgba(245,158,11,.4);border-radius:99px;padding:1px 8px}
.dsh-mk-install{margin-top:8px;width:100%;padding:6px 10px;border-radius:8px;border:none;background:#f59e0b;color:#0f172a;font-size:12px;font-weight:700;cursor:pointer}
.dsh-mk-install:disabled{opacity:.5;cursor:not-allowed}
.dsh-mk-install.done{background:#22c55e;color:#052e16}
.dsh-mk-fab{position:fixed;left:16px;bottom:20px;z-index:2147483003;width:48px;height:48px;border-radius:50%;border:none;background:#f59e0b;color:#0f172a;font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);font-family:inherit}
.dsh-mk-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483004;padding:9px 18px;border-radius:10px;background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.3);color:#f1f5f9;font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:76vw}
.dsh-mk-toast.err{border-color:rgba(239,68,68,.5);color:#fca5a5}
.dsh-mk-toast.ok{border-color:rgba(34,197,94,.5);color:#86efac}
.dsh-mk-login{text-align:center;padding:20px;color:#94a3b8}
.dsh-mk-login a{color:#fbbf24;text-decoration:underline}
`
  document.head.appendChild(style)

  // 浮动按钮
  const fab = document.createElement('button')
  fab.id = 'dsh-mk-fab'
  fab.className = 'dsh-mk-fab'
  fab.textContent = '插件'
  fab.title = '插件市场'
  document.body.appendChild(fab)

  // 面板
  const panel = document.createElement('div')
  panel.id = 'dsh-market'
  panel.innerHTML = `
    <div class="dsh-mk-head"><span>插件市场</span><button class="dsh-mk-close" id="dsh-mk-close">✕</button></div>
    <div class="dsh-mk-list" id="dsh-mk-list"><div class="dsh-mk-login">加载中…</div></div>
  `
  document.body.appendChild(panel)

  const $ = (id) => document.getElementById(id)
  const listEl = $('dsh-mk-list')

  function toast(text, kind = '') {
    const el = document.createElement('div')
    el.className = 'dsh-mk-toast ' + kind
    el.textContent = text
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3600)
  }

  fab.addEventListener('click', () => {
    panel.classList.add('open')
    load()
  })
  $('dsh-mk-close').addEventListener('click', () => panel.classList.remove('open'))

  // 识别实例 id(按 subdomain 匹配,比按 slot 更健壮)
  async function resolveInstance() {
    if (instanceId) return instanceId
    try {
      const r = await fetch(`${API}/api/instances`, { credentials: 'include' })
      if (r.status === 401) return null
      const data = await r.json()
      const inst = (data?.instances || []).find((i) => i.subdomain === HOST || i.slot === HOST.split('.')[0])
      if (inst && inst.mine) {
        instanceId = inst.id
        return instanceId
      }
      return null
    } catch {
      return null
    }
  }

  // 加载商店插件列表
  async function load() {
    listEl.innerHTML = '<div class="dsh-mk-login">加载中…</div>'
    try {
      const r = await fetch(`${API}/api/plugins/list`, { credentials: 'include' })
      if (!r.ok) throw new Error(String(r.status))
      const data = await r.json()
      const items = Array.isArray(data) ? data : data?.plugins || []
      if (items.length === 0) {
        listEl.innerHTML = '<div class="dsh-mk-login">商店暂无插件</div>'
        return
      }
      listEl.innerHTML = ''
      for (const p of items) {
        if (p.status !== 'approved' && p.status !== 'manual') continue
        const el = document.createElement('div')
        el.className = 'dsh-mk-item'
        el.innerHTML = `
          <h4>${p.name}</h4>
          <p>${p.desc || ''}</p>
          <span class="dsh-mk-cat">${p.category || 'tool'}</span>
          <button class="dsh-mk-install" data-spec="${p.spec}">安装</button>
        `
        listEl.appendChild(el)
      }
      listEl.querySelectorAll('.dsh-mk-install').forEach((btn) => {
        btn.addEventListener('click', () => install(btn))
      })
    } catch (e) {
      listEl.innerHTML = `<div class="dsh-mk-login">加载失败:${e.message}<br><a href="${API}/plugins" target="_blank">去商店看看 →</a></div>`
    }
  }

  // 安装
  async function install(btn) {
    const instId = await resolveInstance()
    if (!instId) {
      toast('请先到 dsh.cbnac.com 登录并领取实例', 'err')
      return
    }
    btn.disabled = true
    btn.textContent = '安装中…'
    try {
      const r = await fetch(`${API}/api/instances/${instId}/plugin/install`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: btn.dataset.spec }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      btn.textContent = '✓ 已安装'
      btn.classList.add('done')
      toast('插件安装成功', 'ok')
    } catch (e) {
      btn.disabled = false
      btn.textContent = '安装'
      toast(`安装失败:${e.message}`, 'err')
    }
  }
})()
