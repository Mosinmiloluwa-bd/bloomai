-- Create tables for Bloom App

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Sessions Table (for grouping chat messages)
CREATE TABLE IF NOT EXISTS public.sessions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  mood text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- 3. Messages Table (chat history)
CREATE TABLE IF NOT EXISTS public.messages (
  id text primary key,
  session_id text references public.sessions on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_user_created_idx ON public.messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_session_created_idx ON public.messages (session_id, created_at ASC);

-- 4. Mood Logs (daily check-ins)
CREATE TABLE IF NOT EXISTS public.mood_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null default current_date,
  mood text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(user_id, date)
);
ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

-- 5. Thought Records (CBT exercises)
CREATE TABLE IF NOT EXISTS public.thought_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  situation text not null,
  thoughts text not null,
  emotions text not null,
  reframe text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.thought_records ENABLE ROW LEVEL SECURITY;

-- Setup Row Level Security (RLS) Policies
-- Users can only read and write their own data

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Sessions
CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Documents (shared wellness knowledge base)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536) not null,
  source text,
  topic text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS documents_topic_idx ON public.documents (topic);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE POLICY "Authenticated users can read documents" ON public.documents
  FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Service role can manage documents" ON public.documents
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer
)
RETURNS TABLE (
  id uuid,
  content text,
  source text,
  topic text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    d.content,
    d.source,
    d.topic,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- Mood Logs
CREATE POLICY "Users can view own mood logs" ON public.mood_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mood logs" ON public.mood_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mood logs" ON public.mood_logs FOR UPDATE USING (auth.uid() = user_id);

-- Thought Records
CREATE POLICY "Users can view own thought records" ON public.thought_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own thought records" ON public.thought_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
