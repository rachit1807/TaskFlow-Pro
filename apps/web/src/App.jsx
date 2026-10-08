import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowDownUp, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Command, Filter, FolderKanban, Kanban, LayoutDashboard, ListTodo, LogIn, MoreHorizontal, Plus,
  Search, Settings2, SlidersHorizontal, Sparkles, Users, X
} from 'lucide-react';
import { api } from './api.js';
import AuthModal from './AuthModal.jsx';
import BoardView from './BoardView.jsx';
import TaskDetailModal from './TaskDetailModal.jsx';
import NotificationCenter from './NotificationCenter.jsx';
import { ProjectsView, SettingsView, TeamView } from './WorkspaceViews.jsx';

const initialTasks = [
  { id: 'TF-248', title: 'Finalize onboarding flow', project: 'Website redesign', status: 'In Progress', priority: 'High', owner: 'Olivia Rhye', initials: 'OR', color: 'lavender', due: 'Today' },
  { id: 'TF-247', title: 'Review Q4 campaign assets', project: 'Growth campaign', status: 'In Review', priority: 'Medium', owner: 'Phoenix Baker', initials: 'PB', color: 'peach', due: 'Today' },
  { id: 'TF-246', title: 'Set up analytics events', project: 'Mobile app', status: 'Backlog', priority: 'Urgent', owner: 'Lana Steiner', initials: 'LS', color: 'mint', due: 'Oct 10' },
  { id: 'TF-245', title: 'Update component library', project: 'Website redesign', status: 'Done', priority: 'Low', owner: 'Demi Wilkinson', initials: 'DW', color: 'blue', due: 'Oct 09' },
];

const nav = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'My tasks', icon: ListTodo, count: '8' },
  { label: 'Board', icon: Kanban },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Team', icon: Users },
  { label: 'Activity', icon: Activity },
];

function Avatar({ initials, color = 'lavender', small = false }) {
  return <span className={`avatar ${color} ${small ? 'small' : ''}`}>{initials}</span>;
}

function apiTaskToRow(task) {
  const owner = task.assignees?.[0] || task.createdBy || { name: 'Unassigned' };
  const initials = owner.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return { id: task._id, key: task.key, title: task.title, description: task.description, labels: task.labels, dueDate: task.dueDate, assigneeIds: task.assignees?.map((assignee) => assignee._id) || [], project: task.project?.name || 'Unknown project', status: task.status, priority: task.priority, owner: owner.name, initials, color: 'blue', due: task.dueDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(task.dueDate)) : 'No date', projectId: task.project?._id };
}

