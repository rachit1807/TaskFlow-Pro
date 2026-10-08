import { useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { api } from './api.js';

export default function NotificationCenter({ workspace, onClose, onNotice }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  async function load() {
    try {
      const result = await api('/api/notifications', { workspaceId: workspace.id });
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (requestError) { setError(requestError.message); }
  }

  useEffect(() => { load(); }, [workspace?.id]);

  async function markRead(notification) {
    try {
      await api(`/api/notifications/${notification._id}/read`, { method: 'PATCH', workspaceId: workspace.id });
      setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - (notification.readAt ? 0 : 1)));
    } catch (requestError) { setError(requestError.message); }
  }

  async function markAllRead() {
    try {
      await api('/api/notifications/read-all', { method: 'POST', workspaceId: workspace.id });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
      onNotice('All notifications marked as read.');
    } catch (requestError) { setError(requestError.message); }
  }

  return <div className="notification-popover" role="dialog" aria-label="Notifications"><div className="notification-head"><span><Bell size={15}/>Notifications{unreadCount > 0 && <i>{unreadCount}</i>}</span><div>{unreadCount > 0 && <button onClick={markAllRead} aria-label="Mark all read"><CheckCheck size={15}/></button>}<button onClick={onClose} aria-label="Close notifications"><X size={16}/></button></div></div>{error && <p className="form-error">{error}</p>}{notifications.length ? <div className="notification-list">{notifications.map((item) => <button className={`notification-item ${item.readAt ? 'read' : ''}`} key={item._id} onClick={() => markRead(item)}><span className="notification-unread-dot"/><span><strong>{item.actor?.name || 'TaskFlow Pro'}</strong><small>{item.message}</small><time>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt))}</time></span></button>)}</div> : <div className="notification-empty"><Bell size={20}/><strong>All caught up</strong><span>New workspace updates will show up here.</span></div>}</div>;
}
