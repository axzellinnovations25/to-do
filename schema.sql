-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS profiles;

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 6),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies
-- 1. Anyone can view public profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
-- 2. Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- 3. Users can update own profile
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Room Policies
-- 1. Anyone authenticated can create a room
CREATE POLICY "Auth users can create rooms" ON rooms FOR INSERT TO authenticated WITH CHECK (true);
-- 2. Anyone authenticated can read rooms (needed to join via code)
CREATE POLICY "Auth users can read rooms" ON rooms FOR SELECT TO authenticated USING (true);
-- 3. Room creator can update/delete room
CREATE POLICY "Creator can manage their rooms" ON rooms FOR ALL TO authenticated USING (auth.uid() = created_by);

-- Task Policies
-- 1. Anyone authenticated can read tasks
CREATE POLICY "Auth users can read tasks" ON tasks FOR SELECT TO authenticated USING (true);
-- 2. Anyone authenticated can insert tasks
CREATE POLICY "Auth users can insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
-- 3. Anyone authenticated can update tasks
CREATE POLICY "Auth users can update tasks" ON tasks FOR UPDATE TO authenticated USING (true);
-- 4. Only creator can delete their task (optional but good practice)
CREATE POLICY "Creator can delete tasks" ON tasks FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Enable Realtime for the tasks table
-- This allows clients to subscribe to changes (INSERT, UPDATE, DELETE)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
