import { requireAuth, api, htmlesc, copyText } from '/admin/admin-common.js?v=20260120';

requireAuth();

const membersBody = document.getElementById('membersBody');
const invitesBody = document.getElementById('invitesBody');
const refreshInvites = document.getElementById('refreshInvites');
const memberEmail = document.getElementById('memberEmail');
const memberRole = document.getElementById('memberRole');
const btnAdd = document.getElementById('btnAdd');
const inviteMsg = document.getElementById('inviteMsg');

async function loadMembers() {
  try {
    const res = await api('/api/org/members');
    const data = res?.data || res;
    if (!Array.isArray(data) || !data.length) {
      membersBody.innerHTML = '<tr><td class="empty" colspan="6">No members yet.</td></tr>';
      return;
    }
    membersBody.innerHTML = data.map((m) => `
      <tr data-id="${htmlesc(m.id)}">
        <td>${htmlesc(m.email || '')}</td>
        <td>${htmlesc(m.name || '—')}</td>
        <td><span class="pill">${htmlesc(m.role)}</span></td>
        <td>${m.is_active ? 'active' : 'disabled'}</td>
        <td>${new Date(m.created_at).toLocaleString()}</td>
        <td style="text-align:right">
          <button class="btn danger btn-remove">Remove</button>
        </td>
      </tr>
    `).join('');

    membersBody.querySelectorAll('.btn-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        const id = tr?.dataset.id;
        if (!id) return;
        if (!confirm('Remove this member?')) return;
        try {
          await api(`/api/org/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
          await loadMembers();
        } catch (err) {
          alert(err?.message || 'Failed to remove member');
        }
      });
    });
  } catch (e) {
    membersBody.innerHTML = '<tr><td class="empty" colspan="6">Failed to load members.</td></tr>';
  }
}

async function loadInvites() {
  if (!invitesBody) return;
  try {
    const res = await api('/api/org/invites');
    const data = res?.data || res;
    if (!Array.isArray(data) || !data.length) {
      invitesBody.innerHTML = '<tr><td class="empty" colspan="5">No pending invites.</td></tr>';
      return;
    }
    invitesBody.innerHTML = data.map((inv) => {
      const link = `${window.location.origin}/register.html?invite=${encodeURIComponent(inv.token)}`;
      return `
        <tr data-id="${htmlesc(inv.id)}">
          <td>${htmlesc(inv.invitee_email)}</td>
          <td><span class="pill">${htmlesc(inv.role)}</span></td>
          <td>${htmlesc(inv.status)}</td>
          <td><button class="btn ghost btn-copy" data-link="${htmlesc(link)}">Copy link</button></td>
          <td>
            <button class="btn ghost btn-resend">Resend</button>
            <button class="btn danger btn-revoke">Revoke</button>
          </td>
        </tr>
      `;
    }).join('');

    invitesBody.querySelectorAll('.btn-copy').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const link = e.currentTarget.dataset.link;
        if (link) await copyText(link);
      });
    });

    invitesBody.querySelectorAll('.btn-revoke').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        const id = tr?.dataset.id;
        if (!id) return;
        if (!confirm('Revoke this invite?')) return;
        await api(`/api/org/invites/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
        await loadInvites();
      });
    });

    invitesBody.querySelectorAll('.btn-resend').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        const id = tr?.dataset.id;
        if (!id) return;
        await api(`/api/org/invites/${encodeURIComponent(id)}/resend`, { method: 'POST' });
      });
    });
  } catch (e) {
    invitesBody.innerHTML = '<tr><td class="empty" colspan="5">Failed to load invites.</td></tr>';
  }
}

async function addMember() {
  const email = (memberEmail.value || '').trim().toLowerCase();
  const role = memberRole.value || 'member';
  inviteMsg.textContent = '';
  if (!email) {
    inviteMsg.textContent = 'Email is required.';
    return;
  }

  btnAdd.disabled = true;
  try {
    const res = await api('/api/org/invites', { method: 'POST', body: { email, role } });
    const data = res?.data || res;
    const link = `${window.location.origin}/register.html?invite=${encodeURIComponent(data.token)}`;
    inviteMsg.textContent = `Invite created. Share: ${link}`;
    memberEmail.value = '';
    memberRole.value = 'member';
    await loadInvites();
  } catch (err) {
    inviteMsg.textContent = err?.message || 'Failed to add member.';
  } finally {
    btnAdd.disabled = false;
  }
}

btnAdd?.addEventListener('click', addMember);
refreshInvites?.addEventListener('click', loadInvites);
loadMembers();
loadInvites();
