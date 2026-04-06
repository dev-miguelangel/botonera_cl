import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const VAPID_PUBLIC_KEY      = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY     = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT         = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return err(401, 'No autorizado');

  // Verificar JWT y obtener usuario
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': authHeader, 'apikey': SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return err(401, 'No autorizado');
  const user = await userRes.json();

  const { button_id, pressed_by } = await req.json().catch(() => ({}));
  if (!button_id) return err(400, 'Falta button_id');

  // Obtener botón
  const { data: button, error: btnErr } = await db
    .from('buttons')
    .select('*')
    .eq('id', button_id)
    .eq('is_active', true)
    .single();

  if (btnErr || !button) return err(404, 'Botón no encontrado o inactivo');

  // Verificar press_policy
  if (button.press_policy === 'owner_only' && button.owner_id !== user.id) {
    return err(403, 'Solo el dueño puede presionar este botón');
  }
  if (button.press_policy === 'subscribers') {
    const { data: follow } = await db
      .from('follows')
      .select('id')
      .eq('button_id', button_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!follow) return err(403, 'Solo suscriptores pueden presionar este botón');
  }

  // Rate limit: contar presiones en la ventana temporal
  const windowStart = new Date(Date.now() - button.rate_limit_seconds * 1000).toISOString();
  const { count } = await db
    .from('press_log')
    .select('id', { count: 'exact', head: true })
    .eq('button_id', button_id)
    .gte('pressed_at', windowStart);

  if ((count ?? 0) >= button.rate_limit_max_presses) {
    return err(429, `Límite alcanzado: máx ${button.rate_limit_max_presses} presiones cada ${button.rate_limit_seconds}s`);
  }

  // Registrar presión
  await db.from('press_log').insert({
    button_id,
    pressed_by: user.id,
    remote_ip: req.headers.get('x-forwarded-for') ?? null,
  });
  await db.from('buttons').update({ last_pressed_at: new Date().toISOString() }).eq('id', button_id);

  // Si el botón está pausado, no enviar notificaciones
  if (button.is_paused) {
    console.log(`send-push [${button.slug}]: pausado, sin envíos`);
    return ok({ sent: 0, paused: true });
  }

  // Obtener suscriptores con sus user_id para filtrar muteados
  const [{ data: allSubs, error: subsErr }, { data: mutedFollows }] = await Promise.all([
    db.from('subscriptions')
      .select('id, endpoint, p256dh, auth_token, user_id')
      .eq('button_id', button_id),
    db.from('follows')
      .select('user_id')
      .eq('button_id', button_id)
      .eq('is_muted', true),
  ]);

  if (subsErr) return err(500, subsErr.message);
  if (!allSubs || allSubs.length === 0) return ok({ sent: 0, message: 'Sin suscriptores' });

  // Filtrar usuarios que silenciaron el botón
  const mutedUserIds = new Set(mutedFollows?.map((f: any) => f.user_id) ?? []);
  const subs = allSubs.filter((s: any) => !mutedUserIds.has(s.user_id));

  if (subs.length === 0) return ok({ sent: 0, muted: mutedUserIds.size });

  const hora = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const displayName = pressed_by || user.email || 'Alguien';
  const payload = JSON.stringify({
    notification: {
      title: `🔔 ${button.name}`,
      body:  `${displayName} presionó el botón a las ${hora}`,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data:  { url: `/button/${button.slug}` },
    },
  });

  let sent = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_token } },
        payload
      );
      sent++;
    } catch (e: any) {
      console.error(`Push failed for ${sub.id}: ${e.statusCode} ${e.message}`);
      if (e.statusCode === 410 || e.statusCode === 404) staleIds.push(sub.id);
    }
  }));

  if (staleIds.length > 0) {
    await db.from('subscriptions').delete().in('id', staleIds);
  }

  console.log(`send-push [${button.slug}]: total=${allSubs.length} sent=${sent} muted=${mutedUserIds.size} stale=${staleIds.length}`);
  return ok({ sent, total: allSubs.length, muted: mutedUserIds.size });
});

const ok  = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
const err = (status: number, message: string) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
