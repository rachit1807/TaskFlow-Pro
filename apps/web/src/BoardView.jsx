import { ArrowRight, CalendarDays, Circle, MoreHorizontal } from 'lucide-react';
import { TASK_STATUSES } from '@taskflow/shared';

const statusClass = (status) => status.toLowerCase().replaceAll(' ', '-');

export default function BoardView({ tasks, projectName, onMove, onSelect }) {
  function handleDrop(event, status) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/taskflow-task');
    if (taskId) onMove(taskId, status);
  }

  return <section className="board-panel" aria-label="Kanban board">
    <div className="board-heading"><div><span className="modal-kicker">PROJECT WORKFLOW</span><h2>{projectName || 'Task board'}</h2><p>Move a task between stages by dragging its card or changing its status.</p></div><span className="board-count">{tasks.length} tasks</span></div>
    <div className="board-columns">{TASK_STATUSES.map((status) => {
      const items = tasks.filter((task) => task.status === status);
      return <div key={status} className={`board-column ${statusClass(status)}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, status)}>
        <div className="board-column-heading"><span className="board-status-dot"/><strong>{status}</strong><span>{items.length}</span><button aria-label={`More ${status} options`}><MoreHorizontal size={16}/></button></div>
        <div className="board-cards">{items.map((task) => <article key={task.id} className="board-task" draggable onDragStart={(event) => event.dataTransfer.setData('text/taskflow-task', task.id)}>
          <div className="board-task-top"><span className="board-task-key">{task.key || task.id}</span><span className={`board-priority ${task.priority.toLowerCase()}`}><Circle size={7} fill="currentColor"/>{task.priority}</span></div>
          <button className="board-task-title" onClick={() => onSelect(task)}>{task.title}</button><div className="board-project"><i className={`project-dot ${task.project === 'Website redesign' ? 'purple' : task.project === 'Mobile app' ? 'orange' : 'green'}`}/>{task.project}</div>
          <div className="board-task-footer"><span className="board-owner"><span className={`avatar small ${task.color}`}>{task.initials}</span>{task.owner}</span><span className="board-due"><CalendarDays size={12}/>{task.due}</span></div>
          <label className="board-move-label">Move to <ArrowRight size={12}/><select aria-label={`Move ${task.title}`} value={task.status} onChange={(event) => onMove(task.id, event.target.value)}>{TASK_STATUSES.map((option) => <option key={option}>{option}</option>)}</select></label>
        </article>)}</div>
      </div>;
    })}</div>
  </section>;
}
