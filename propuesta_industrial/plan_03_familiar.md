# Plan de implementación — Propuesta 3: Personalización emocional y acceso instantáneo desde móvil

**Categoría:** Uso familiar cotidiano  
**Prioridad sugerida:** Media (diferenciador de producto, aumenta retención a largo plazo)

---

## Objetivo

Transformar cada botón en un objeto digital con identidad propia y carga afectiva. Aumentar la frecuencia de uso convirtiendo el pulsar en un hábito placentero, accesible para cualquier miembro de la familia sin instrucciones técnicas.

---

## Idea 1 — Acceso directo desde pantalla de inicio (URL corta + icono)

### Descripción
Generar un shortcut nativo al botón individual (no al dashboard completo), para que "La cena está lista" sea un ícono en el home screen que se pulsa directamente. Compatible con el add-to-homescreen de iOS y Android.

### Cómo funciona técnicamente
Las PWA permiten agregar shortcuts mediante el Web App Manifest. Sin embargo, los shortcuts del manifest son estáticos. La solución es una URL directa al botón (`/button/:slug`) que al abrirse en PWA instalada lleva directamente a ese botón.

**Para facilitar el proceso al usuario:**

```typescript
// button.ts — Generar instrucciones de instalación
generarShortcutInstrucciones() {
  const url = `${window.location.origin}/button/${this.boton().slug}`
  const nombre = this.boton().nombre
  
  // En iOS: copiar URL y mostrar instrucciones de Safari
  // En Android: usar BeforeInstallPromptEvent si disponible
  this.mostrarModalShortcut(url, nombre)
}
```

```html
<!-- En la vista del botón, menú de opciones -->
<button (click)="generarShortcutInstrucciones()">
  📲 Agregar al inicio del teléfono
</button>
```

**Modal de instrucciones contextual:**
```typescript
// Detectar plataforma
get instruccionesShortcut(): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)
  
  if (isIOS) return `
    1. Toca el ícono de compartir (⬆️) en Safari
    2. Selecciona "Agregar a pantalla de inicio"
    3. Pon el nombre "${this.boton().nombre}" y toca Agregar
  `
  if (isAndroid) return `
    1. Toca el menú (⋮) en Chrome
    2. Selecciona "Agregar a pantalla de inicio"
  `
  return 'Guarda este enlace en tus favoritos.'
}
```

**Consideración de ícono dinámico:**
- El botón ya tiene `icono` (emoji) y `color`. Usar esas propiedades para generar un favicon/OG image dinámico por ruta, haciendo que el shortcut en home screen muestre el color y emoji del botón.
- Implementar con un endpoint `/api/icon/:slug` que genere una imagen SVG dinámica.

### Esfuerzo estimado
- Modal de instrucciones: 2-3 h
- Endpoint de ícono dinámico (SVG): 1 día
- **Complejidad: media**

---

## Idea 2 — Reacciones en notificaciones push

### Descripción
Al recibir la notificación push de que un botón fue pulsado, permitir responder con un emoji rápido ("Ya voy 🏃", "5 minutos ⏰", "OK 👍") que el pulsador ve en tiempo real en la app. Cierra el ciclo de comunicación sin necesidad de abrir la app.

### Cómo funcionan las action buttons en push notifications

Las notificaciones push soportan `actions` en el Service Worker:

```javascript
// src/sw-custom.js o ngsw-worker.js (patch)
self.addEventListener('push', (event) => {
  const data = event.data.json()
  
  event.waitUntil(
    self.registration.showNotification(data.titulo, {
      body: data.mensaje,
      icon: '/icons/icon-192.png',
      data: { pulsacion_id: data.pulsacion_id, boton_slug: data.boton_slug },
      actions: [
        { action: 'ya-voy',    title: '🏃 Ya voy'      },
        { action: 'cinco-min', title: '⏰ 5 minutos'    },
        { action: 'ok',        title: '👍 OK'           }
      ]
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event
  if (!action) return // click en el cuerpo → abrir app

  event.waitUntil(
    fetch('/api/reaccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pulsacion_id: notification.data.pulsacion_id,
        reaccion: action
      })
    })
  )
  notification.close()
})
```

### Modelo de datos

```sql
ALTER TABLE pulsaciones ADD COLUMN reaccion TEXT;
-- Valores posibles: 'ya-voy', 'cinco-min', 'ok', NULL
```

### Mostrar reacción al pulsador

