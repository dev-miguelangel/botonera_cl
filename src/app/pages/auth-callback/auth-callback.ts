import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase';

@Component({
  selector: 'app-auth-callback',
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-950">
      <div class="text-center">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-400 text-sm">Iniciando sesión...</p>
      </div>
    </div>
  `,
})
export class AuthCallback implements OnInit {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);

  async ngOnInit() {
    // Si ya hay sesión (ej. recarga), ir directo
    const { data } = await this.supabase.auth.getSession();
    if (data.session) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Esperar que Supabase intercambie el código PKCE del URL (?code=...)
    // y dispare SIGNED_IN. Timeout de 15s como fallback.
    const timeout = setTimeout(() => {
      sub.unsubscribe();
      this.router.navigate(['/login']);
    }, 15000);

    const { data: { subscription: sub } } = this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(timeout);
        sub.unsubscribe();
        this.router.navigate(['/dashboard']);
      }
    });
  }
}
