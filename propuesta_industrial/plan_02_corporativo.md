# Plan de implementación — Propuesta 2: Integrar Botonera en flujos de trabajo corporativos

**Categoría:** Uso corporativo cotidiano  
**Prioridad sugerida:** Media-Alta (amplía el mercado objetivo significativamente)

---

## Objetivo

Convertir Botonera en un canal de señalización ligero dentro del stack corporativo, reduciendo interrupciones verbales y aumentando la visibilidad de eventos críticos sin añadir carga cognitiva al equipo.

---

## Idea 1 — Webhook outbound por botón

### Descripción
Al pulsar un botón, disparar una URL HTTP configurable por el propietario. Permite integración con Slack, Microsoft Teams, n8n, Make (Integromat), Zapier o cualquier sistema interno, sin código adicional en la app.

### Modelo de datos

```sql
-- Añadir columna a la tabla botones
ALTER TABLE botones ADD COLUMN webhook_url TEXT;
ALTER TABLE botones ADD COLUMN webhook_secret TEXT; -- para HMAC opcional
```

### Implementación técnica

**Opción A — Edge Function de Supabase (recomendada):**
```typescript
// supabase/functions/dispatch-webhook/index.ts
import { serve } from 'https://deno.land/std/http/server.ts'

serve(async (req) => {
  const { boton_id, pulsado_por, timestamp } = await req.json()

  const { data: boton } = await supabase
    .from('botones').select('webhook_url, webhook_secret, nombre')
    .eq('id', boton_id).single()

  if (!boton?.webhook_url) return new Response('ok')

  const payload = { boton: boton.nombre, pulsado_por, timestamp }

  await fetch(boton.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Botonera-Signature': hmac(boton.webhook_secret, payload)
    },
    body: JSON.stringify(payload)
  })

  return new Response('dispatched')
})
```

**Trigger en la tabla `pulsaciones`:**
```sql
CREATE TRIGGER on_pulsacion
AFTER INSERT ON pulsaciones
FOR EACH ROW EXECUTE FUNCTION dispatch_webhook_edge_function();
```

**En la UI (create/edit):**
```html
<!-- Sección opcional "Integraciones" -->
<div class="integration-section">
  <label>URL de webhook (opcional)</label>
  <input type="url" placeholder="https://hooks.slack.com/services/..." 
         [(ngModel)]="form.webhookUrl" />
  <p class="hint">Se llamará cada vez que alguien pulse este botón.</p>
</div>
```

### Payload de ejemplo para Slack
```json
{
  "text": "🔴 *Staging listo* — pulsado por ana@empresa.cl a las 14:32"
}
```

### Esfuerzo estimado
- 1 Edge Function nueva
- Migración de BD (1 columna)
- Sección en formulario de creación/edición
- **Complejidad: media**

---

## Idea 2 — Mini-dashboard de actividad del equipo

### Descripción
Vista resumida que muestra cuándo y quién pulsó cada botón en las últimas 24 h. Exportable a CSV para auditoría y métricas de proceso.

### Ruta sugerida
`/dashboard/actividad` o panel colapsable dentro del dashboard principal.

### Modelo de datos
La tabla `pulsaciones` (o `historial`) ya debería existir. Verificar que contenga:
```sql
CREATE TABLE IF NOT EXISTS pulsaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boton_id UUID REFERENCES botones(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementación técnica

```typescript
// actividad.service.ts
async getActividadReciente(ownerId: string): Promise<Actividad[]> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { data } = await supabase
    .from('pulsaciones')
    .select(`
      created_at,
      user_id,
      botones!inner(nombre, icono, color, owner_id)
    `)
    .eq('botones.owner_id', ownerId)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
  
  return data ?? []
}
```

**Exportar a CSV:**
```typescript
exportarCSV(actividad: Actividad[]) {
  const rows = actividad.map(a =>
    `${a.botones.nombre},${a.user_id},${a.created_at}`
  )
  const csv = ['Botón,Usuario,Fecha', ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  saveAs(blob, `actividad-${new Date().toISOString().slice(0,10)}.csv`)
}
```

### UI sugerida
- Tabla con columnas: Botón | Pulsado por | Hace cuánto
- Agrupación por botón con conteo del día
- Botón "Exportar CSV" en la cabecera
- Filtro de rango de fecha (hoy / 7 días / personalizado)

### Esfuerzo estimado
- 1 componente nuevo + 1 servicio
- Query a Supabase existente
- **Complejidad: media-baja**

---

## Idea 3 — Botones con cooldown configurable

### Descripción
Evitar spam de notificaciones en contextos de alta frecuencia (CI/CD, alertas automáticas) mediante un período mínimo entre pulsaciones configurado por el propietario. Mostrar un contador visual regresivo.

### Modelo de datos
```sql
ALTER TABLE botones ADD COLUMN cooldown_segundos INTEGER DEFAULT 0;
```

### Implementación técnica

**Validación en Edge Function / RLS:**
```sql
-- Política RLS que impide pulsaciones durante el cooldown
CREATE POLICY "respetar_cooldown" ON pulsaciones
FOR INSERT WITH CHECK (
  (
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))
    FROM pulsaciones p2
    WHERE p2.boton_id = boton_id
  ) > (
    SELECT cooldown_segundos FROM botones WHERE id = boton_id
  )
  OR NOT EXISTS (SELECT 1 FROM pulsaciones p3 WHERE p3.boton_id = boton_id)
);
```

**En el componente de botón:**
```typescript
// button.ts
cooldownRestante = signal(0)

private iniciarCooldown(segundos: number) {
  const fin = Date.now() + segundos * 1000
  const interval = setInterval(() => {
    const restante = Math.ceil((fin - Date.now()) / 1000)
    this.cooldownRestante.set(Math.max(0, restante))
    if (restante <= 0) clearInterval(interval)
  }, 1000)
}
```

```html
<!-- button.html -->
@if (cooldownRestante() > 0) {
  <div class="cooldown-badge">
    Próximo disparo en {{ cooldownRestante() }}s
  </div>
}
```

**En formulario de creación:**
```html
<label>Cooldown entre pulsaciones</label>
<select [(ngModel)]="form.cooldownSegundos">
  <option value="0">Sin límite</option>
  <option value="60">1 minuto</option>
  <option value="300">5 minutos</option>
  <option value="3600">1 hora</option>
  <option value="-1">Personalizado</option>
</select>
```

### Esfuerzo estimado
- Migración de BD (1 columna)
- Lógica de countdown en `button.ts`
- Política RLS adicional
- **Complejidad: media**

---

## Orden de implementación sugerido

1. **Mini-dashboard de actividad** (1 día) — no requiere cambios de BD, alto valor inmediato
2. **Cooldown configurable** (1 día) — mejora calidad de la herramienta para usuarios actuales
3. **Webhook outbound** (2-3 días) — desbloquea el mercado corporativo, mayor esfuerzo

---

## Métricas de éxito

- Número de webhooks configurados por semana
- Retención de usuarios con ≥ 3 botones creados (proxy de uso corporativo)
- Pulsaciones por botón por día (frecuencia de uso activo)
- Descargas del CSV de actividad
