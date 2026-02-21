import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Task } from '../lib/supabase';
import { TaskItem } from './TaskItem';
import { Check, Plus, Settings, Edit2, Trash2, RefreshCw, Share2, X, ChevronRight, Users, ShieldAlert } from 'lucide-react';

interface TodoListProps {
  userId: string;
  roomId: string;
  roomName: string;
  inviteCode: string;
  isCreator: boolean;
  onRenameList: (name: string) => void;
  onDeleteList: () => void;
  onRoomUpdated: () => void;
  onSettingsOpen?: (open: boolean) => void;
}

export const TodoList = ({ userId, roomId, roomName, inviteCode, isCreator, onRenameList, onDeleteList, onRoomUpdated, onSettingsOpen }: TodoListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [showSettings, setShowSettings] = useState(false);
  
  // Profile Preloading for Task Authors
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  
  // Pull to refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);

  const fetchTasks = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    setLoading(true);
    
    // Determine the sorting explicitly
    const isCompletedView = activeTab === 'completed';
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_completed', isCompletedView)
      .order('created_at', { ascending: !isCompletedView });

    if (!error && data) {
      setTasks(data);
      
      // Pre-fetch Creator Profiles efficiently (N+1 Avoidance)
      const uniqueUserIds = [...new Set(data.map(t => t.created_by))].filter(Boolean);
      if (uniqueUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', uniqueUserIds);
          
        if (profileData) {
          const newMap: Record<string, string> = {};
          profileData.forEach(p => {
             if (p.username) newMap[p.id] = p.username;
          });
          setProfilesMap(prev => ({ ...prev, ...newMap }));
        }
      }
    }
    setLoading(false);
    if (isManualRefresh) {
      setTimeout(() => setIsRefreshing(false), 500); // Give user a brief visual feedback that it finished
    }
  }, [roomId, activeTab]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchTasks());

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
            
            const creatorId = newTask.created_by;
            
            // Fetch profile if it's someone new. We use setProfilesMap's updater to safely check 
            // the latest state without putting profilesMap in the dependency array.
            setProfilesMap(prevMap => {
              if (!prevMap[creatorId]) {
                supabase.from('profiles').select('username').eq('id', creatorId).single()
                  .then(({ data }) => {
                    if (data?.username) {
                      setProfilesMap(innerPrev => ({ ...innerPrev, [creatorId]: data.username }));
                    }
                  });
              }
              return prevMap;
            });
            
            if (activeTab === 'active' && !newTask.is_completed) {
              setTasks((prev) => [...prev, newTask].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ));
            } else if (activeTab === 'completed' && newTask.is_completed) {
              setTasks((prev) => [newTask, ...prev].sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              ));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = payload.new as Task;
            if (activeTab === 'active') {
              if (updatedTask.is_completed) setTasks((prev) => prev.filter((t) => t.id !== updatedTask.id));
              else setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
            } else { // activeTab === 'completed'
              if (!updatedTask.is_completed) setTasks((prev) => prev.filter((t) => t.id !== updatedTask.id));
              else setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
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
  }, [roomId, activeTab, fetchTasks]); // Removed profilesMap from dependency array to prevent infinite loops

  // Removed the aggressive auto-scroll logic that was jumping to the bottom

  useEffect(() => {
    void Promise.resolve().then(() => fetchTasks());
  }, [activeTab, fetchTasks]); // Refetch when changing tabs


  // Pull to Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop === 0) {
      touchStartRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isRefreshing) return;
    
    const touchCurrent = e.touches[0].clientY;
    const distance = touchCurrent - touchStartRef.current;
    
    // Only pull if scrolling downwards and we are at the top
    if (distance > 0 && scrollRef.current && scrollRef.current.scrollTop === 0) {
      setIsPulling(true);
      // Max visual stretch limit
      const progress = Math.min(distance * 0.4, 80); 
      setPullProgress(progress);
      
      // Prevent default scrolling when pulling
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    
    if (pullProgress > 60) {
      fetchTasks(true);
    }
    
    touchStartRef.current = null;
    setIsPulling(false);
    setPullProgress(0);
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

  const handleRefreshCode = async () => {
    setShowSettings(false);
    if (!isCreator) return;
    if (!confirm("Generate a new invite code? The old one will immediately stop working.")) return;
    
    setLoading(true);
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { error } = await supabase
      .from('rooms')
      .update({ invite_code: newCode })
      .eq('id', roomId);
      
    setLoading(false);
    
    if (error) {
      alert("Failed to refresh code: " + error.message);
    } else {
      onRoomUpdated();
    }
  };

  return (
    <div className="todo-container-full">
      <div className="todo-header" style={{ paddingBottom: 0, display: showSettings ? 'none' : undefined }}>
        <div className="header-info" style={{ paddingBottom: '1rem', width: '100%' }}>
          <div className="flex justify-between items-start w-full">
            <div>
              <h2>{roomName}</h2>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => {
                  const next = !showSettings;
                  setShowSettings(next);
                  if (onSettingsOpen) onSettingsOpen(next);
                }}
                className="btn-icon p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title={showSettings ? "Back to Tasks" : "List Settings"}
              >
                {showSettings ? (
                  <X size={20} className="text-gray-400" />
                ) : (
                  <Settings size={20} className="text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {!showSettings && (
          <div style={{
            display: 'flex',
            gap: '6px',
            padding: '4px',
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            margin: '0.75rem 0 0',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              onClick={() => setActiveTab('active')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: activeTab === 'active'
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.7))'
                  : 'transparent',
                color: activeTab === 'active' ? '#fff' : 'var(--text-secondary)',
                boxShadow: activeTab === 'active' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              ✓ Need to Do
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                background: activeTab === 'completed'
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.7), rgba(16,185,129,0.6))'
                  : 'transparent',
                color: activeTab === 'completed' ? '#fff' : 'var(--text-secondary)',
                boxShadow: activeTab === 'completed' ? '0 2px 8px rgba(34,197,94,0.25)' : 'none',
              }}
            >
              🏁 Finished
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          zIndex: 100,
          background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
        }}>
          {/* Premium Hero Header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 50%, transparent 100%)',
            borderBottom: '1px solid rgba(99,102,241,0.15)',
            padding: '2.5rem 2rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Back button */}
            <button
              onClick={() => { setShowSettings(false); if (onSettingsOpen) onSettingsOpen(false); }}
              style={{
                position: 'absolute', top: '1rem', left: '1rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px',
                padding: '6px 14px',
                display: 'flex', alignItems: 'center', gap: '6px',
                cursor: 'pointer', color: '#94a3b8',
                fontSize: '0.8rem', fontWeight: '600',
                zIndex: 1,
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#e2e8f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
              title="Back to Tasks"
            >
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back
            </button>
            {/* Background glow orb */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px', height: '200px',
              background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '72px', height: '72px', borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
              border: '1px solid rgba(99,102,241,0.4)',
              color: '#a5b4fc',
              marginBottom: '1rem',
              boxShadow: '0 0 30px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}>
              <Settings size={34} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px', margin: '0 0 0.25rem' }}>
              {roomName}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>List Preferences</p>
          </div>

          {/* Settings Content */}
          <div style={{ padding: '1.5rem', maxWidth: '560px', margin: '0 auto' }}>

            {/* General Section */}
            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>General</p>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem', background: 'var(--bg-secondary)' }}>
              {isCreator && (
                <button
                  onClick={() => { setShowSettings(false); const name = prompt('Enter new list name:', roomName); if (name) onRenameList(name); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', display: 'flex' }}><Edit2 size={18} /></div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#e2e8f0', fontSize: '0.95rem' }}>Rename List</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '1px' }}>Change the display name</div>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
                </button>
              )}
              <button
                onClick={copyRoomCode}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', display: 'flex' }}><Share2 size={18} /></div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#e2e8f0', fontSize: '0.95rem' }}>Share Invite Code</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '1px' }}>Copy code: {inviteCode}</div>
                  </div>
                </div>
                {copied
                  ? <Check size={18} style={{ color: '#4ade80' }} />
                  : <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
                }
              </button>
            </div>

            {/* Danger Zone */}
            {isCreator && (
              <>
                <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', marginLeft: '0.25rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ShieldAlert size={12} /> Danger Zone
                </p>
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '1.5rem', background: 'var(--bg-secondary)' }}>
                  <button
                    onClick={handleRefreshCode}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,146,60,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(251,146,60,0.12)', color: '#fb923c', display: 'flex' }}><RefreshCw size={18} /></div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#e2e8f0', fontSize: '0.95rem' }}>Refresh Invite Code</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '1px' }}>Existing code stops working immediately</div>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={() => { setShowSettings(false); if (confirm('Delete this list completely? This cannot be undone.')) onDeleteList(); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', color: '#f87171', display: 'flex' }}><Trash2 size={18} /></div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f87171', fontSize: '0.95rem' }}>Delete List</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(248,113,113,0.6)', marginTop: '1px' }}>Permanently remove this list and all its tasks</div>
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: '#f87171' }} />
                  </button>
                </div>
              </>
            )}

            {/* Contributors Section */}
            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', marginLeft: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={12} /> Contributors</span>
              <span style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '99px', fontWeight: '600', fontSize: '0.7rem', color: '#cbd5e1' }}>{Object.values(profilesMap).length}</span>
            </p>
            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-secondary)', padding: '0.5rem' }}>
              {Object.values(profilesMap).length > 0 ? (
                Object.values(profilesMap).map((name, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 0.875rem', borderRadius: '12px', marginBottom: '2px', transition: 'background 0.2s', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, hsl(${(i * 72 + 200) % 360},70%,55%), hsl(${(i * 72 + 260) % 360},70%,45%))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: '700', fontSize: '1rem',
                      boxShadow: `0 2px 8px rgba(0,0,0,0.3)`
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#e2e8f0' }}>{name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contributor</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <Users size={32} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                  <p>No contributors yet</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {!showSettings && (
        <div 
          className="task-list-wrapper" 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative', 
            overflow: 'hidden',
            marginBottom: '1.5rem'
          }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull Indicator */}
        <div 
          className="pull-indicator"
          style={{
            height: `${pullProgress}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: isPulling ? 'none' : 'height 0.3s ease',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            opacity: Math.min(pullProgress / 60, 1)
          }}
        >
          {isRefreshing ? (
            <span className="flex items-center gap-2"><div className="spinner" /> Refreshing...</span>
          ) : pullProgress > 60 ? (
            <span>Release to refresh</span>
          ) : (
            <span>Pull down to refresh</span>
          )}
        </div>

        <div 
          className="task-list" 
          ref={scrollRef}
          style={{
            transform: `translateY(${isPulling ? 0 : 0}px)`, // Content pushing is done by indicator height
            transition: isPulling ? 'none' : 'transform 0.3s ease',
            marginBottom: 0 // overriding css class margin
          }}
        >
          {loading && !isRefreshing ? (
            <div className="loading-state">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <p>No active tasks.</p>
              <p className="empty-subtext">Add a task below or share the Invite Code!</p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                currentUserId={userId} 
                creatorName={profilesMap[task.created_by]}
                onUpdated={(updatedTask) => setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))}
                onDeleted={(taskId) => setTasks(prev => prev.filter(t => t.id !== taskId))}
              />
            ))
          )}
        </div>
        </div>
      )}


      {!showSettings && activeTab === 'active' && (
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
      )}
    </div>
  );
};
