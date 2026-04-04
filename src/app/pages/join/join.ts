import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonService } from '../../core/button.service';
import { PushService } from '../../core/push';

@Component({
  selector: 'app-join',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center px-4">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-indigo-600 animate-pulse" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </div>
        <p class="text-gray-700 font-semibold">{{ msg }}</p>
        <p class="text-sm text-gray-400 mt-1">{{ sub }}</p>
      </div>
    </div>
  `,
})
export class Join implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private btnSvc  = inject(ButtonService);
  private push    = inject(PushService);

  msg = 'Procesando invitación...';
  sub = '';

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token')!;
    try {
      const result = await this.btnSvc.useInviteToken(token);
      if (!result) {
        this.msg = 'Enlace inválido o expirado';
        this.sub = 'Pide al dueño un nuevo enlace';
        setTimeout(() => this.router.navigate(['/dashboard']), 3000);
        return;
      }

      this.msg = `Uniéndote a "${result.button_name}"...`;
      this.sub = 'Activando notificaciones';

      await this.push.subscribe(result.button_id);
      this.router.navigate(['/button', result.button_slug]);
    } catch (e: any) {
      this.msg = 'Error al procesar la invitación';
      this.sub = e.message ?? '';
      setTimeout(() => this.router.navigate(['/dashboard']), 3000);
    }
  }
}
