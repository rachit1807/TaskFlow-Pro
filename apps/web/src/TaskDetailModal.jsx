import { useEffect, useState } from 'react';
import { CalendarDays, MessageCircle, Send, X } from 'lucide-react';
import { api } from './api.js';

const initials = (name = '') => name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

export default function TaskDetailModal({ task, workspace, user, onClose, onNotice }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !workspace?.id || !task?.id || task.id.startsWith('TF-')) return;
    setLoading(true);
    api(`/api/tasks/${task.id}/comments`, { workspaceId: workspace.id })
      .then((result) => setComments(result.comments || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [task?.id, workspace?.id, user]);

  async function submitComment(event) {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      const result = await api(`/api/tasks/${task.id}/comments`, { method: 'POST', workspaceId: workspace.id, body: { body } });
      setComments((current) => [...current, result.comment]);
      setBody('');
      onNotice('Comment added.');
    } catch (requestError) { setError(requestError.message); }
  }

  return <div className="modal-backdrop task-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="task-detail-modal" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
    <div className="task-detail-head"><span className="modal-kicker">{task.key || task.id} · {task.project}</span><button className="icon-button" onClick={onClose} aria-label="Close task details"><X size={18}/></button></div>
    <h2 id="task-detail-title">{task.title}</h2><div className="task-detail-meta"><span className={`status-pill ${task.status.toLowerCase().replaceAll(' ', '-')}`}><i/>{task.status}</span><span className={`board-priority ${task.priority.toLowerCase()}`}>{task.priority} priority</span><span><CalendarDays size={13}/>{task.due}</span></div>
    <section className="comments-section"><div className="comments-heading"><MessageCircle size={15}/><h3>Comments</h3><span>{comments.length}</span></div>{loading ? <p className="comment-empty">Loading comments…</p> : comments.length ? <div className="comments-list">{comments.map((comment) => <article className="comment-item" key={comment._id}><span className="avatar blue small">{initials(comment.author?.name)}</span><div><div className="comment-author"><strong>{comment.author?.name || 'Teammate'}</strong><time>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(comment.createdAt))}{comment.editedAt ? ' · edited' : ''}</time></div><p>{comment.body}</p></div></article>)}</div> : <p className="comment-empty">No comments yet. Add the first update for this task.</p>}{error && <p className="form-error" role="alert">{error}</p>}{user ? <form className="comment-form" onSubmit={submitComment}><span className="avatar blue small">{initials(user.name)}</span><textarea aria-label="Write a comment" placeholder="Write a comment…" rows="2" maxLength="4000" value={body} onChange={(event) => setBody(event.target.value)}/><button className="button button-primary" disabled={!body.trim()} aria-label="Send comment"><Send size={14}/></button></form> : <div className="comment-signin">Sign in to join the conversation.</div>}</section>
  </section></div>;
}
