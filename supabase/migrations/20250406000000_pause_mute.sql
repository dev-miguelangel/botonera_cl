-- Pausa global del botón (dueño)
alter table buttons add column if not exists is_paused boolean not null default false;

-- Silenciar notificaciones por suscriptor
alter table follows add column if not exists is_muted boolean not null default false;

-- Política de actualización para el dueño del botón
do $$ begin
  create policy "buttons_update_owner" on buttons
    for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

-- Política de actualización para el suscriptor (is_muted)
do $$ begin
  create policy "follows_update_own" on follows
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