function App() {
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
  const [activeNav, setActiveNav] = useState('Overview');
  const [activeTab, setActiveTab] = useState('All tasks');
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showCreate, setShowCreate] = useState(false);
  const [showProjectCreate, setShowProjectCreate] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activities, setActivities] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [notice, setNotice] = useState('');
  const [tasks, setTasks] = useState(initialTasks);
  const [form, setForm] = useState({ title: '', description: '', project: '', priority: 'Medium', dueDate: '', labels: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite'));

  async function loadWorkspaceData(workspaceId) {
    setLoadingData(true);
    try {
      const [projectResult, taskResult] = await Promise.all([
        api('/api/projects?includeArchived=true', { workspaceId }),
        api('/api/tasks?limit=100', { workspaceId }),
      ]);
      const activityResult = await api('/api/activity?limit=8', { workspaceId });
      const firstActiveProject = projectResult.projects?.find((project) => project.status === 'active');
      setProjects(projectResult.projects || []);
      setTasks((taskResult.tasks || []).map(apiTaskToRow));
      setActivities(activityResult.activities || []);
      setForm((current) => ({ ...current, project: firstActiveProject?._id || '' }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingData(false);
    }
  }

  async function acceptPendingInvite() {
    if (!inviteToken) return null;
    const result = await api('/api/workspace/invitations/accept', { method: 'POST', body: { token: inviteToken } });
    window.history.replaceState({}, '', window.location.pathname);
    const session = await api('/api/auth/me');
    setWorkspaces(session.workspaces || []);
    const joinedWorkspace = session.workspaces?.find((item) => item.id === String(result.workspace)) || session.workspaces?.[0];
    setUser(session.user);
    setWorkspace(joinedWorkspace || null);
    if (joinedWorkspace) await loadWorkspaceData(joinedWorkspace.id);
    setNotice(`You joined ${joinedWorkspace?.name || 'the workspace'}.`);
    return joinedWorkspace;
  }

  useEffect(() => {
    api('/api/auth/me').then(({ user: currentUser, workspaces: available }) => {
      const selectedWorkspace = available?.[0];
      if (!selectedWorkspace) return;
      setWorkspaces(available || []);
      setUser(currentUser);
      setWorkspace(selectedWorkspace);
      if (inviteToken) acceptPendingInvite().catch((error) => setNotice(error.message));
      else loadWorkspaceData(selectedWorkspace.id);
    }).catch(() => { if (inviteToken) setShowAuth(true); });
  }, []);

  function handleAuthenticated(result) {
    const selectedWorkspace = result.workspace || result.workspaces?.[0];
    setWorkspaces(result.workspace ? [result.workspace] : result.workspaces || []);
    setUser(result.user);
    setWorkspace(selectedWorkspace || null);
    setShowAuth(false);
    if (selectedWorkspace) loadWorkspaceData(selectedWorkspace.id);
    setNotice(`Welcome${result.user?.name ? `, ${result.user.name.split(' ')[0]}` : ''}!`);
    window.setTimeout(() => setNotice(''), 3200);
    if (inviteToken) acceptPendingInvite().catch((error) => setNotice(error.message));
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
    setProjects([]);
    setTasks(initialTasks);
    setNotice('You have signed out.');
  }

  function switchWorkspace(nextWorkspace) {
    setWorkspace(nextWorkspace);
    setSelectedProjectId('');
    setShowWorkspaceMenu(false);
    setActiveNav('Overview');
    setActiveTab('All tasks');
    setQuery('');
    loadWorkspaceData(nextWorkspace.id);
  }

  async function createProject(event) {
    event.preventDefault();
    if (!workspace?.id) return;
    try {
      await api('/api/projects', { method: 'POST', workspaceId: workspace.id, body: projectForm });
      const result = await api('/api/projects?includeArchived=true', { workspaceId: workspace.id });
      setProjects(result.projects || []);
      setForm((current) => ({ ...current, project: result.projects?.find((project) => project.status === 'active')?._id || '' }));
      setProjectForm({ name: '', description: '' });
      setShowProjectCreate(false);
      setNotice('Project created.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function toggleTask(task) {
    const nextStatus = task.status === 'Done' ? 'Backlog' : 'Done';
    if (!user) return setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', workspaceId: workspace.id, body: { status: nextStatus } });
      await loadWorkspaceData(workspace.id);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function moveTask(taskId, status) {
    if (!user) return setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
    try {
      await api(`/api/tasks/${taskId}`, { method: 'PATCH', workspaceId: workspace.id, body: { status } });
      await loadWorkspaceData(workspace.id);
    } catch (error) {
      setNotice(error.message);
    }
  }

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (activeNav === 'My tasks' && user && !task.assigneeIds?.includes(user.id)) return false;
    const matchesQuery = `${task.title} ${task.project} ${task.owner} ${task.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = activeTab === 'All tasks' || (activeTab === 'In progress' ? task.status === 'In Progress' : task.status === activeTab);
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
    return matchesQuery && matchesTab && matchesPriority;
  }).sort((first, second) => (first.title || '').localeCompare(second.title || '') * (sortDirection === 'asc' ? 1 : -1)), [tasks, query, activeTab, user, priorityFilter, sortDirection]);

  async function createTask(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (user) {
      if (!workspace?.id) return setNotice('Choose a workspace before creating a task.');
      if (!form.project) return setNotice('Create a project before adding tasks.');
      try {
      await api('/api/tasks', { method: 'POST', workspaceId: workspace.id, body: { title: form.title.trim(), description: form.description, project: form.project, priority: form.priority, dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null, labels: form.labels.split(',').map((label) => label.trim()).filter(Boolean) } });
        await loadWorkspaceData(workspace.id);
      } catch (error) {
        setNotice(error.message);
        return;
      }
    } else {
    setTasks([{ id: `TF-${248 + tasks.length}`, title: form.title.trim(), project: form.project, status: 'Backlog', priority: form.priority, owner: 'You', initials: 'YO', color: 'blue', due: form.dueDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${form.dueDate}T12:00:00`)) : 'No date' }, ...tasks]);
    }
    setForm({ title: '', description: '', project: projects[0]?._id || 'Website redesign', priority: 'Medium', dueDate: '', labels: '' });
    setShowCreate(false);
    setNotice('Task created and added to your backlog.');
    window.setTimeout(() => setNotice(''), 3200);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><span /><span /><span /><span /></span><span>taskflow<span className="brand-pro">pro</span></span></div>
        <div className="workspace-switch-wrap"><button className="workspace-switch" onClick={() => user ? setShowWorkspaceMenu((open) => !open) : setShowAuth(true)} aria-expanded={showWorkspaceMenu}><span className="workspace-icon">{workspace?.name?.[0]?.toUpperCase() || 'N'}</span><span className="workspace-copy"><strong>{workspace?.name || 'Nova Studio'}</strong><small>{user ? workspace?.role || 'Workspace' : 'Demo workspace'}</small></span><ChevronDown size={15} /></button>{showWorkspaceMenu && user && <div className="workspace-switch-menu" role="menu">{workspaces.map((item) => <button role="menuitem" key={item.id} className={item.id === workspace?.id ? 'selected' : ''} onClick={() => switchWorkspace(item)}><span className="workspace-icon">{item.name?.[0]?.toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.role}</small></span>{item.id === workspace?.id && <Check size={14}/>}</button>)}</div>}</div>
        <div className="side-label">WORKSPACE</div>
        <nav className="primary-nav">
          {nav.map(({ label, icon: Icon, count }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count && <span className="nav-count">{count}</span>}</button>)}
        </nav>
        <div className="project-heading"><span className="side-label">YOUR PROJECTS</span><button aria-label="Add project" onClick={() => user ? setShowProjectCreate(true) : setShowAuth(true)}><Plus size={16} /></button></div>
        <div className="project-links">{(user ? projects.map((project) => ({ id: project._id, name: project.name, color: project.color })) : [{ name: 'Website redesign', color: 'purple' }, { name: 'Mobile app', color: 'orange' }, { name: 'Growth campaign', color: 'green' }]).map((project) => <button key={project.id || project.name} className={selectedProjectId === project.id ? 'selected-project' : ''} onClick={() => { if (project.id) { setSelectedProjectId(project.id); setActiveNav('Board'); } else setShowAuth(true); }}><span className={`project-dot ${project.color}`} />{project.name}</button>)}<button className="add-project" onClick={() => user ? setShowProjectCreate(true) : setShowAuth(true)}><Plus size={14} />Add project</button></div>
        <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={16} /></div><strong>Make space for great work</strong><p>Invite your team and keep every project moving.</p><button onClick={() => user ? setActiveNav('Team') : setShowAuth(true)}>Explore workspace <ArrowRight size={13} /></button></div><button className={`nav-item ${activeNav === 'Settings' ? 'active' : ''}`} onClick={() => user ? setActiveNav('Settings') : setShowAuth(true)}><Settings2 size={17} /><span>Settings</span></button><button className="profile-row profile-button" onClick={() => user ? signOut() : setShowAuth(true)}><Avatar initials={user?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'RT'} color="blue" /><span className="profile-copy"><strong>{user?.name || 'Rachit Tripathi'}</strong><small>{user ? 'Sign out' : 'Sign in to save your work'}</small></span><MoreHorizontal size={18} /></button></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav === 'Overview' ? 'Overview' : activeNav}</strong></div><div className="topbar-actions"><button className="search-trigger" onClick={() => document.querySelector('#task-search')?.focus()}><Search size={15} /><span>Search anything...</span><kbd><Command size={11} /> K</kbd></button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => user ? setShowNotifications(!showNotifications) : setNotice('Sign in to see workspace notifications.')}><Bell size={18} /><i /></button>{showNotifications && user && workspace && <NotificationCenter workspace={workspace} onClose={() => setShowNotifications(false)} onNotice={setNotice}/>}<span className="topbar-divider" />{user ? <button className="avatar-button" aria-label="Sign out" onClick={signOut}><Avatar initials={user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()} color="blue" small /></button> : <button className="button button-secondary sign-in-button" onClick={() => setShowAuth(true)}><LogIn size={14}/>Sign in</button>}</div></header>

        <div className="page-content">
          <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" />{today}{user && <span className="connected-label">CONNECTED</span>}</div><h1>Good morning, {user?.name?.split(' ')[0] || 'Rachit'} <span className="wave">✳</span></h1><p className="page-subtitle">Here’s what’s happening across your workspace today.</p></div><button className="button button-primary" onClick={() => user ? setShowCreate(true) : setShowAuth(true)}><Plus size={17} />Create task</button></div>

          <section className="stats-grid" aria-label="Workspace summary"><article className="stat-card"><div className="stat-top"><span>Active projects</span><span className="stat-icon violet"><FolderKanban size={17} /></span></div><div className="stat-value">{user ? projects.filter((project) => project.status === 'active').length : 12} {!user && <span className="stat-change positive"><ArrowUpRight size={13} /> 2</span>}</div><div className="stat-foot">{user ? 'In this workspace' : 'vs. 10 last month'}</div><div className="mini-bars"><i style={{height:'39%'}}/><i style={{height:'57%'}}/><i style={{height:'46%'}}/><i style={{height:'68%'}}/><i style={{height:'54%'}}/><i style={{height:'77%'}}/><i className="bar-current" style={{height:'92%'}}/></div></article>
            <article className="stat-card"><div className="stat-top"><span>Tasks completed</span><span className="stat-icon green"><CheckCheck size={17} /></span></div><div className="stat-value">{user ? tasks.filter((task) => task.status === 'Done').length : 38} {!user && <span className="stat-change positive"><ArrowUpRight size={13} /> 12.5%</span>}</div><div className="stat-foot">{user ? 'Across your workspace' : 'vs. last week'}</div><div className="progress-track"><span style={{width: user ? `${tasks.length ? Math.round(tasks.filter((task) => task.status === 'Done').length / tasks.length * 100) : 0}%` : '72%'}} /></div><div className="progress-caption"><span>{user ? 'Completion rate' : 'Weekly goal'}</span><strong>{user ? `${tasks.length ? Math.round(tasks.filter((task) => task.status === 'Done').length / tasks.length * 100) : 0}%` : '72%'}</strong></div></article>
            <article className="stat-card"><div className="stat-top"><span>Due this week</span><span className="stat-icon amber"><CalendarDays size={17} /></span></div><div className="stat-value">{user ? tasks.filter((task) => task.due !== 'No date').length : 9} <span className="stat-unit">tasks</span></div><div className="stat-foot">{user ? 'Tasks with a due date' : '3 due today'}</div><div className="due-stack"><span className="due-segment a"/><span className="due-segment b"/><span className="due-segment c"/><span className="due-segment d"/><span className="due-legend">{user ? `Across ${projects.length} projects` : 'Across 4 projects'}</span></div></article>
            <article className="stat-card team-stat"><div className="stat-top"><span>Team productivity</span><span className="stat-icon blue"><Activity size={17} /></span></div><div className="stat-value">{user ? '—' : <>84<span className="stat-unit">%</span><span className="stat-change positive"><ArrowUpRight size={13} /> 6.4%</span></>}</div><div className="stat-foot">{user ? 'Team insights coming soon' : 'Team is on a great streak'}</div><div className="team-avatars">{user ? <span className="team-caption">Invite teammates to collaborate</span> : <><Avatar initials="OR" color="lavender" small/><Avatar initials="PB" color="peach" small/><Avatar initials="LS" color="mint" small/><Avatar initials="DW" color="blue" small/><span className="avatar-more">+4</span><span className="team-caption">this week</span></>}</div></article>
          </section>

          {activeNav === 'Team' ? user ? <TeamView workspace={workspace} user={user} onNotice={setNotice}/> : <div className="workspace-empty project-empty"><Users size={24}/><strong>Sign in to manage your team</strong><span>Workspace members, roles, and invitations live here.</span><button className="button button-primary" onClick={() => setShowAuth(true)}><LogIn size={14}/>Sign in</button></div> : activeNav === 'Settings' ? user ? <SettingsView user={user} onUserUpdate={setUser} onNotice={setNotice}/> : <div className="workspace-empty project-empty"><Settings2 size={24}/><strong>Sign in to manage your profile</strong><button className="button button-primary" onClick={() => setShowAuth(true)}><LogIn size={14}/>Sign in</button></div> : activeNav === 'Projects' ? <ProjectsView projects={projects} workspace={workspace} onCreate={() => user ? setShowProjectCreate(true) : setShowAuth(true)} onOpenProject={(project) => { setSelectedProjectId(project._id); setActiveNav('Board'); }} onRefresh={() => workspace && loadWorkspaceData(workspace.id)} onNotice={setNotice}/> : activeNav === 'Board' ? <BoardView tasks={selectedProjectId ? tasks.filter((task) => task.projectId === selectedProjectId) : tasks} projectName={projects.find((project) => project._id === selectedProjectId)?.name} onMove={moveTask} onSelect={setSelectedTask}/> : activeNav === 'Activity' ? <section className="workspace-view"><div className="workspace-view-heading"><div><span className="modal-kicker">WORKSPACE</span><h2>Activity</h2><p>Recent changes across your projects and tasks.</p></div></div>{user ? activities.length ? <div className="panel activity-list activity-page">{activities.map((activity) => <div className="activity-item" key={activity._id}><Avatar initials={activity.actor?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'} color="blue" small/><div><p><strong>{activity.actor?.name || 'A teammate'}</strong> {activity.action.replaceAll('.', ' ')}</p><span>{activity.details?.title || activity.details?.key || activity.entityType}</span><small>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.createdAt))}</small></div></div>)}</div> : <div className="workspace-empty">No workspace updates yet.</div> : <div className="workspace-empty project-empty"><Activity size={24}/><strong>Sign in to view activity</strong><span>Recent project and task changes appear here.</span><button className="button button-primary" onClick={() => setShowAuth(true)}><LogIn size={14}/>Sign in</button></div>}</section> : <section className="content-grid"><div className="panel tasks-panel"><div className="panel-heading"><div><div className="panel-title-row"><h2>{activeNav === 'My tasks' ? 'My tasks' : 'Workspace tasks'}</h2><span className="task-total">{filteredTasks.length}</span></div><p>{user ? activeNav === 'My tasks' ? 'Tasks assigned to you.' : 'Work across your workspace.' : 'Your work, all in one place.'}</p></div><button className="text-button" onClick={() => setActiveNav('My tasks')}>View all <ArrowRight size={14} /></button></div>
            <div className="task-toolbar"><div className="tabs">{['All tasks', 'In progress', 'In Review', 'Done'].map((tab) => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}{tab === 'All tasks' && <span>{tasks.length}</span>}</button>)}</div><div className="table-tools"><label className="inline-search"><Search size={14} /><input id="task-search" aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="priority-filter"><Filter size={14}/><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option>All</option><option>Urgent</option><option>High</option><option>Medium</option><option>Low</option></select></label><button className="tool-button" aria-label={`Sort tasks ${sortDirection === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}><ArrowDownUp size={15} /></button></div></div>
            <div className="task-table"><div className="table-header"><span>Task name</span><span>Project</span><span>Status</span><span>Priority</span><span>Due date</span></div>{filteredTasks.map((task) => <div className="task-row" key={task.id}><div className="task-name"><button className={`task-check ${task.status === 'Done' ? 'checked' : ''}`} aria-label={`Mark ${task.title} done`} onClick={() => toggleTask(task)}>{task.status === 'Done' && <Check size={12} />}</button><div><button className="task-title-link" onClick={() => setSelectedTask(task)}>{task.title}</button><small>{task.key || task.id} <span>·</span> <Avatar initials={task.initials} color={task.color} small /> <span className="owner-name">{task.owner}</span></small></div></div><span className="project-cell"><i className={`project-dot ${task.project === 'Website redesign' ? 'purple' : task.project === 'Mobile app' ? 'orange' : 'green'}`} />{task.project}</span><span><span className={`status-pill ${task.status.toLowerCase().replaceAll(' ', '-')}`}><i />{task.status}</span></span><span className={`priority-cell ${task.priority.toLowerCase()}`}>{task.priority === 'Urgent' ? <ArrowUpRight size={14} /> : task.priority === 'High' ? <ArrowUpRight size={14} /> : <ArrowDown size={14} />}{task.priority}</span><span className={`due-cell ${task.due === 'Today' ? 'due-today' : ''}`}><Clock3 size={13} />{task.due}</span></div>)}{(filteredTasks.length === 0 || loadingData) && <div className="empty-state">{loadingData ? 'Loading workspace…' : user && !projects.length ? 'Create a project to start adding tasks.' : 'No tasks match this view.'}</div>}</div>
            <button className="table-footer" onClick={() => setActiveNav('My tasks')}>See all tasks <ArrowRight size={14} /></button>
          </div>

            <aside className="right-column"><section className="panel activity-panel"><div className="panel-heading compact"><div><h2>Activity</h2><p>{user ? 'Recent workspace changes.' : 'Recent updates from your team.'}</p></div><button className="icon-button subtle" aria-label="More activity options"><MoreHorizontal size={18} /></button></div>{user ? activities.length ? <div className="activity-list">{activities.slice(0, 4).map((activity) => <div className="activity-item" key={activity._id}><Avatar initials={activity.actor?.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'} color="blue" small/><div><p><strong>{activity.actor?.name || 'A teammate'}</strong> {activity.action.replaceAll('.', ' ')}</p><span>{activity.details?.title || activity.details?.key || activity.entityType}</span><small>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.createdAt))}</small></div></div>)}</div> : <div className="activity-placeholder">Your team’s changes will appear here.</div> : <div className="activity-list"><div className="activity-item"><Avatar initials="OR" color="lavender" small/><div><p><strong>Olivia Rhye</strong> completed a task</p><span>Finalize homepage wireframes</span><small>12 min ago</small></div></div><div className="activity-item"><Avatar initials="PB" color="peach" small/><div><p><strong>Phoenix Baker</strong> left a comment</p><span>“The new direction looks great!”</span><small>48 min ago</small></div></div><div className="activity-item"><Avatar initials="LS" color="mint" small/><div><p><strong>Lana Steiner</strong> joined a project</p><span><i className="project-dot orange"/> Mobile app</span><small>2 hours ago</small></div></div><div className="activity-item"><Avatar initials="DW" color="blue" small/><div><p><strong>Demi Wilkinson</strong> created a task</p><span>Update component library</span><small>Yesterday</small></div></div></div>}<button className="table-footer activity-footer" onClick={() => setActiveNav('Activity')}>View activity <ArrowRight size={14} /></button></section>
            <section className="focus-card"><div className="focus-decoration"><span/><span/><span/></div><div className="focus-head"><span className="focus-icon"><Sparkles size={15}/></span><span>{user ? 'WORKSPACE TIP' : 'TEAM FOCUS'}</span><MoreHorizontal size={18}/></div><h3>{user ? <>Start with<br/>one clear project.</> : <>Small steps,<br/>big momentum.</>}</h3><p>{user ? <>Create a project and break the work into tasks your team can track.</> : <>Your team completed <strong>38 tasks</strong> this week. Keep it going!</>}</p><div className="focus-bottom"><div className="focus-progress"><span/></div><span>{user ? `${projects.length} projects` : '4 days left'}</span></div></section>
          </aside></section>}
          <footer className="page-footer"><span>© 2026 TaskFlow Pro</span><span><span className="live-dot"/> All systems operational</span><a href="http://localhost:4000/api/health" target="_blank" rel="noreferrer">API status <ArrowUpRight size={12}/></a></footer>
        </div>
      </main>

      {notice && <div className="toast"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
      {showCreate && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowCreate(false)}><form className="create-modal" onSubmit={createTask}><div className="modal-heading"><div><span className="modal-kicker">NEW WORK</span><h2>Create a task</h2></div><button type="button" className="icon-button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={18}/></button></div><label className="form-label">Task name<input autoFocus required minLength={2} maxLength={160} placeholder="What needs to get done?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label className="form-label">Description<textarea rows="3" maxLength={10000} placeholder="Add context, acceptance criteria, or notes" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}/></label><div className="form-grid"><label className="form-label">Project<select required value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>{user ? projects.filter((project) => project.status === 'active').map((project) => <option key={project._id} value={project._id}>{project.name}</option>) : <><option>Website redesign</option><option>Mobile app</option><option>Growth campaign</option></>}</select></label><label className="form-label">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></label></div><div className="form-grid"><label className="form-label">Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })}/></label><label className="form-label">Labels<input placeholder="design, launch" value={form.labels} onChange={(event) => setForm({ ...form, labels: event.target.value })}/></label></div><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16}/>Create task</button></div></form></div>}
      {showProjectCreate && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowProjectCreate(false)}><form className="create-modal" onSubmit={createProject}><div className="modal-heading"><div><span className="modal-kicker">WORKSPACE</span><h2>Create a project</h2></div><button type="button" className="icon-button" onClick={() => setShowProjectCreate(false)} aria-label="Close"><X size={18}/></button></div><label className="form-label">Project name<input autoFocus required minLength={2} maxLength={100} placeholder="Website redesign" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}/></label><label className="form-label">Description<textarea rows="3" maxLength={2000} placeholder="What is this project about?" value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}/></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setShowProjectCreate(false)}>Cancel</button><button className="button button-primary" type="submit"><Plus size={16}/>Create project</button></div></form></div>}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthenticated={handleAuthenticated}/>}
      {selectedTask && <TaskDetailModal task={selectedTask} workspace={workspace} user={user} onClose={() => setSelectedTask(null)} onUpdated={() => { setSelectedTask(null); if (workspace) loadWorkspaceData(workspace.id); }} onNotice={setNotice}/>}
    </div>
  );
}

export default App;
