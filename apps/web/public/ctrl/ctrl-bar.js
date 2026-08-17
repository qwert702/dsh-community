// dsh 托管实例页面的左侧控制条(经 nginx sub_filter 注入)
// 从 hostname 识别 slot → 调站点 API 获取实例 id → 重启/升级/联系解决
// 站点:https://dsh.cbnac.com(cookie 同站跨子域,SameSite=Lax 可携带)
(() => {
  if (window.__dshCtrlBarLoaded) return
  window.__dshCtrlBarLoaded = true

  const API = 'https://dsh.cbnac.com'
  const SLOT = location.hostname.split('.')[0] // u1/u2/u3

  // ---------- 样式 ----------
  const style = document.createElement('style')
  style.textContent = `
#dsh-ctrl-bar{position:fixed;left:0;top:0;bottom:0;width:168px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;padding:14px 12px;box-sizing:border-box;background:rgba(13,17,23,.92);backdrop-filter:blur(8px);border-right:1px solid rgba(148,163,184,.15);color:#cbd5e1;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.5;box-shadow:2px 0 12px rgba(0,0,0,.35);transition:width .18s ease}
#dsh-ctrl-bar *{box-sizing:border-box;margin:0;padding:0}
#dsh-ctrl-bar.collapsed .dsh-ctrl-head-content,#dsh-ctrl-bar.collapsed .dsh-ctrl-btn,#dsh-ctrl-bar.collapsed .dsh-ctrl-form,#dsh-ctrl-bar.collapsed .dsh-ctrl-msg{display:none}
.dsh-ctrl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;padding-bottom:8px;border-bottom:1px solid rgba(148,163,184,.15)}
.dsh-ctrl-head-content{flex:1;min-width:0}
.dsh-ctrl-title{font-weight:700;font-size:13px;color:#f1f5f9;letter-spacing:.5px}
.dsh-ctrl-slot{font-size:11px;color:#94a3b8;margin-top:2px}
.dsh-ctrl-status{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-top:6px}
.dsh-ctrl-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;flex:none}
.dsh-ctrl-dot.ok{background:#22c55e}
.dsh-ctrl-dot.err{background:#ef4444}
.dsh-ctrl-toggle{flex:none;width:22px;height:22px;border-radius:6px;border:1px solid rgba(148,163,184,.3);background:rgba(30,41,59,.6);color:#cbd5e1;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s}
.dsh-ctrl-toggle:hover{border-color:rgba(148,163,184,.55);background:rgba(51,65,85,.85)}
.dsh-ctrl-btn{display:block;width:100%;padding:8px 10px;border-radius:8px;border:1px solid rgba(148,163,184,.25);background:rgba(30,41,59,.6);color:#e2e8f0;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left;transition:background .15s,border-color .15s}
.dsh-ctrl-btn:hover:not(:disabled){background:rgba(51,65,85,.85);border-color:rgba(148,163,184,.45)}
.dsh-ctrl-btn:disabled{opacity:.55;cursor:not-allowed}
.dsh-ctrl-btn.amber{border-color:rgba(245,158,11,.5);color:#fbbf24}
.dsh-ctrl-btn.amber:hover:not(:disabled){background:rgba(245,158,11,.12)}
.dsh-ctrl-msg{margin-top:auto;font-size:11px;color:#64748b;line-height:1.6}
.dsh-ctrl-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483001;padding:9px 18px;border-radius:10px;background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.3);color:#f1f5f9;font-size:13px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:76vw}
.dsh-ctrl-toast.err{border-color:rgba(239,68,68,.5);color:#fca5a5}
.dsh-ctrl-toast.ok{border-color:rgba(34,197,94,.5);color:#86efac}
.dsh-ctrl-form{display:none;flex-direction:column;gap:8px;border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:10px;background:rgba(245,158,11,.06)}
.dsh-ctrl-form.open{display:flex}
.dsh-ctrl-form textarea{width:100%;min-height:72px;resize:vertical;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.3);border-radius:6px;color:#e2e8f0;font-size:12px;padding:7px 9px;outline:none}
.dsh-ctrl-form textarea:focus{border-color:rgba(245,158,11,.6)}
.dsh-ctrl-submit{padding:6px 10px;border-radius:6px;border:none;background:#f59e0b;color:#0f172a;font-size:12px;font-weight:700;cursor:pointer}
.dsh-ctrl-submit:disabled{opacity:.5;cursor:not-allowed}
.dsh-ctrl-login{color:#fbbf24;text-decoration:underline;cursor:pointer}
`
  document.head.appendChild(style)

  // ---------- DOM ----------
  const bar = document.createElement('div')
  bar.id = 'dsh-ctrl-bar'
  bar.innerHTML = `
    <div class="dsh-ctrl-head">
      <div class="dsh-ctrl-head-content">
        <div class="dsh-ctrl-title">实例控制</div>
        <div class="dsh-ctrl-slot">${SLOT}.dsh.cbnac.com</div>
        <div class="dsh-ctrl-status"><span class="dsh-ctrl-dot" id="dsh-ctrl-dot"></span><span id="dsh-ctrl-status-text">连接中…</span></div>
      </div>
      <button class="dsh-ctrl-toggle" id="dsh-ctrl-toggle" title="收起控制条">«</button>
    </div>
    <button class="dsh-ctrl-btn" id="dsh-ctrl-restart" disabled>⟳ 重启 dsh</button>
    <button class="dsh-ctrl-btn" id="dsh-ctrl-upgrade" disabled>⬆ 升级 dsh</button>
    <button class="dsh-ctrl-btn amber" id="dsh-ctrl-ticket">✉ 联系解决</button>
    <div class="dsh-ctrl-form" id="dsh-ctrl-form">
      <textarea id="dsh-ctrl-msg-input" placeholder="描述遇到的问题…(最多 2000 字)"></textarea>
      <button class="dsh-ctrl-submit" id="dsh-ctrl-submit">提交工单</button>
    </div>
    <div class="dsh-ctrl-msg">由 dsh 社区提供技术支持</div>
  `
  document.body.appendChild(bar)

  const $ = (id) => document.getElementById(id)
  const toggleBtn = $('dsh-ctrl-toggle')
  const dot = $('dsh-ctrl-dot')

  // 并排布局:控制条占左侧一列,dsh 内容整体右推,互不遮挡
  // 展开 168px / 收起 46px,收起状态记 localStorage(下次进来默认收起)
  const EXPANDED_W = 168
  const COLLAPSED_W = 46
  let collapsed = false
  try { collapsed = localStorage.getItem('dsh-ctrl-collapsed') === '1' } catch {}
  const rootEl = document.getElementById('root') || document.body
  function applyLayout() {
    const w = collapsed ? COLLAPSED_W : EXPANDED_W
    bar.style.width = w + 'px'
    bar.classList.toggle('collapsed', collapsed)
    toggleBtn.textContent = collapsed ? '»' : '«'
    toggleBtn.title = collapsed ? '展开控制条' : '收起控制条'
    rootEl.style.marginLeft = w + 'px'
    rootEl.style.transition = 'margin-left .18s ease'
  }
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed
    try { localStorage.setItem('dsh-ctrl-collapsed', collapsed ? '1' : '0') } catch {}
    applyLayout()
  })
  applyLayout()

  const statusText = $('dsh-ctrl-status-text')
  const restartBtn = $('dsh-ctrl-restart')
  const upgradeBtn = $('dsh-ctrl-upgrade')
  const ticketBtn = $('dsh-ctrl-ticket')
  const form = $('dsh-ctrl-form')
  const msgInput = $('dsh-ctrl-msg-input')
  const submitBtn = $('dsh-ctrl-submit')

  let instanceId = null
  let toasting = false

  function toast(text, kind = '') {
    const el = document.createElement('div')
    el.className = 'dsh-ctrl-toast ' + kind
    el.textContent = text
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 3600)
  }

  function setStatus(state, text) {
    dot.className = 'dsh-ctrl-dot ' + state
    statusText.textContent = text
  }

  // ---------- 识别实例 ----------
  fetch(`${API}/api/instances`, { credentials: 'include' })
    .then((r) => {
      if (r.status === 401) throw { code: 401 }
      if (!r.ok) throw { code: r.status }
      return r.json()
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : data?.instances || []
      const inst = list.find((i) => i.slot === SLOT)
      if (!inst) {
        setStatus('err', '未找到该实例')
        toast('未找到该实例的托管记录,请先到 dsh.cbnac.com/hosting 领取', 'err')
        return
      }
      instanceId = inst.id
      setStatus('ok', inst.userId ? '在线' : '空闲')
      restartBtn.disabled = false
      upgradeBtn.disabled = false
    })
    .catch((e) => {
      if (e && e.code === 401) {
        setStatus('err', '未登录')
        statusText.innerHTML = ''
        const a = document.createElement('a')
        a.className = 'dsh-ctrl-login'
        a.href = 'https://dsh.cbnac.com/login'
        a.textContent = '请先登录'
        statusText.appendChild(a)
        toast('请先到 dsh.cbnac.com 登录', 'err')
      } else {
        setStatus('err', '站点不可达')
        toast('无法连接 dsh 社区服务,请稍后重试', 'err')
      }
    })

  // ---------- 重启 / 升级 ----------
  async function postAction(action) {
    if (!instanceId) return toast('实例未就绪', 'err')
    const label = action === 'restart' ? '重启' : '升级'
    if (!confirm(`确定要${label}这台 dsh 实例吗?\n${action === 'upgrade' ? '升级会重新构建镜像,大约需要 2-5 分钟。' : '重启期间页面会短暂不可用。'}`)) return
    restartBtn.disabled = upgradeBtn.disabled = true
    try {
      const r = await fetch(`${API}/api/instances/${instanceId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      toast(`${label}请求已发送,请稍等页面恢复…`, 'ok')
      setTimeout(() => location.reload(), action === 'restart' ? 8000 : 15000)
    } catch (e) {
      toast(`${label}失败:${e.message || '未知错误'}`, 'err')
    } finally {
      setTimeout(() => {
        restartBtn.disabled = upgradeBtn.disabled = !instanceId
      }, 4000)
    }
  }
  restartBtn.addEventListener('click', () => postAction('restart'))
  upgradeBtn.addEventListener('click', () => postAction('upgrade'))

  // ---------- 联系解决 ----------
  ticketBtn.addEventListener('click', () => {
    form.classList.toggle('open')
    if (form.classList.contains('open')) msgInput.focus()
  })
  submitBtn.addEventListener('click', async () => {
    if (!instanceId) return toast('实例未就绪', 'err')
    const message = msgInput.value.trim()
    if (!message) return toast('请先填写问题描述', 'err')
    submitBtn.disabled = true
    try {
      const r = await fetch(`${API}/api/instances/${instanceId}/ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      form.classList.remove('open')
      msgInput.value = ''
      toast('工单已提交,管理员会尽快处理', 'ok')
    } catch (e) {
      toast(`提交失败:${e.message || '未知错误'}`, 'err')
    } finally {
      submitBtn.disabled = false
    }
  })
})()
