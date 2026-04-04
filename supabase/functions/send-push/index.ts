import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

  // Verificar autenticación
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return err(401, 'No autorizado');

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': authHeader, 'apikey': Deno.env.get('SUPABASE_ANON_KEY')! },
  });
  if (!authRes.ok) return err(401, 'No autorizado');

  // Datos del body
  const { pressed_by } = await req.json().catch(() => ({}));
  if (!pressed_by) return err(400, 'Falta pressed_by');

  // Hora formateada en Chile
  const hora = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date());

  const payload = JSON.stringify({
    notification: {
      title: '🔔 Botón presionado',
      body:  `${pressed_by} presionó el botón a las ${hora}`,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
    },
  });

  // Obtener todos los suscritos
  const { data: subs, error: dbErr } = await db
    .from('subscriptions')
    .select('id, endpoint, p256dh, auth_token');

  if (dbErr) return err(500, dbErr.message);
  if (!subs || subs.length === 0) return ok({ sent: 0, message: 'Sin suscriptores' });

  // Enviar a todos
  let sent = 0;
  const staleIds: string[] = [];

  await Promise.allSettled(subs.map(async (sub) => {
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

  // Limpiar endpoints muertos
  if (staleIds.length > 0) {
    await db.from('subscriptions').delete().in('id', staleIds);
  }

  console.log(`send-push: total=${subs.length} sent=${sent} stale=${staleIds.length}`);
  return ok({ sent, total: subs.length });
});

const ok  = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
const err = (status: number, message: string) => new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
