# Plan de implementación — Propuesta 1: Reducir fricción y clarificar el onboarding

**Categoría:** Simplicidad de uso  
**Prioridad sugerida:** Alta (impacto directo en retención de nuevos usuarios)

---

## Objetivo

Reducir el tiempo hasta la primera acción significativa (crear un botón + compartirlo + recibir una notificación) a menos de 60 segundos en la primera sesión.

---

## Idea 1 — Wizard de primer botón en dashboard vacío

### Descripción
Cuando el dashboard no tiene botones propios, reemplazar el estado vacío actual por un flujo guiado de 3 pasos embebido en la misma pantalla (sin redirigir a `/create`).

**Flujo:**
1. **Nombra tu botón** — input de texto con placeholders sugeridos ("Almuerzo listo", "Reunión ahora", "Vengan a cenar")
2. **Elige quién puede pulsar** — selector simplificado con iconos y descripción en lenguaje natural
3. **Comparte** — botón de copiar link + QR generado al instante

### Archivos a modificar
- `src/app/dashboard/dashboard.ts` — lógica de detección de estado vacío y control del wizard
- `src/app/dashboard/dashboard.html` — template condicional: `@if (botones.length === 0)` muestra el wizard, si no el grid normal
- `src/app/create/create.ts` — extraer lógica de creación en un servicio reutilizable

### Implementación técnica

```typescript
// dashboard.ts
get isFirstTime(): boolean {
  return this.misBotones().length === 0 && !this.loading();
}
```

```html
<!-- dashboard.html -->
@if (isFirstTime) {
  <app-onboarding-wizard (botonCreado)="onWizardComplete($event)" />
} @else {
  <!-- grid normal -->
}
```

### Esfuerzo estimado
- 1 componente nuevo (`OnboardingWizardComponent`)
- Refactor menor en `dashboard.ts` para detectar estado vacío
- **Complejidad: baja-media**

---

## Idea 2 — Botón demo pregenerado al registrarse

### Descripción
Al completar el registro, crear automáticamente un botón de ejemplo con nombre "Almuerzo listo 🍽️", política pública, activo durante 24 h. El usuario puede pulsarlo de inmediato y recibir una notificación de prueba en su propio dispositivo.

### Implementación técnica

**Opción A — Trigger en Supabase (recomendada):**
```sql
-- Función que se ejecuta al insertar en auth.users
CREATE OR REPLACE FUNCTION public.create_demo_button()
RETURNS trigger AS $$
BEGIN
  INSERT INTO botones (nombre, slug, owner_id, politica, icono, color, demo, expires_at)
  VALUES (
    'Almuerzo listo',
    'demo-' || NEW.id,
    NEW.id,
    'publico',
    '🍽️',
    '#6366f1',
    true,
    NOW() + INTERVAL '24 hours'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_demo_button();
```

**Opción B — En el servicio de Angular al primer login:**
```typescript
// auth.service.ts
async onFirstLogin(userId: string) {
  const { data: existing } = await supabase
    .from('botones').select('id').eq('owner_id', userId).limit(1);
  if (!existing?.length) {
    await this.crearBotonDemo(userId);
  }
}
```

### Consideraciones
- Marcar el botón con columna `demo: boolean` para poder filtrarlo o eliminarlo
- Añadir badge visual "Demo · expira en Xh" en la tarjeta
- **Complejidad: baja**

---

## Idea 3 — Tooltips contextuales en política de acceso

### Descripción
El selector actual (Solo yo / Suscriptores / Público) no comunica qué significa cada opción en la práctica. Añadir micro-textos descriptivos con casos de uso concretos.

### Copy sugerido

| Opción | Subtítulo actual | Subtítulo propuesto |
|--------|-----------------|---------------------|
| Solo yo | — | "Solo tú puedes pulsar. Ideal para recordatorios personales." |
| Suscriptores | — | "Cualquiera que se una con tu link puede pulsar. Ideal para tu equipo o familia." |
| Público | — | "Cualquier persona con el link puede pulsar, sin registrarse." |

### Archivos a modificar
- `src/app/create/create.html` — añadir `<p class="hint">` bajo cada opción del selector
- `src/app/create/create.ts` — sin cambios de lógica

### Esfuerzo estimado
- Solo HTML/CSS, sin cambios de lógica
- **Complejidad: muy baja**

---

## Orden de implementación sugerido

1. **Tooltips en política** (1-2 h) — impacto inmediato, riesgo cero
2. **Botón demo** (3-4 h) — alto impacto en activación, testar con trigger de Supabase
3. **Wizard de primer botón** (1-2 días) — mayor esfuerzo, mayor impacto visual

---

## Métricas de éxito

- % de nuevos usuarios que crean al menos 1 botón en la primera sesión
- % de nuevos usuarios que comparten el link en la primera sesión
- Tasa de retención a 7 días (usuarios que vuelven después del onboarding)
