import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, PlusCircle } from 'lucide-react';

interface RoomSetupProps {
  onJoin: (userName: string, roomId: string) => void;
}

export const RoomSetup: React.FC<RoomSetupProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('rooms')
        .insert([{}])
        .select()
        .single();
        
      if (insertError) throw insertError;
      
      onJoin(name.trim(), data.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!roomIdInput.trim()) {
      setError('Please enter a Room ID.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomIdInput.trim())
        .single();

      if (fetchError || !data) {
        throw new Error('Room not found or invalid Room ID.');
      }

      onJoin(name.trim(), data.id);
    } catch (err: any) {
      setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <h2 className="setup-title">Collaborative To-Do</h2>
      <p className="setup-subtitle">Share tasks in real-time</p>
      
      <div className="setup-form">
        <label className="input-label">Your Name</label>
        <input
          type="text"
          placeholder="e.g. Alice"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-input"
        />

        {error && <p className="error-text">{error}</p>}

        <div className="action-row">
          <button 
            onClick={handleCreateRoom} 
            disabled={loading}
            className="btn btn-primary"
          >
            <PlusCircle size={18} />
            Create New Room
          </button>
        </div>

        <div className="divider">
          <span>or join existing</span>
        </div>

        <label className="input-label">Room ID</label>
        <div className="join-row">
          <input
            type="text"
            placeholder="Paste Room ID here..."
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            className="text-input"
          />
          <button 
            onClick={handleJoinRoom} 
            disabled={loading}
            className="btn btn-secondary"
          >
            <LogIn size={18} />
            Join
          </button>
        </div>
      </div>
    </div>
  );
};
