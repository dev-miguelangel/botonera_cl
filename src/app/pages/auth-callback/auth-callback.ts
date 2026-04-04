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
    // Con implicit flow, Supabase parsea #access_token del hash sincrónicamente
    // al inicializar el cliente, así que getSession() ya tiene la sesión.
    const { data } = await this.supabase.auth.getSession();

    if (data.session) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Fallback: esperar SIGNED_IN si el parsing fue async (ej. token refresh)
    const fallback = setTimeout(() => {
      sub.unsubscribe();
      this.router.navigate(['/login']);
    }, 8000);

    const { data: { subscription: sub } } = this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        clearTimeout(fallback);
        sub.unsubscribe();
        this.router.navigate(['/dashboard']);
      }
    });
  }
}
