import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonService } from '../../core/button.service';
import { AuthService } from '../../core/auth';

export interface IconOption {
  value: string;
  label: string;
}

export interface ColorOption {
  value: string;
  label: string;
  swatch: string;
  bg: string;
  shadow: string;
}

export const ICONS: IconOption[] = [
  { value: 'notifications',      label: 'Notificación' },
  { value: 'alarm',              label: 'Alarma' },
  { value: 'emergency',          label: 'Emergencia' },
  { value: 'medical_services',   label: 'Médico' },
  { value: 'home',               label: 'Casa' },
  { value: 'work',               label: 'Trabajo' },
  { value: 'school',             label: 'Escuela' },
  { value: 'shopping_cart',      label: 'Compras' },
  { value: 'restaurant',         label: 'Comida' },
  { value: 'directions_car',     label: 'Auto' },
  { value: 'sports_soccer',      label: 'Deporte' },
  { value: 'fitness_center',     label: 'Gym' },
  { value: 'celebration',        label: 'Fiesta' },
  { value: 'pets',               label: 'Mascotas' },
  { value: 'music_note',         label: 'Música' },
  { value: 'favorite',           label: 'Favorito' },
  { value: 'star',               label: 'Estrella' },
  { value: 'bolt',               label: 'Urgente' },
  { value: 'local_fire_department', label: 'Fuego' },
  { value: 'water_drop',         label: 'Agua' },
  { value: 'camera_alt',         label: 'Foto' },
  { value: 'phone',              label: 'Llamar' },
  { value: 'check_circle',       label: 'Listo' },
  { value: 'warning',            label: 'Aviso' },
];

export const COLORS: ColorOption[] = [
  { value: 'indigo',   label: 'Índigo',   swatch: '#4f46e5', bg: 'bg-indigo-600',  shadow: 'shadow-indigo-200'  },
  { value: 'violet',   label: 'Violeta',  swatch: '#7c3aed', bg: 'bg-violet-600',  shadow: 'shadow-violet-200'  },
  { value: 'blue',     label: 'Azul',     swatch: '#2563eb', bg: 'bg-blue-600',    shadow: 'shadow-blue-200'    },
  { value: 'sky',      label: 'Cielo',    swatch: '#0284c7', bg: 'bg-sky-600',     shadow: 'shadow-sky-200'     },
  { value: 'emerald',  label: 'Esmeralda',swatch: '#059669', bg: 'bg-emerald-600', shadow: 'shadow-emerald-200' },
  { value: 'teal',     label: 'Teal',     swatch: '#0d9488', bg: 'bg-teal-600',    shadow: 'shadow-teal-200'    },
  { value: 'amber',    label: 'Ámbar',    swatch: '#d97706', bg: 'bg-amber-600',   shadow: 'shadow-amber-200'   },
  { value: 'orange',   label: 'Naranja',  swatch: '#ea580c', bg: 'bg-orange-600',  shadow: 'shadow-orange-200'  },
  { value: 'rose',     label: 'Rosa',     swatch: '#e11d48', bg: 'bg-rose-600',    shadow: 'shadow-rose-200'    },
  { value: 'red',      label: 'Rojo',     swatch: '#dc2626', bg: 'bg-red-600',     shadow: 'shadow-red-200'     },
];

@Component({
  selector: 'app-create',
  imports: [FormsModule, RouterLink],
  templateUrl: './create.html',
})
export class Create {
  private buttons = inject(ButtonService);
  private router  = inject(Router);
  private auth    = inject(AuthService);

  get slugPreview(): string {
    const userId = this.auth.user()?.id;
    if (!userId || !this.slug) return this.slug;
    return `${this.slug}-${userId.slice(0, 6)}`;
  }

  readonly icons  = ICONS;
  readonly colors = COLORS;

  name        = '';
  description = '';
  slug        = '';
  policy      = 'anyone_with_link';
  icon        = signal('notifications');
  color       = signal('indigo');
  submitting  = signal(false);
  error       = signal('');

  selectedColor() {
    return COLORS.find(c => c.value === this.color()) ?? COLORS[0];
  }

  onNameChange() {
    this.slug = this.buttons.slugify(this.name);
  }

  async submit() {
    if (!this.name.trim() || !this.slug.trim()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const btn = await this.buttons.create({
        name:         this.name.trim(),
        description:  this.description.trim() || undefined,
        slug:         this.slug.trim(),
        press_policy: this.policy as any,
        icon:         this.icon(),
        color:        this.color(),
      });
      this.router.navigate(['/button', btn.slug]);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al crear el botón');
    } finally {
      this.submitting.set(false);
    }
  }
}