```typescript
// button.ts — suscribirse a cambios en tiempo real
private escucharReacciones(pulsacionId: string) {
  supabase
    .channel(`reaccion:${pulsacionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'pulsaciones',
      filter: `id=eq.${pulsacionId}`
    }, (payload) => {
      this.ultimaReaccion.set(payload.new.reaccion)
    })
    .subscribe()
}
```

```html
@if (ultimaReaccion()) {
  <div class="reaccion-badge">
    {{ reaccionEmoji(ultimaReaccion()) }} {{ reaccionTexto(ultimaReaccion()) }}
  </div>
}
```

### Limitaciones a considerar
- Las `notification.actions` no están soportadas en iOS (Safari/PWA) actualmente
- En Android Chrome y escritorio funcionan correctamente
- Implementar con degradación: en iOS solo se muestra la notificación sin acciones

### Esfuerzo estimado
- Modificar Service Worker
- Endpoint Edge Function `/api/reaccion`
- Migración de BD (1 columna)
- UI de feedback en `button.ts`
- **Complejidad: media-alta**

---

## Idea 3 — Racha semanal y mensaje personalizado del propietario

### Descripción
Mostrar cuántas veces se usó el botón esta semana con un mensaje amistoso del propietario visible para los suscriptores. Gamificación mínima que refuerza el hábito sin infantilizar.

### Componentes

**1. Contador de racha en la vista del botón:**
```typescript
// button.ts
rachaActual = computed(() => {
  const hoy = new Date()
  const inicioSemana = new Date(hoy)
  inicioSemana.setDate(hoy.getDate() - hoy.getDay())
  inicioSemana.setHours(0, 0, 0, 0)
  
  return this.historial().filter(p =>
    new Date(p.created_at) >= inicioSemana
  ).length
})
```

```html
<div class="racha-strip">
  <span class="racha-count">{{ rachaActual() }}</span>
  <span class="racha-label">
    {{ rachaActual() === 1 ? 'vez' : 'veces' }} esta semana
  </span>
</div>
```

**2. Mensaje personalizado del propietario:**

```sql
ALTER TABLE botones ADD COLUMN mensaje_propietario TEXT;
-- Ej: "¡Gracias por avisar siempre! 🥰" o "La cena se enfría... ¡Apúrense! 😄"
```

```html
<!-- En formulario de creación/edición, sección opcional -->
<label>Mensaje para tus suscriptores (opcional)</label>
<input type="text" 
       placeholder="Ej: ¡Gracias por avisar siempre! 🥰"
       maxlength="80"
       [(ngModel)]="form.mensajePropietario" />
<p class="hint">Aparece en la vista del botón para quienes se suscriban.</p>
```

```html
<!-- En button.html, si existe mensaje -->
@if (boton().mensaje_propietario) {
  <div class="mensaje-propietario">
    <span class="comilla">"</span>
    {{ boton().mensaje_propietario }}
    <span class="comilla">"</span>
    <span class="firma">— {{ nombrePropietario() }}</span>
  </div>
}
```

**3. Animación sutil al pulsar (refuerzo positivo):**
```typescript
// button.ts
pulsarConFeedback() {
  this.pulsar()
  this.animarPulse.set(true)
  setTimeout(() => this.animarPulse.set(false), 600)
}
```
```css
/* Ripple effect ya existente en Tailwind — añadir scale momentáneo */
.btn-pulsar.animando {
  animation: pulse-scale 0.4s ease-out;
}
@keyframes pulse-scale {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
```

### Esfuerzo estimado
- Migración de BD (1 columna)
- Lógica de racha en `button.ts` (usa historial ya cargado)
- Campo en formulario de creación/edición
- Animación CSS
- **Complejidad: baja**

---

## Orden de implementación sugerido

1. **Racha + mensaje del propietario** (4-6 h) — solo BD + UI, sin infraestructura nueva
2. **Shortcut a pantalla de inicio** (1 día) — UX crítica para uso desde móvil
3. **Reacciones en push** (2-3 días) — mayor impacto en la dinámica familiar, más complejo

---

## Métricas de éxito

- % de botones con mensaje de propietario configurado (adopción del mensaje)
- Promedio de pulsaciones por botón por semana (frecuencia de hábito)
- % de usuarios que agregan el shortcut al home screen
- Tasa de reacciones por notificación recibida (engagement del ciclo cerrado)
