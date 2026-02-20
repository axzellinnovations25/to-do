import { useState, useEffect } from 'react';
import { supabase, type Task } from '../lib/supabase';
import { CheckCircle, Trash2, Edit2, X, Check, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TaskItemProps {
  task: Task;
  currentUserId: string;
  currentUserEmail: string;
}

export const TaskItem = ({ task, currentUserId, currentUserEmail }: TaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.text);
  const [isLoading, setIsLoading] = useState(false);
  const [creatorEmail, setCreatorEmail] = useState('Loading...');

  useEffect(() => {
    // If we are the creator, we don't need to fetch it
    if (task.created_by === currentUserId) {
      setCreatorEmail(currentUserEmail);
    } else {
      // In a real app we might fetch user profiles here, but without a profile table,
      // it's tricky to get another user's email purely from Auth.
      // So, we'll just indicate it's "Partner" for simplicity unless we set up RPC.
      // For this requirement limit, "Partner" is an acceptable placeholder.
      setCreatorEmail('Partner');
    }
  }, [task.created_by, currentUserId, currentUserEmail]);

  const handleComplete = async () => {
    setIsLoading(true);
    await supabase
      .from('tasks')
      .update({ is_completed: true })
      .eq('id', task.id);
    setIsLoading(false);
  };

  const handleDelete = async () => {
    setIsLoading(true);
    await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);
    setIsLoading(false);
  };

  const handleUpdate = async () => {
    if (!editValue.trim() || editValue === task.text) {
      setIsEditing(false);
      setEditValue(task.text);
      return;
    }
    
    setIsLoading(true);
    await supabase
      .from('tasks')
      .update({ text: editValue.trim() })
      .eq('id', task.id);
      
    setIsEditing(false);
    setIsLoading(false);
  };

  const isOwner = task.created_by === currentUserId;
  const timeAgo = formatDistanceToNow(new Date(task.created_at), { addSuffix: true });

  return (
    <div className={`task-card ${isLoading ? 'opacity-50' : ''}`}>
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
              <button onClick={handleUpdate} className="btn-icon text-green-500">
                <Check size={18} />
              </button>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditValue(task.text);
                }} 
                className="btn-icon text-red-500"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ) : (
          <p className="task-text">{task.text}</p>
        )}
        
        <div className="task-meta">
          <span className="task-author">
            Added by <span className={`task-author-badge ${isOwner ? 'text-green-400' : ''}`}>{creatorEmail}</span>
          </span>
          <span className="task-time">
            <Clock size={12} className="inline mr-1" />
            {timeAgo}
          </span>
        </div>
      </div>

      {!isEditing && (
        <div className="task-actions">
          <button onClick={handleComplete} className="btn-icon hover-green group" title="Mark Done">
            <CheckCircle size={20} className="group-hover:fill-green-500/20" />
          </button>
          
          {isOwner && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-icon hover-blue group" title="Edit">
                <Edit2 size={18} />
              </button>
              <button onClick={handleDelete} className="btn-icon hover-red group" title="Delete">
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
