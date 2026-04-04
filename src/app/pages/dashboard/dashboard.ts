import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  sidebarOpen = signal(false);

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
