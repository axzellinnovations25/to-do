import { useState } from 'react';
import { supabase, type Task } from '../lib/supabase';
import { Trash2, Edit2, X, Check, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TaskItemProps {
  task: Task;
  currentUserId: string;
  creatorName?: string;
  onUpdated?: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
}

export const TaskItem = ({ task, currentUserId, creatorName, onUpdated, onDeleted }: TaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.text);
  const [isLoading, setIsLoading] = useState(false);

  const displayAuthorName = creatorName || (task.created_by === currentUserId ? 'You' : 'Partner...');

  const handleToggleComplete = async () => {
    setIsLoading(true);
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);
      
    setIsLoading(false);
    
    if (error) {
      alert("Failed to update status: " + error.message);
    } else if (onUpdated) {
      onUpdated({ ...task, is_completed: !task.is_completed });
    }
  };

  const handleDelete = async () => {
    // We already ask for confirmation in MainLayout for Room, but here we can just skip or add a small confirm
    if (!confirm("Delete this task?")) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);
      
    setIsLoading(false);
    
    if (error) {
      alert("Failed to delete task: " + error.message);
    } else if (onDeleted) {
      onDeleted(task.id);
    }
  };

  const handleUpdate = async () => {
    if (!editValue.trim() || editValue === task.text) {
      setIsEditing(false);
      setEditValue(task.text);
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase
      .from('tasks')
      .update({ text: editValue.trim() })
      .eq('id', task.id);
      
    setIsLoading(false);
    
    if (error) {
      alert("Failed to save edit: " + error.message);
    } else {
      setIsEditing(false);
      if (onUpdated) onUpdated({ ...task, text: editValue.trim() });
    }
  };

  const isOwner = task.created_by === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(task.created_at), { addSuffix: true });

  return (
    <div className={`task-row ${isLoading ? 'opacity-50' : ''} group`}>
      {/* Far Left Checkbox */}
      {!isEditing && (
        task.is_completed ? (
          <div
            className="task-row-checkbox completed"
            title="Task completed"
          >
            <Check size={14} className="check-icon" />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleToggleComplete}
            className="task-row-checkbox"
            title="Mark Done"
          >
            <Check size={14} className="check-icon" />
          </button>
        )
      )}

      {/* Center Content */}
      <div className="task-content">
        {isEditing ? (
          <div className="edit-mode">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-input edit-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdate();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditValue(task.text);
                }
              }}
            />
            <div className="edit-actions">
              <button type="button" onClick={handleUpdate} className="btn-icon text-green-500 hover-green">
                <Check size={16} />
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditValue(task.text);
                }} 
                className="btn-icon text-red-500 hover-red"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="task-text-group">
            <p className={`task-text ${task.is_completed ? 'line-through text-slate-500' : ''}`}>{task.text}</p>
            <div className="task-meta">
              <span className="task-time">
                <Clock size={12} className="inline mr-1" />
                {timeAgo}
              </span>
              <span className="task-author">
                by <span className={`task-author-badge ${isOwner ? 'text-green-400' : ''}`}>{displayAuthorName}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Far Right Hover Actions */}
      {!isEditing && isOwner && (
        <div className="task-actions-hover">
          {!task.is_completed && (
            <button type="button" onClick={() => setIsEditing(true)} className="btn-icon hover-blue" title="Edit">
              <Edit2 size={16} />
            </button>
          )}
          <button type="button" onClick={handleDelete} className="btn-icon hover-red" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
