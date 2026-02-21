import { useState, useEffect, useCallback } from 'react';
import { supabase, type Room, type Profile } from '../lib/supabase';
import { LogOut, Plus, List, Key, Sun, Moon, Menu, X, Check, UserPen, Settings } from 'lucide-react';
import { TodoList } from './TodoList';
import { EditProfileModal } from './EditProfileModal';

interface MainLayoutProps {
  userId: string;
  userEmail: string;
  onLogout: () => void;
}

export const MainLayout = ({ userId, userEmail, onLogout }: MainLayoutProps) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Profile State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Edit State
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomName, setEditRoomName] = useState('');

  // Mobile specific state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" -> normal if user has no profile yet
        console.error('Error fetching profile:', error.message);
      }
      if (data) setProfile(data as Profile);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Failed to load profile:', err.message);
      }
    }
  }, [userId]);

  const fetchMyRooms = useCallback(async () => {
    // We fetch the rooms where the current user is a member
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRooms(data as Room[]);
      
      // Auto-select first room if none selected
      if (!selectedRoomId && data.length > 0) {
        setSelectedRoomId(data[0].id);
      }
    }
  }, [selectedRoomId]);

  useEffect(() => {
    fetchMyRooms();
    fetchProfile();
    // Subscribe to new rooms being joined/created (simplistic approach)
    // Note: Due to RLS and junction tables, full real-time on `views` or 
    // complex joins requires specialized setup, so we fallback to manual 
    // fetch after actions or periodic refresh.
  }, [fetchProfile, fetchMyRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    setError('');

    try {
      // 1. Create Room
      const { data: roomData, error: insertError } = await supabase
        .from('rooms')
        .insert([{ created_by: userId, name: inputValue.trim() }])
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      // 2. Join Room (Add to junction table)
      const { error: joinError } = await supabase
        .from('room_users')
        .insert([{ room_id: roomData.id, user_id: userId }]);
        
      if (joinError) throw joinError;

      setInputValue('');
      setShowCreate(false);
      fetchMyRooms(); // Refresh sidebar
      setSelectedRoomId(roomData.id);
      setMobileMenuOpen(false);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to create list.');
      } else {
        setError('Failed to create list.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setLoading(true);
    setError('');

    try {
      // 1. Find room by invite code
      const { data: roomData, error: fetchError } = await supabase
        .from('rooms')
        .select('id')
        .ilike('invite_code', inputValue.trim())
        .single();

      if (fetchError || !roomData) throw new Error('Invalid Invite Code.');

      // 2. Join Room (Add to junction table)
      const { error: joinError } = await supabase
        .from('room_users')
        .insert([{ room_id: roomData.id, user_id: userId }]);
        
      // Ignore conflict error if they are already in the room
      if (joinError && joinError.code !== '23505') throw joinError;

      setInputValue('');
      setShowJoin(false);
      fetchMyRooms(); // Refresh sidebar
      setSelectedRoomId(roomData.id);
      setMobileMenuOpen(false);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Failed to join list.');
      } else {
        setError('Failed to join list.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRoom = async (roomId: string, newName?: string) => {
    const nameToUse = newName?.trim() || editRoomName.trim();
    if (!nameToUse) return;
    
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ name: nameToUse })
        .eq('id', roomId);
        
      if (error) throw error;
      
      setEditingRoomId(null);
      fetchMyRooms();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Failed to update room:', err.message);
      }
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this list? All tasks inside will be lost.')) return;
    
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);
        
      if (error) throw error;
      
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null);
      }
      fetchMyRooms();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Failed to delete room:', err.message);
      }
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="layout-container">
      {/* Mobile Overlay */}
      <div 
        className={`mobile-overlay ${mobileMenuOpen ? 'active' : ''}`} 
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Toggle Button (Visible only on small screens) */}
      <button 
        className="mobile-nav-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{ display: settingsOpen ? 'none' : undefined }}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div 
            className="user-profile group cursor-pointer relative" 
            onClick={() => setShowProfileModal(true)}
            title="Edit Profile"
          >
            <div 
              className="avatar bg-cover bg-center overflow-hidden"
              style={{
                backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none'
              }}
            >
              {!profile?.avatar_url && (profile?.username ? profile.username.charAt(0).toUpperCase() : userEmail.charAt(0).toUpperCase())}
            </div>
            <div className="flex flex-col flex-1 min-w-0 justify-center">
              <span className="user-email truncate leading-tight">
                {profile?.username || 'No Name Set'}
              </span>
            </div>
            <UserPen size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3" />
          </div>
          <div className="flex w-full gap-2 mt-2">
            <button 
              onClick={() => setShowProfileModal(true)} 
              className="btn-icon hover-green flex-1" 
              style={{ justifyContent: 'center' }} 
              title="Profile Settings"
            >
              <Settings size={16} />
            </button>
            <button onClick={toggleTheme} className="btn-icon hover-blue flex-1" style={{ justifyContent: 'center' }} title="Toggle Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={onLogout} className="btn-icon hover-red flex-1" style={{ justifyContent: 'center' }} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          <h3 className="sidebar-section-title">My Lists</h3>
          
          <ul className="room-nav">
            {rooms.length === 0 ? (
              <li className="empty-nav">No lists yet</li>
            ) : (
              rooms.map((room) => {
                return (
                  <li key={room.id} className="group relative">
                    {editingRoomId === room.id ? (
                      <div className="nav-item active flex items-center p-2">
                        <input
                          autoFocus
                          value={editRoomName}
                          onChange={(e) => setEditRoomName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateRoom(room.id);
                            if (e.key === 'Escape') setEditingRoomId(null);
                          }}
                          className="bg-transparent text-primary outline-none flex-1 truncate w-full"
                          style={{ minWidth: 0 }}
                        />
                        <button onClick={() => handleUpdateRoom(room.id)} className="btn-icon text-green-500 p-1 ml-1 shrink-0">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingRoomId(null)} className="btn-icon text-red-500 p-1 ml-1 shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        role="button"
                        tabIndex={0}
                        className={`nav-item ${selectedRoomId === room.id ? 'active' : ''} w-full relative overflow-hidden cursor-pointer`}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setMobileMenuOpen(false); // Close menu on selection in mobile
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setSelectedRoomId(room.id);
                            setMobileMenuOpen(false);
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', textAlign: 'left' }}
                      >
                        <List size={16} className="shrink-0" />
                        <span className="truncate flex-1 text-left">{room.name}</span>
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          {showCreate ? (
            <form onSubmit={handleCreateRoom} className="action-form">
              <input 
                autoFocus
                placeholder="List name..." 
                className="text-input text-sm" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
              <div className="form-actions">
                <button type="submit" disabled={loading} className="btn-small text-green-400">Add</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-small text-gray-400">Cancel</button>
              </div>
              {error && <p className="error-text text-xs mt-1">{error}</p>}
            </form>
          ) : showJoin ? (
             <form onSubmit={handleJoinRoom} className="action-form">
              <input 
                autoFocus
                placeholder="Invite Code" 
                className="text-input text-sm" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
              />
              <div className="form-actions">
                <button type="submit" disabled={loading} className="btn-small text-green-400">Join</button>
                <button type="button" onClick={() => setShowJoin(false)} className="btn-small text-gray-400">Cancel</button>
              </div>
              {error && <p className="error-text text-xs mt-1">{error}</p>}
            </form>
          ) : (
            <>
              <button 
                className="nav-item action-btn"
                onClick={() => { setShowCreate(true); setShowJoin(false); setInputValue(''); setError(''); }}
              >
                <Plus size={16} /> New List
              </button>
              <button 
                className="nav-item action-btn mt-2"
                onClick={() => { setShowJoin(true); setShowCreate(false); setInputValue(''); setError(''); }}
              >
                <Key size={16} /> Join via Code
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {selectedRoomId && selectedRoom ? (
          <TodoList 
            userId={userId} 
            roomId={selectedRoomId} 
            roomName={selectedRoom.name}
            inviteCode={selectedRoom.invite_code}
            isCreator={selectedRoom.created_by === userId}
            onRenameList={(newName) => handleUpdateRoom(selectedRoomId, newName)}
            onDeleteList={() => handleDeleteRoom(selectedRoomId)}
            onRoomUpdated={fetchMyRooms}
            onSettingsOpen={(open) => { setSettingsOpen(open); if (open) setMobileMenuOpen(false); }}
          />
        ) : (
           <div className="empty-pane">
            <List size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h2>Select a List</h2>
            <p>Choose a list from the sidebar or explicitly create a new one to get started.</p>
          </div>
        )}
      </main>

      <EditProfileModal
        userId={userId}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentProfile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
    </div>
  );
};
