import {requireAuth, api, mountNav, htmlesc, fmtDate} from '/admin/admin-common.js';
requireAuth(); mountNav('analytics');

const searchInput = document.getElementById('search');
const refreshBtn = document.getElementById('refreshList');
const linksBody = document.getElementById('linksBody');
const currentLinkEl = document.getElementById('currentLink');
const statTotal = document.getElementById('statTotal');
const stat24h = document.getElementById('stat24h');
const statLast = document.getElementById('statLast');
const refBody = document.getElementById('refBody');
const uaBody = document.getElementById('uaBody');
const evBody = document.getElementById('evBody');
const sparkCanvas = document.getElementById('spark');

let allLinks = [], selectedShort = null;

function renderLinks(list) {
  linksBody.innerHTML = '';
  if (!list.length) { linksBody.innerHTML = '<tr><td colspan="4" class="empty">No links.</td></tr>'; return; }
  for (const l of list) {
    const tr = document.createElement('tr');
    tr.dataset.short = l.short_code;
    if (l.short_code === selectedShort) tr.classList.add('sel');
    tr.innerHTML = `
      <td><span class="pill">${htmlesc(l.short_code)}</span></td>
      <td>${htmlesc(l.title || '')}</td>
      <td>${l.click_count ?? 0}</td>
      <td class="muted">${fmtDate(l.created_at)}</td>`;
    tr.addEventListener('click', () => selectLink(l.short_code, l));
    linksBody.appendChild(tr);
  }
}
function filterLinks(q) {
  q=(q||'').toLowerCase().trim();
  return !q? allLinks.slice() : allLinks.filter(l => (l.short_code||'').toLowerCase().includes(q) || (l.title||'').toLowerCase().includes(q));
}
async function loadLinks() {
  const j = await api('/api/links'); allLinks = Array.isArray(j.data)? j.data: [];
  renderLinks(filterLinks(searchInput.value));
  const hash = decodeURIComponent((location.hash||'').replace(/^#/,''));
  if (!selectedShort) {
    if (hash) {
      const hit = allLinks.find(x=>x.short_code===hash);
      if (hit) return selectLink(hit.short_code, hit);
    }
    if (allLinks.length) selectLink(allLinks[0].short_code, allLinks[0]);
  }
}

async function selectLink(short, meta) {
  selectedShort = short; location.hash = '#' + encodeURIComponent(short);
  for (const tr of linksBody.querySelectorAll('tr')) tr.classList.toggle('sel', tr.dataset.short===short);
  currentLinkEl.textContent = `${meta?.short_url || short} — ${meta?.title || ''}`;

  let summary = {};
  try { summary = (await api(`/api/analytics/links/${encodeURIComponent(short)}/summary`)).data || {}; } catch {}
  statTotal.textContent = summary?.total_clicks ?? '–';
  stat24h.textContent = summary?.clicks_24h ?? '–';
  statLast.textContent = fmtDate(summary?.last_click_at);

  const refs = summary?.top_referrers || [];
  refBody.innerHTML = refs.length ? refs.map(r=>`<tr><td>${htmlesc(r.referrer||'(direct)')}</td><td>${r.count??0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  const uas = summary?.user_agents || [];
  uaBody.innerHTML = uas.length ? uas.map(u=>`<tr><td>${htmlesc(u.group)}</td><td>${u.count??0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  let events = [];
  try { events = (await api(`/api/analytics/links/${encodeURIComponent(short)}/events?limit=500`)).data || []; } catch {}
  renderEvents(events); drawSparkline(events);
}

function renderEvents(events){
  evBody.innerHTML = '';
  if (!events.length) { evBody.innerHTML='<tr><td colspan="4" class="empty">No events yet.</td></tr>'; return; }
  evBody.innerHTML = events.slice(0,50).map(ev=>`
    <tr>
      <td class="muted">${fmtDate(ev.occurred_at)}</td>
      <td>${htmlesc(ev.ip||'')}</td>
      <td>${htmlesc(ev.referer||'(direct)')}</td>
      <td class="muted">${htmlesc((ev.user_agent||'').slice(0,120))}</td>
    </tr>
  `).join('');
}

function drawSparkline(events){
  const ctx=sparkCanvas.getContext('2d');
  const W=sparkCanvas.clientWidth|0, H=sparkCanvas.clientHeight|0;
  sparkCanvas.width=W*devicePixelRatio; sparkCanvas.height=H*devicePixelRatio; ctx.scale(devicePixelRatio,devicePixelRatio);
  ctx.clearRect(0,0,W,H);
  const now=Date.now(), bins=new Array(24).fill(0);
  for(const ev of events){ const t=new Date(ev.occurred_at||0).getTime(); const diffH=(now-t)/(1000*60*60); if(diffH>=0&&diffH<24){ bins[23-Math.floor(diffH)]++ } }
  const max=Math.max(1,...bins), stepX=W/23;
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0,H-0.5); ctx.lineTo(W,H-0.5); ctx.stroke();
  ctx.strokeStyle='#4ea1ff'; ctx.lineWidth=2; ctx.beginPath();
  for(let i=0;i<24;i++){ const x=i*stepX, y=H-(bins[i]/max)*(H-8)-4; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y) }
  ctx.stroke();
}

searchInput.addEventListener('input', ()=>renderLinks(filterLinks(searchInput.value)));
refreshBtn.addEventListener('click', loadLinks);
loadLinks().catch(e=>{ linksBody.innerHTML = `<tr><td colspan="4" class="danger">Failed to load: ${e.message}</td></tr>`; });

