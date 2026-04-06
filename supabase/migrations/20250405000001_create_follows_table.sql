-- Tabla de follows: registra qué usuarios siguen qué botones
-- Independiente de subscriptions (push). Permite seguir sin push endpoint.
create table if not exists follows (
  id         uuid primary key default gen_random_uuid(),
  button_id  uuid references buttons(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  user_name  text,
  user_email text,
  created_at timestamptz default now() not null,
  unique(button_id, user_id)
);

alter table follows enable row level security;

-- Usuarios autenticados pueden leer todos los follows (para que el dueño vea suscriptores)
create policy "follows_select" on follows
  for select to authenticated using (true);

-- Cada usuario gestiona sus propios follows
create policy "follows_insert" on follows
  for insert to authenticated with check (auth.uid() = user_id);

create policy "follows_delete" on follows
  for delete to authenticated using (auth.uid() = user_id);
