-- Fix: handle_new_user trigger no debe bloquear el login si falla la creación del perfil.
-- Se agrega search_path explícito y manejo de excepciones.

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- No bloquear el login si falla la creación del perfil
  return new;
end;
$$;
