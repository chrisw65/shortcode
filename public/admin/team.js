import { requireAuth, api, logout, htmlesc } from '/admin/admin-common.js';

requireAuth();
document.getElementById('logoutBtn')?.addEventListener('click', () => logout());

const membersBody = document.getElementById('membersBody');
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
    const res = await api('/api/org/members', { method: 'POST', body: { email, role } });
    const data = res?.data || res;
    if (data?.temp_password) {
      inviteMsg.textContent = `Temporary password for ${email}: ${data.temp_password}`;
    } else {
      inviteMsg.textContent = 'Member added.';
    }
    memberEmail.value = '';
    memberRole.value = 'member';
    await loadMembers();
  } catch (err) {
    inviteMsg.textContent = err?.message || 'Failed to add member.';
  } finally {
    btnAdd.disabled = false;
  }
}

btnAdd?.addEventListener('click', addMember);
loadMembers();
