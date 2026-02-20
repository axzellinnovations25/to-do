import { useEffect, useState, useRef } from 'react';
import { supabase, type Task } from '../lib/supabase';
import { TaskItem } from './TaskItem';
import { Copy, Check, Plus } from 'lucide-react';

interface TodoListProps {
  userId: string;
  userEmail: string;
  roomId: string;
  roomName: string;
  inviteCode: string;
}

export const TodoList = ({ userId, userEmail, roomId, roomName, inviteCode }: TodoListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTasks();

    const subscription = supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task;
            if (!newTask.is_completed) {
              setTasks((prev) => [...prev, newTask].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task;
            if (updatedTask.is_completed) {
              setTasks((prev) => prev.filter((t) => t.id !== updatedTask.id));
            } else {
              setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedTask = payload.old;
            setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tasks]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_completed', false)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    setAddingTask(true);
    const { error } = await supabase.from('tasks').insert([
      {
        room_id: roomId,
        text: newTaskText.trim(),
        created_by: userId,
      },
    ]);

    if (!error) {
      setNewTaskText('');
    }
    setAddingTask(false);
  };

  const copyRoomCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="todo-container-full">
      <div className="todo-header">
        <div className="header-info">
          <h2>{roomName}</h2>
          {inviteCode && (
            <div className="room-badge" onClick={copyRoomCode} title="Copy Invite Code">
              <span>Code: {inviteCode}</span>
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </div>
          )}
        </div>
      </div>

      <div className="task-list" ref={scrollRef}>
        {loading ? (
          <div className="loading-state">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No active tasks.</p>
            <p className="empty-subtext">Add a task below or share the Invite Code!</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskItem key={task.id} task={task} currentUserId={userId} currentUserEmail={userEmail} />
          ))
        )}
      </div>

      <form onSubmit={handleAddTask} className="add-task-form">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Add a new task..."
          className="text-input"
          disabled={addingTask}
        />
        <button 
          type="submit" 
          disabled={!newTaskText.trim() || addingTask}
          className="btn btn-primary btn-add"
        >
          <Plus size={20} />
        </button>
      </form>
    </div>
  );
};
