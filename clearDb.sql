-- ============================================================
-- LIMPIAR TABLAS ANTERIORES
-- ============================================================

drop table if exists press_log      cascade;
drop table if exists invite_links   cascade;
drop table if exists subscriptions  cascade;
drop table if exists buttons        cascade;
drop table if exists profiles       cascade;

-- Funciones auxiliares del proyecto anterior
drop function if exists user_has_subscription(uuid);
drop function if exists user_owns_button(uuid);

-- Trigger de creación automática de perfil (si existía)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();


-- ============================================================
-- TABLA: subscriptions
-- Guarda el endpoint push de cada usuario para el botón de prueba
-- ============================================================

create table subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_name   text,
  user_email  text,
  endpoint    text not null,
  p256dh      text not null,
  auth_token  text not null,
  created_at  timestamptz not null default now(),

  unique (endpoint)
);

-- RLS
alter table subscriptions enable row level security;

-- Cada usuario solo ve y gestiona sus propias suscripciones
create policy "subscriptions: ver propio"
  on subscriptions for select
  using (user_id = auth.uid());

create policy "subscriptions: insertar propio"
  on subscriptions for insert
  with check (user_id = auth.uid());

create policy "subscriptions: eliminar propio"
  on subscriptions for delete
  using (user_id = auth.uid());
