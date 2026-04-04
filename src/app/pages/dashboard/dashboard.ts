import { Component, inject, signal, computed } from '@angular/core';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private auth = inject(AuthService);

  sidebarOpen = signal(false);

  userName = computed(() => {
    const user = this.auth.user();
    return user?.user_metadata?.['full_name'] ?? user?.email ?? 'Usuario';
  });

  userAvatar = computed(() => this.auth.user()?.user_metadata?.['avatar_url'] ?? null);

  userInitials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  });

  logout() {
    this.auth.logout();
  }

  botones = [
    { icon: '🔔', nombre: 'Apoyo técnico', desc: 'Solicitar soporte de TI', suscritos: 12, color: 'bg-indigo-50', badge: 'text-indigo-600 bg-indigo-100' },
    { icon: '🍽️', nombre: 'Almuerzo listo', desc: 'Aviso al equipo de cocina', suscritos: 8, color: 'bg-green-50', badge: 'text-green-600 bg-green-100' },
    { icon: '🚨', nombre: 'Emergencia', desc: 'Alerta a todo el personal', suscritos: 34, color: 'bg-rose-50', badge: 'text-rose-600 bg-rose-100' },
  ];

  navItems = [
    { icon: '▦', label: 'Mi botonera', active: true },
    { icon: '+', label: 'Nuevo botón', active: false },
    { icon: '🔔', label: 'Suscritos', active: false },
    { icon: '⚙', label: 'Ajustes', active: false },
  ];
}
