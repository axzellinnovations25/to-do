import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Database Types
export type Profile = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    updated_at: string;
};

export type Room = {
    id: string;
    name: string;
    invite_code: string;
    created_by: string;
    created_at: string;
};

export type Task = {
    id: string;
    room_id: string;
    text: string;
    created_by: string;
    is_completed: boolean;
    created_at: string;
};
