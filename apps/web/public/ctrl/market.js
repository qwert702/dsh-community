// dsh 实例页面的插件市场(经 nginx sub_filter 注入)
// 打开方式:左侧控制条「🛍 插件市场」按钮(dispatch dsh-open-market)或兜底浮动按钮
// 只能安装本站商店(https://dsh.cbnac.com)approved 插件,经实例安装 API 在容器内执行
(() => {
  if (window.__dshMarketLoaded) return
  window.__dshMarketLoaded = true

  const API = 'https://dsh.cbnac.com'
  const HOST = location.hostname
  let instanceId = null

  const style = document.createElement('style')
  style.textContent = `
#dsh-market{position:fixed;inset:0;z-index:2147483002;display:none;flex-direction:column;background:rgba(7,10,16,.97);backdrop-filter:blur(6px);color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.5}
#dsh-market.open{display:flex}
#dsh-market *{box-sizing:border-box;margin:0;padding:0}
.dsh-mk-top{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid rgba(148,163,184,.15);background:rgba(13,17,23,.9)}
.dsh-mk-top h2{font-size:18px;font-weight:700;color:#fff}
.dsh-mk-close{background:none;border:1px solid rgba(148,163,184,.3);color:#94a3b8;border-radius:8px;width:34px;height:34px;font-size:16px;cursor:pointer;transition:all .15s}
.dsh-mk-close:hover{color:#fff;border-color:#fff}
.dsh-mk-body{flex:1;overflow-y:auto;padding:20px 24px}
.dsh-mk-cats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.dsh-mk-cat{background:none;border:1px solid rgba(148,163,184,.25);color:#94a3b8;border-radius:99px;padding:5px 14px;font-size:12.5px;cursor:pointer;transition:all .15s}
.dsh-mk-cat:hover{color:#e2e8f0;border-color:rgba(148,163,184,.5)}
.dsh-mk-cat.active{background:#f59e0b;border-color:#f59e0b;color:#0f172a;font-weight:600}
.dsh-mk-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.dsh-mk-card{display:flex;flex-direction:column;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.6);border-radius:14px;padding:18px;transition:all .2s}
.dsh-mk-card:hover{border-color:rgba(245,158,11,.5);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.dsh-mk-card-head{display:flex;align-items:center;gap:12px}
.dsh-mk-icon{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0f172a;font-size:18px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.dsh-mk-card-name{font-size:15px;font-weight:600;color:#fff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-mk-card-cat{font-size:11px;color:#fbbf24;border:1px solid rgba(245,158,11,.4);border-radius:99px;padding:1px 8px;flex:none}
.dsh-mk-card-desc{font-size:12.5px;color:#94a3b8;margin-top:8px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
.dsh-mk-card-foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:12px}
.dsh-mk-author{font-size:11px;color:#64748b}
.dsh-mk-install{padding:7px 18px;border-radius:9px;border:none;background:#f59e0b;color:#0f172a;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.dsh-mk-install:hover:not(:disabled){background:#fbbf24}
.dsh-mk-install:disabled{opacity:.5;cursor:not-allowed}
.dsh-mk-install.done{background:#22c55e;color:#052e16}
.dsh-mk-empty{text-align:center;padding:60px 20px;color:#64748b}
.dsh-mk-login{text-align:center;padding:60px 20px;color:#94a3b8}
.dsh-mk-login a{color:#fbbf24;text-decoration:underline}
.dsh-mk-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483004;padding:10px 20px;border-radius:10px;background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.3);color:#f1f5f9;font-size:13.5px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:76vw}
.dsh-mk-toast.err{border-color:rgba(239,68,68,.5);color:#fca5a5}
.dsh-mk-toast.ok{border-color:rgba(34,197,94,.5);color:#86efac}
.dsh-mk-loading{text-align:center;padding:60px 20px;color:#64748b;font-size:15px}
`
  document.head.appendChild(style)

  // 面板
  const panel = document.createElement('div')
  panel.id = 'dsh-market'
  panel.innerHTML = `
    <div class="dsh-mk-top">
      <h2>🛍 插件市场</h2>
      <button class="dsh-mk-close" id="dsh-mk-close" title="关闭">✕</button>
    </div>
    <div class="dsh-mk-body">
      <div class="dsh-mk-cats" id="dsh-mk-cats"></div>
      <div class="dsh-mk-grid" id="dsh-mk-grid"><div class="dsh-mk-loading">加载中…</div></div>
    </div>
  `
  document.body.appendChild(panel)

  const $ = (id) => document.getElementById(id)
  const catsEl = $('dsh-mk-cats')
  const gridEl = $('dsh-mk-grid')
  let allPlugins = []
  let activeCat = '全部'

  function toast(text, kind = '') {
    const el = document.createElement('div')
    el.className = 'dsh-mk-toast ' + kind
    el.textContent = text
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3600)
  }

  // 打开:加载插件列表
  function open() {
    panel.classList.add('open')
    if (allPlugins.length === 0) load()
  }
  $('dsh-mk-close').addEventListener('click', () => panel.classList.remove('open'))

  // 识别实例 id(按随机域名匹配)
  async function resolveInstance() {
    if (instanceId) return instanceId
    try {
      const r = await fetch(`${API}/api/instances`, { credentials: 'include' })
      if (r.status === 401) return null
      const data = await r.json()
      const inst = (data?.instances || []).find((i) => i.subdomain === HOST) || (data?.instances || []).find((i) => i.slot === HOST.split('.')[0])
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
    gridEl.innerHTML = '<div class="dsh-mk-loading">加载中…</div>'
    try {
      const r = await fetch(`${API}/api/plugins/list`, { credentials: 'include' })
      if (!r.ok) throw new Error(String(r.status))
      const data = await r.json()
      allPlugins = (data?.plugins || []).filter((p) => p.status === 'approved' || p.status === 'manual')
      renderCats()
      render()
    } catch (e) {
      gridEl.innerHTML = `<div class="dsh-mk-login">加载失败:${e.message}<br><a href="${API}/plugins" target="_blank">去商店看看 →</a></div>`
    }
  }

  function renderCats() {
    const cats = ['全部', ...new Set(allPlugins.map((p) => p.category || 'tool'))]
    catsEl.innerHTML = ''
    for (const c of cats) {
      const btn = document.createElement('button')
      btn.className = 'dsh-mk-cat' + (c === activeCat ? ' active' : '')
      btn.textContent = c === '全部' ? '全部' : CAT_NAME[c] || c
      btn.addEventListener('click', () => {
        activeCat = c
        renderCats()
        render()
      })
      catsEl.appendChild(btn)
    }
  }

  const CAT_NAME = { tool: '工具', vision: '视觉', voice: '语音', web: '网页', llm: '模型', database: '数据', efficiency: '效率' }

  function render() {
    const list = activeCat === '全部' ? allPlugins : allPlugins.filter((p) => (p.category || 'tool') === activeCat)
    if (list.length === 0) {
      gridEl.innerHTML = '<div class="dsh-mk-empty">该分类暂无插件</div>'
      return
    }
    gridEl.innerHTML = ''
    for (const p of list) {
      const card = document.createElement('div')
      card.className = 'dsh-mk-card'
      const icon = (p.name || '?').charAt(0).toUpperCase()
      card.innerHTML = `
        <div class="dsh-mk-card-head">
          <div class="dsh-mk-icon">${icon}</div>
          <div class="dsh-mk-card-name" title="${p.name}">${p.name}</div>
          <span class="dsh-mk-card-cat">${CAT_NAME[p.category] || p.category || '工具'}</span>
        </div>
        <p class="dsh-mk-card-desc">${p.desc || '暂无描述'}</p>
        <div class="dsh-mk-card-foot">
          <span class="dsh-mk-author">${p.stars ? '★ ' + p.stars : ''}</span>
          <button class="dsh-mk-install" data-spec="${p.spec}">安装</button>
        </div>
      `
      gridEl.appendChild(card)
    }
    gridEl.querySelectorAll('.dsh-mk-install').forEach((btn) => {
      btn.addEventListener('click', () => install(btn))
    })
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

  // 监听左侧控制条按钮(ctrl-bar.js dispatch)
  window.addEventListener('dsh-open-market', open)

  // 兜底:右上角小图标(控制条收起时也能打开)
  const fab = document.createElement('button')
  fab.style.cssText = 'position:fixed;right:14px;bottom:20px;z-index:2147483003;width:44px;height:44px;border-radius:12px;border:none;background:#f59e0b;color:#0f172a;font-size:18px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);font-family:inherit'
  fab.textContent = '🛍'
  fab.title = '插件市场'
  fab.addEventListener('click', open)
  document.body.appendChild(fab)
})()
