import {requireAuth, api, mountNav, htmlesc, fmtDate} from '/admin/admin-common.js';
requireAuth(); mountNav('analytics');

const searchInput = document.getElementById('search');
const refreshBtn = document.getElementById('refreshList');
const linksBody = document.getElementById('linksBody');
const currentLinkEl = document.getElementById('currentLink');
const statTotal = document.getElementById('statTotal');
const statRange = document.getElementById('statRange');
const statRangeLabel = document.getElementById('statRangeLabel');
const statLast = document.getElementById('statLast');
const refBody = document.getElementById('refBody');
const uaBody = document.getElementById('uaBody');
const countryBody = document.getElementById('countryBody');
const cityBody = document.getElementById('cityBody');
const evBody = document.getElementById('evBody');
const sparkCanvas = document.getElementById('spark');
const rangeSelect = document.getElementById('rangeSelect');
const orgTotal = document.getElementById('orgTotal');
const orgRange = document.getElementById('orgRange');
const orgRangeLabel = document.getElementById('orgRangeLabel');
const orgLast = document.getElementById('orgLast');
const orgCountryBody = document.getElementById('orgCountryBody');
const orgCityBody = document.getElementById('orgCityBody');

let allLinks = [], selectedShort = null;
let currentRange = rangeSelect ? rangeSelect.value : '7d';

function rangeLabel(range){
  if (range === '24h') return 'Clicks (24h)';
  if (range === '7d') return 'Clicks (7d)';
  if (range === '30d') return 'Clicks (30d)';
  if (range === '90d') return 'Clicks (90d)';
  return 'Clicks (all)';
}

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
  try { summary = (await api(`/api/analytics/links/${encodeURIComponent(short)}/summary?range=${encodeURIComponent(currentRange)}`)).data || {}; } catch {}
  statTotal.textContent = summary?.total_clicks ?? '–';
  statRange.textContent = summary?.clicks_range ?? '–';
  statLast.textContent = fmtDate(summary?.last_click_at);
  if (statRangeLabel) statRangeLabel.textContent = rangeLabel(currentRange);

  const refs = summary?.top_referrers || [];
  refBody.innerHTML = refs.length ? refs.map(r=>`<tr><td>${htmlesc(r.referrer||'(direct)')}</td><td>${r.count??0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  const uas = summary?.user_agents || [];
  uaBody.innerHTML = uas.length ? uas.map(u=>`<tr><td>${htmlesc(u.group)}</td><td>${u.count??0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  const countries = summary?.top_countries || [];
  countryBody.innerHTML = countries.length ? countries.map(c=>`<tr><td>${htmlesc(c.country || 'Unknown')}</td><td>${c.count ?? 0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  const cities = summary?.top_cities || [];
  cityBody.innerHTML = cities.length ? cities.map(c=>`<tr><td>${htmlesc(c.city || 'Unknown')} ${c.country ? `<span class="muted">(${htmlesc(c.country)})</span>` : ''}</td><td>${c.count ?? 0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';

  let events = [];
  try { events = (await api(`/api/analytics/links/${encodeURIComponent(short)}/events?limit=500&range=${encodeURIComponent(currentRange)}`)).data || []; } catch {}
  renderEvents(events); drawSparkline(events);
}

function renderEvents(events){
  evBody.innerHTML = '';
  if (!events.length) { evBody.innerHTML='<tr><td colspan="6" class="empty">No events yet.</td></tr>'; return; }
  evBody.innerHTML = events.slice(0,50).map(ev=>`
    <tr>
      <td class="muted">${fmtDate(ev.occurred_at)}</td>
      <td>${htmlesc(ev.ip||'')}</td>
      <td>${htmlesc(ev.country_name||'')}</td>
      <td>${htmlesc(ev.city||'')}</td>
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
rangeSelect?.addEventListener('change', () => {
  currentRange = rangeSelect.value;
  loadOrgSummary();
  if (selectedShort) {
    const link = allLinks.find(l => l.short_code === selectedShort);
    if (link) selectLink(selectedShort, link);
  }
});

async function loadOrgSummary(){
  let summary = {};
  try { summary = (await api(`/api/analytics/summary?range=${encodeURIComponent(currentRange)}`)).data || {}; } catch {}
  if (orgTotal) orgTotal.textContent = summary?.total_clicks ?? '–';
  if (orgRange) orgRange.textContent = summary?.clicks_range ?? '–';
  if (orgLast) orgLast.textContent = fmtDate(summary?.last_click_at);
  if (orgRangeLabel) orgRangeLabel.textContent = rangeLabel(currentRange);

  const countries = summary?.top_countries || [];
  if (orgCountryBody) {
    orgCountryBody.innerHTML = countries.length ? countries.map(c=>`<tr><td>${htmlesc(c.country || 'Unknown')}</td><td>${c.count ?? 0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';
  }
  const cities = summary?.top_cities || [];
  if (orgCityBody) {
    orgCityBody.innerHTML = cities.length ? cities.map(c=>`<tr><td>${htmlesc(c.city || 'Unknown')} ${c.country ? `<span class="muted">(${htmlesc(c.country)})</span>` : ''}</td><td>${c.count ?? 0}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No data.</td></tr>';
  }
}

loadOrgSummary();
loadLinks().catch(e=>{ linksBody.innerHTML = `<tr><td colspan="4" class="danger">Failed to load: ${e.message}</td></tr>`; });
