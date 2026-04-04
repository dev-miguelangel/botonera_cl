import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />

    @if (updateReady()) {
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                  bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl
                  shadow-2xl max-w-sm w-full mx-4">
        <span class="flex-1">Nueva versión disponible</span>
        <button (click)="applyUpdate()"
                class="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs font-bold transition">
          Actualizar
        </button>
        <button (click)="updateReady.set(false)"
                class="text-gray-400 hover:text-white transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    }
  `,
})
export class App implements OnInit {
  private swUpdate  = inject(SwUpdate);
  updateReady       = signal(false);

  ngOnInit() {
    if (!this.swUpdate.isEnabled) return;

    // Detectar nueva versión lista
    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));

    // Verificar al inicio y cada 30 minutos
    this.swUpdate.checkForUpdate();
    setInterval(() => this.swUpdate.checkForUpdate(), 30 * 60 * 1000);

    // Verificar también cuando el usuario vuelve a la app (pestaña activa)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.swUpdate.checkForUpdate();
      }
    });
  }

  async applyUpdate() {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }
}
