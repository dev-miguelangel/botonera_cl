-- ============================================================
-- LIMPIAR TODO LO ANTERIOR
-- ============================================================

drop table if exists press_log      cascade;
drop table if exists invite_links   cascade;
drop table if exists subscriptions  cascade;
drop table if exists buttons        cascade;
drop table if exists profiles       cascade;

drop function if exists user_has_subscription(uuid, uuid);
drop function if exists handle_new_user();
drop trigger if exists on_auth_user_created on auth.users;


-- ============================================================
-- TABLA: profiles
-- Se crea automáticamente cuando un usuario hace login
-- ============================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: ver propio"
  on profiles for select using (id = auth.uid());

create policy "profiles: actualizar propio"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Trigger: crea perfil automáticamente al registrarse
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ============================================================
-- TABLA: buttons
-- Un botón pertenece a un owner, tiene slug único y política de quién puede presionar
-- ============================================================

create table buttons (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  description           text,
  slug                  text not null unique,
  press_policy          text not null default 'anyone_with_link'
                          check (press_policy in ('owner_only', 'subscribers', 'anyone_with_link')),
  rate_limit_seconds    int not null default 60,
  rate_limit_max_presses int not null default 10,
  is_active             boolean not null default true,
  last_pressed_at       timestamptz,
  created_at            timestamptz not null default now()
);

create index on buttons (slug);
create index on buttons (owner_id);

alter table buttons enable row level security;

-- Owner ve todos sus botones
create policy "buttons: ver propios"
  on buttons for select using (owner_id = auth.uid());

-- Cualquier autenticado puede ver un botón activo si tiene el slug (para /button/:slug)
create policy "buttons: ver por slug (autenticado)"
  on buttons for select using (is_active = true and auth.uid() is not null);

create policy "buttons: insertar"
  on buttons for insert with check (owner_id = auth.uid());

create policy "buttons: actualizar propio"
  on buttons for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "buttons: eliminar propio"
  on buttons for delete using (owner_id = auth.uid());


-- ============================================================
-- TABLA: subscriptions
-- Un suscriptor por botón (multi-dispositivo: unique en button_id + endpoint)
-- ============================================================

create table subscriptions (
  id          uuid primary key default gen_random_uuid(),
  button_id   uuid not null references buttons(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_name   text,
  user_email  text,
  endpoint    text not null,
  p256dh      text not null,
  auth_token  text not null,
  created_at  timestamptz not null default now(),

  unique (button_id, endpoint)
);

create index on subscriptions (button_id);
create index on subscriptions (user_id);

alter table subscriptions enable row level security;

-- Suscriptor ve sus propias suscripciones
create policy "subscriptions: ver propio"
  on subscriptions for select using (user_id = auth.uid());

-- Owner del botón ve todos sus suscriptores
create policy "subscriptions: owner ve sus suscritos"
  on subscriptions for select
  using (
    exists (
      select 1 from buttons b
      where b.id = subscriptions.button_id
        and b.owner_id = auth.uid()
    )
  );

create policy "subscriptions: insertar propio"
  on subscriptions for insert with check (user_id = auth.uid());

create policy "subscriptions: actualizar propio"
  on subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions: eliminar propio"
  on subscriptions for delete using (user_id = auth.uid());


-- ============================================================
-- TABLA: invite_links
-- Token firmado con expiración y máximo de usos
-- ============================================================

create table invite_links (
  id         uuid primary key default gen_random_uuid(),
  button_id  uuid not null references buttons(id) on delete cascade,
  token      text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses   integer,
  use_count  integer not null default 0,
  created_at timestamptz not null default now()
);

create index on invite_links (token);

alter table invite_links enable row level security;

create policy "invite_links: ver propio"
  on invite_links for select using (created_by = auth.uid());

create policy "invite_links: insertar"
  on invite_links for insert with check (
    created_by = auth.uid() and
    exists (select 1 from buttons b where b.id = invite_links.button_id and b.owner_id = auth.uid())
  );

create policy "invite_links: eliminar propio"
  on invite_links for delete using (created_by = auth.uid());


-- ============================================================
-- TABLA: press_log
-- Historial de presiones (solo escrito desde Edge Function con service_role)
-- ============================================================

create table press_log (
  id          uuid primary key default gen_random_uuid(),
  button_id   uuid not null references buttons(id) on delete cascade,
  pressed_by  uuid references auth.users(id) on delete set null,
  pressed_at  timestamptz not null default now(),
  remote_ip   text
);

create index on press_log (button_id, pressed_at);

alter table press_log enable row level security;

-- Owner del botón ve el historial
create policy "press_log: owner ve historial"
  on press_log for select
  using (
    exists (
      select 1 from buttons b
      where b.id = press_log.button_id
        and b.owner_id = auth.uid()
    )
  );

-- Solo service_role puede insertar (desde Edge Function)
-- No se crea policy de INSERT para usuarios normales


-- ============================================================
-- RPC: create_invite_link
-- Genera un token de invitación para un botón (solo owner puede llamarlo)
-- ============================================================

create or replace function create_invite_link(
  p_button_id      uuid,
  p_expires_in_days int default 7,
  p_max_uses        int default null
)
returns text
language plpgsql security definer as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from buttons where id = p_button_id and owner_id = auth.uid()
  ) then
    raise exception 'No autorizado';
  end if;

  -- Base64 URL-safe sin padding (32 bytes → 256 bits de entropía)
  v_token := replace(replace(replace(
    encode(gen_random_bytes(32), 'base64'),
    '+', '-'), '/', '_'), '=', '');

  insert into invite_links (button_id, token, created_by, expires_at, max_uses)
  values (
    p_button_id, v_token, auth.uid(),
    now() + (p_expires_in_days || ' days')::interval,
    p_max_uses
  );

  return v_token;
end;
$$;


-- ============================================================
-- RPC: use_invite_token
-- Valida el token e incrementa use_count de forma atómica.
-- Security definer para bypassear RLS (el token es el secreto).
-- ============================================================

create or replace function use_invite_token(p_token text)
returns table (button_id uuid, button_slug text, button_name text)
language plpgsql security definer as $$
declare
  v_link invite_links%rowtype;
begin
  select * into v_link
  from invite_links
  where token = p_token
    and expires_at > now()
    and (max_uses is null or use_count < max_uses);

  if not found then
    raise exception 'Token inválido o expirado';
  end if;

  update invite_links set use_count = use_count + 1 where id = v_link.id;

  return query
    select b.id, b.slug, b.name
    from buttons b
    where b.id = v_link.button_id and b.is_active = true;
end;
$$;
