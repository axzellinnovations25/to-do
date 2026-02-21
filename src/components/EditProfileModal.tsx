import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, type Profile } from '../lib/supabase';
import { X, User, Upload, Camera } from 'lucide-react';

interface EditProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (profile: Profile) => void;
  currentProfile: Profile | null;
}

export const EditProfileModal = ({ userId, isOpen, onClose, onProfileUpdated, currentProfile }: EditProfileModalProps) => {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url || '');
        setPreviewUrl(data.avatar_url || '');
      }
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Error fetching profile:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && currentProfile) {
      setUsername(currentProfile.username || '');
      setAvatarUrl(currentProfile.avatar_url || '');
      setPreviewUrl(currentProfile.avatar_url || '');
    } else if (isOpen) {
      fetchProfile();
    }
  }, [isOpen, currentProfile, fetchProfile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setUploading(true);
    setError('');

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('to-do-app')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('to-do-app').getPublicUrl(filePath);
      // Append cache-buster so browsers don't serve the old image
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      setPreviewUrl(publicUrl);
    } catch (err: unknown) {
      if (err instanceof Error) setError('Upload failed: ' + err.message);
      setPreviewUrl(avatarUrl); // revert preview
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updates = {
        id: userId,
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()
        .single();

      if (error) throw error;
      
      onProfileUpdated(data as Profile);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Error updating profile.');
      } else {
        setError('Error updating profile.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div 
        className="modal-content"
        style={{ background: 'var(--surface-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--shadow-glass)' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            <User className="modal-icon text-accent" /> Edit Profile
          </h2>
          <button onClick={onClose} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">

          {/* Avatar Upload Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '88px', height: '88px', borderRadius: '50%',
                background: previewUrl
                  ? `url(${previewUrl}) center/cover no-repeat`
                  : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                border: '2px dashed rgba(99,102,241,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s',
                flexShrink: 0
              }}
            >
              {!previewUrl && (
                <div style={{ textAlign: 'center', color: '#a5b4fc' }}>
                  <Camera size={24} />
                </div>
              )}
              {/* Hover overlay */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s'
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >
                <Camera size={20} style={{ color: '#fff' }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '20px', padding: '6px 16px',
                color: '#a5b4fc', fontSize: '0.8rem', fontWeight: '600',
                cursor: 'pointer', transition: 'background 0.2s'
              }}
            >
              <Upload size={14} /> {uploading ? 'Uploading...' : previewUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/gif"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {uploading && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Uploading image...</p>
            )}
          </div>

          {/* Display Name */}
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <div className="input-with-icon">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Jane Doe"
                className="text-input"
                maxLength={30}
              />
              <User className="input-icon" size={18} />
            </div>
          </div>

          {error && <p className="error-text text-center text-sm">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={loading || uploading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={loading || uploading}>
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
