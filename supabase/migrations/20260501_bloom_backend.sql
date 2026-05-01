create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.messages (
  id text primary key,
  session_id text references public.sessions on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

create index if not exists messages_user_created_idx on public.messages (user_id, created_at desc);
create index if not exists messages_session_created_idx on public.messages (session_id, created_at asc);

drop policy if exists "Users can view own messages" on public.messages;
create policy "Users can view own messages"
  on public.messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.messages;
create policy "Users can insert own messages"
  on public.messages
  for insert
  with check (auth.uid() = user_id);

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  embedding vector(1536) not null,
  source text,
  topic text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.documents enable row level security;

create index if not exists documents_topic_idx on public.documents (topic);
create index if not exists documents_embedding_idx on public.documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

drop policy if exists "Authenticated users can read documents" on public.documents;
create policy "Authenticated users can read documents"
  on public.documents
  for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "Service role can manage documents" on public.documents;
create policy "Service role can manage documents"
  on public.documents
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.match_documents(
  query_embedding vector(1536),
  match_threshold double precision,
  match_count integer
)
returns table (
  id uuid,
  content text,
  source text,
  topic text,
  similarity double precision
)
language sql
stable
as $$
  select
    d.id,
    d.content,
    d.source,
    d.topic,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding asc
  limit match_count;
$$;

