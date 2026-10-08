import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, FolderKanban, MailPlus, MoreHorizontal, Plus, Users, X } from 'lucide-react';
import { api } from './api.js';

const initials = (name = '') => name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

export function TeamView({ workspace, user, onNotice }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'employee' });
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');
  const canManage = ['owner', 'admin', 'manager'].includes(workspace?.role);

  async function loadMembers() {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const result = await api('/api/workspace/members', { workspaceId: workspace.id });
      setMembers(result.members || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMembers(); }, [workspace?.id]);

  async function invite(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/api/workspace/invitations', { method: 'POST', workspaceId: workspace.id, body: form });
      setInviteUrl(result.invitation.inviteUrl);
      setForm({ email: '', role: 'employee' });
      await loadMembers();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeRole(member, role) {
    try {
      await api(`/api/workspace/members/${member.id}`, { method: 'PATCH', workspaceId: workspace.id, body: { role } });
      await loadMembers();
      onNotice('Workspace role updated.');
    } catch (requestError) { setError(requestError.message); }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.user.name} from this workspace?`)) return;
    try {
      await api(`/api/workspace/members/${member.id}`, { method: 'DELETE', workspaceId: workspace.id });
      await loadMembers();
      onNotice('Workspace member removed.');
    } catch (requestError) { setError(requestError.message); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); onNotice('Invitation link copied.'); }
    catch { setError('Could not access the clipboard. Select and copy the invitation link.'); }
  }

  return <section className="workspace-view">
    <div className="workspace-view-heading"><div><span className="modal-kicker">WORKSPACE</span><h2>Team members</h2><p>Manage who can access {workspace?.name || 'this workspace'}.</p></div>{canManage && <button className="button button-primary" onClick={() => setInviteOpen(true)}><MailPlus size={15}/>Invite teammate</button>}</div>
    <div className="workspace-metrics"><div><Users size={17}/><strong>{members.length}</strong><span>members</span></div><div><FolderKanban size={17}/><strong>{workspace?.role || 'member'}</strong><span>your role</span></div><div><Check size={17}/><strong>Private</strong><span>workspace access</span></div></div>
    <div className="panel team-table-panel"><div className="workspace-table-head"><strong>Members</strong><span>{members.length} people</span></div><div className="member-table"><div className="member-row member-head"><span>Person</span><span>Role</span><span>Joined</span><span/></div>{loading ? <div className="workspace-empty">Loading members…</div> : members.map((member) => <div className="member-row" key={member.id}><div className="member-person"><span className="avatar blue">{initials(member.user.name)}</span><span><strong>{member.user.name}{member.user.id === user?.id ? ' (you)' : ''}</strong><small>{member.user.email}</small></span></div><span className="role-cell">{canManage && member.role !== 'owner' && (workspace.role === 'owner' || workspace.role === 'admin') ? <select value={member.role} aria-label={`Role for ${member.user.name}`} onChange={(event) => changeRole(member, event.target.value)}><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option></select> : <span className={`role-pill ${member.role}`}>{member.role}</span>}</span><span className="member-joined">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(member.joinedAt))}</span><span className="member-actions">{canManage && member.role !== 'owner' && <button className="icon-button" onClick={() => removeMember(member)} aria-label={`Remove ${member.user.name}`}><MoreHorizontal size={17}/></button>}</span></div>)}{!loading && members.length === 0 && <div className="workspace-empty">No members found in this workspace.</div>}</div></div>
    {error && <p className="form-error workspace-error" role="alert">{error}</p>}
    {inviteOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setInviteOpen(false)}><section className="create-modal"><div className="modal-heading"><div><span className="modal-kicker">TEAM ACCESS</span><h2>Invite a teammate</h2></div><button className="icon-button" onClick={() => setInviteOpen(false)} aria-label="Close invitation"><X size={18}/></button></div>{inviteUrl ? <><p className="invite-result-copy">Your invitation link is ready. Share it directly with {form.email || 'the invited teammate'}; it expires in seven days.</p><div className="invite-link-box"><input readOnly value={inviteUrl}/><button className="button button-primary" onClick={copyInvite}><Copy size={14}/>Copy link</button></div><div className="modal-actions"><button className="button button-secondary" onClick={() => { setInviteUrl(''); setInviteOpen(false); }}>Done</button><button className="button button-primary" onClick={() => setInviteUrl('')}>Invite another</button></div></> : <form onSubmit={invite}><label className="form-label">Work email<input required type="email" placeholder="teammate@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label className="form-label">Workspace role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="employee">Employee</option><option value="manager">Manager</option>{workspace.role === 'owner' && <option value="admin">Admin</option>}</select></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setInviteOpen(false)}>Cancel</button><button className="button button-primary"><MailPlus size={15}/>Create invite link</button></div></form>}</section></div>}
  </section>;
}

export function ProjectsView({ projects, workspace, onCreate, onOpenProject, onRefresh, onNotice }) {
  const [error, setError] = useState('');
  async function archive(project) {
    try {
      await api(`/api/projects/${project._id}/archive`, { method: 'POST', workspaceId: workspace.id });
      await onRefresh();
      onNotice(project.status === 'archived' ? 'Project restored.' : 'Project archived.');
    } catch (requestError) { setError(requestError.message); }
  }
  return <section className="workspace-view"><div className="workspace-view-heading"><div><span className="modal-kicker">YOUR WORK</span><h2>Projects</h2><p>Keep team goals, tasks, and milestones organized.</p></div><button className="button button-primary" onClick={onCreate}><Plus size={15}/>New project</button></div>{error && <p className="form-error" role="alert">{error}</p>}{projects.length ? <div className="project-card-grid">{projects.map((project) => <article className="project-overview-card" key={project._id}><div className="project-overview-top"><span className={`project-icon ${project.color}`}><FolderKanban size={18}/></span><button className="icon-button" onClick={() => archive(project)} aria-label={project.status === 'archived' ? 'Restore project' : 'Archive project'}><MoreHorizontal size={17}/></button></div><h3>{project.name}</h3><p>{project.description || 'No description yet.'}</p><div className="project-progress"><span><strong>{Object.values(project.taskCounts || {}).reduce((sum, count) => sum + count, 0)}</strong> tasks</span><span>{project.status === 'archived' ? 'Archived' : 'Active'}</span></div><div className="project-counts">{['Backlog', 'In Progress', 'In Review', 'Done'].map((status) => <span key={status}>{status}: <strong>{project.taskCounts?.[status] || 0}</strong></span>)}</div><button className="project-open" onClick={() => onOpenProject?.(project)}>Open project <ArrowUpRight size={13}/></button></article>)}</div> : <div className="workspace-empty project-empty"><FolderKanban size={24}/><strong>No projects yet</strong><span>Create a project to start organizing work.</span><button className="button button-primary" onClick={onCreate}><Plus size={15}/>Create project</button></div>}</section>;
}

export function SettingsView({ user, onUserUpdate, onNotice }) {
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setName(user?.name || ''), [user?.name]);
  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api('/api/auth/profile', { method: 'PATCH', body: { name } });
      onUserUpdate(result.user); onNotice('Profile updated.');
    } catch (requestError) { setError(requestError.message); } finally { setBusy(false); }
  }
  return <section className="workspace-view"><div className="workspace-view-heading"><div><span className="modal-kicker">PREFERENCES</span><h2>Settings</h2><p>Manage your profile details for TaskFlow Pro.</p></div></div><form className="panel settings-panel" onSubmit={saveProfile}><div className="settings-section-heading"><strong>Profile</strong><span>Your name is visible to workspace teammates.</span></div><label className="form-label">Full name<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)}/></label><label className="form-label">Email address<input disabled value={user?.email || ''}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy || name.trim() === user?.name}>{busy ? 'Saving…' : 'Save profile'}</button></form></section>;
}
