-- Agrega columna is_demo para identificar botones de ejemplo
alter table buttons
  add column if not exists is_demo boolean not null default false;

-- Función que crea un botón demo al registrarse un usuario nuevo
create or replace function public.create_demo_button_for_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.buttons (
    owner_id,
    name,
    description,
    slug,
    icon,
    color,
    press_policy,
    is_demo,
    is_active
  )
  values (
    new.id,
    'Almuerzo listo',
    'Botón de ejemplo — pulsa para notificar a tus suscriptores',
    'almuerzo-' || substr(new.id::text, 1, 8),
    'restaurant',
    'emerald',
    'anyone_with_link',
    true,
    true
  )
  on conflict (slug) do nothing;
  return new;
exception when others then
  -- No bloquear el registro si falla la creación del botón demo
  return new;
end;
$$;

-- Trigger separado del handle_new_user para mantener independencia
drop trigger if exists on_auth_user_created_demo on auth.users;
create trigger on_auth_user_created_demo
  after insert on auth.users
  for each row execute function public.create_demo_button_for_user();
