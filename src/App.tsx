import { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { MainLayout } from './components/MainLayout';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Load theme globally
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="app-container"><div style={{color: 'white'}}>Loading...</div></div>;
  }

  return (
    <>
      {!session ? (
        <div className="app-container">
          <Auth />
        </div>
      ) : (
        <MainLayout 
          userId={session.user.id} 
          userEmail={session.user.email || 'Unknown User'} 
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}

export default App;
