import { useState, useEffect } from 'react';
import { supabase, type Room } from '../lib/supabase';
import { LogOut, Plus, List, Key, Sun, Moon, Menu, X } from 'lucide-react';
import { TodoList } from './TodoList';

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
  
  // Mobile specific state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  useEffect(() => {
    fetchMyRooms();

    // Subscribe to new rooms being joined/created (simplistic approach)
    // Note: Due to RLS and junction tables, full real-time on `views` or 
    // complex joins requires specialized setup, so we fallback to manual 
    // fetch after actions or periodic refresh.
  }, [userId]);

  const fetchMyRooms = async () => {
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
  };

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

    } catch (err: any) {
      setError(err.message || 'Failed to create list.');
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
        .eq('invite_code', inputValue.trim().toLowerCase())
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

    } catch (err: any) {
      setError(err.message || 'Failed to join list.');
    } finally {
      setLoading(false);
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
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="user-profile">
            <div className="avatar">{userEmail.charAt(0).toUpperCase()}</div>
            <span className="user-email truncate">{userEmail}</span>
          </div>
          <div className="flex w-full gap-2 mt-2">
            <button onClick={onLogout} className="btn-icon hover-red flex-1" style={{ justifyContent: 'center' }} title="Log Out">
              <LogOut size={16} />
            </button>
            <button onClick={toggleTheme} className="btn-icon hover-blue flex-1" style={{ justifyContent: 'center' }} title="Toggle Theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          <h3 className="sidebar-section-title">My Lists</h3>
          
          <ul className="room-nav">
            {rooms.length === 0 ? (
              <li className="empty-nav">No lists yet</li>
            ) : (
              rooms.map((room) => (
                <li key={room.id}>
                  <button 
                    className={`nav-item ${selectedRoomId === room.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setMobileMenuOpen(false); // Close menu on selection in mobile
                    }}
                  >
                    <List size={16} />
                    <span className="truncate">{room.name}</span>
                  </button>
                </li>
              ))
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
            userEmail={userEmail} 
            roomId={selectedRoomId} 
            roomName={selectedRoom.name}
            inviteCode={selectedRoom.invite_code}
          />
        ) : (
           <div className="empty-pane">
            <List size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h2>Select a List</h2>
            <p>Choose a list from the sidebar or explicitly create a new one to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
};
