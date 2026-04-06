import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const COLOR_HEX: Record<string, string> = {
  indigo:  '#4f46e5',
  violet:  '#7c3aed',
  blue:    '#2563eb',
  sky:     '#0284c7',
  emerald: '#059669',
  teal:    '#0d9488',
  amber:   '#d97706',
  orange:  '#ea580c',
  rose:    '#e11d48',
  red:     '#dc2626',
};

// Simple SVG paths para los iconos más comunes
const ICON_PATH: Record<string, string> = {
  notifications: 'M240-80q-33 0-56.5-23.5T160-160h160q0 33-23.5 56.5T240-80Zm-160-120v-80h80v-240q0-83 50-147.5T340-756v-24q0-25 17.5-42.5T400-840q25 0 42.5 17.5T460-780v24q80 20 130 84.5T640-524v240h80v80H80Zm160-80h320v-240q0-66-47-113t-113-47q-66 0-113 47t-47 113v240Z',
  restaurant:    'M280-80v-366q-51-14-85.5-56T160-600v-280h80v280h40v-280h80v280h40v-280h80v280q0 56-34.5 98T360-446v366h-80Zm360 0v-320h-80v-280q0-83 58.5-141.5T760-880v800h-120Z',
  bolt:          'M400-80 120-480h320l-40-400 400 480H480l-80 320Z',
  favorite:      'M480-140 168-450q-42-42-61-97t-19-110q0-92 63-155t155-63q46 0 88 15t75 45q33-30 75-45t88-15q92 0 155 63t63 155q0 55-19 110t-61 97L480-140Z',
  star:          'M480-120 300-330l-220-90 220-90 180-330 180 330 220 90-220 90-180 210Z',
  check_circle:  'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-320-90-90-56 56 146 146 280-280-56-58-224 226Z',
  warning:       'M40-120l440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z',
  celebration:   'M792-125 646-271l56-56 90 90-56 112Zm-624 0L112-237l90-90 56 56L112-125ZM440-40v-122l280-280 122 122L562-40H440Zm-320-80v-160l280-280 80 80-280 280H120Zm400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z',
  pets:          'M180-475q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm180-160q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm240 0q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm180 160q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM480-80q-92 0-156-58.5T260-292q0-29 5-51t13-43l102-204q9-18 26.5-29t37.5-11q20 0 37.5 11t26.5 29l102 204q8 21 13 43t5 51q0 95-64 153.5T480-80Z',
  music_note:    'M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z',
  camera_alt:    'M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Z',
  phone:         'M798-120q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12Z',
  directions_car:'M240-160v40q0 17-11.5 28.5T200-80h-40q-17 0-28.5-11.5T120-120v-320l84-240q6-18 21.5-29t34.5-11h440q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-80h-40q-17 0-28.5-11.5T720-120v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-340q0-25-17.5-42.5T300-400q-25 0-42.5 17.5T240-340q0 25 17.5 42.5T300-280Zm360 0q25 0 42.5-17.5T720-340q0-25-17.5-42.5T660-400q-25 0-42.5 17.5T600-340q0 25 17.5 42.5T660-280Zm-460 40h560v-200H200v200Z',
  sports_soccer: 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm-40-234-62-190 102-74 102 74-62 190H440Zm-96 42-170-54v-112l136-98 60 180-26 84Zm-42 144-94-94 28-88 142 44 20 64-96 74Zm178 48-80-34-16-58 108-82 80 34 16 58-108 82Zm178-48-96-74 20-64 142-44 28 88-94 94Zm-42-144-26-84 60-180 136 98v112l-170 54Z',
  fitness_center:'M120-120v-80l80-80v-400L80-800v-80h220l120 280h120l120-280h220v80l-120 120v400l80 80v80H640v-80l80-80v-120H480v120l80 80v80H120Zm280-360h160v-200H400v200Z',
  water_drop:    'M480-80q-117 0-198.5-81.5T200-360q0-100 44.5-183T358-680l122-200 122 200q69 87 113.5 170T760-360q0 117-81.5 198.5T480-80Zm0-80q83 0 141.5-58.5T680-360q0-71-36-138.5T544-638L480-740l-64 102Q352-570 316-502.5T280-360q0 83 58.5 141.5T480-160Zm-40-120v-200h80v200h-80Z',
  local_fire_department: 'M480-80q-117 0-198.5-81.5T200-360q0-71 27-135t83-103l90-89 30 90q10 29 27.5 52t41.5 39q-5-45 5-91t35-85l27-45 28 45q32 54 50.5 102.5T660-474q36-32 55-77t19-89q74 64 110 145.5T880-320q0 117-81.5 198.5T620-40q12-20 18-42t6-44q0-45-17.5-86T574-284l-94-96-93 96q-24 25-41.5 66T328-126q0 22 6 44t16 42H480Z',
};

function buildSvg(name: string, colorHex: string, iconName: string): string {
  const initial = (name ?? 'B')[0].toUpperCase();
  const path = ICON_PATH[iconName];

  const iconSvg = path
    ? `<g transform="translate(96, 96) scale(0.67)">
        <path fill="white" d="${path}"/>
       </g>`
    : `<text x="256" y="256"
        font-family="system-ui,-apple-system,sans-serif"
        font-size="260" font-weight="800"
        fill="white" text-anchor="middle" dominant-baseline="central">${initial}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="115" fill="${colorHex}"/>
  ${iconSvg}
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const url  = new URL(req.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const { data: button } = await db
    .from('buttons')
    .select('name, color, icon')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!button) {
    // Devolver ícono genérico si no se encuentra
    const svg = buildSvg('B', COLOR_HEX['indigo'], 'notifications');
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' },
    });
  }

  const hex = COLOR_HEX[button.color] ?? COLOR_HEX['indigo'];
  const svg = buildSvg(button.name, hex, button.icon ?? 'notifications');

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
