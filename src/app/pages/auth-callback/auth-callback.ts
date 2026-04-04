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
    // Supabase auto-exchanges the PKCE code from the URL on client init.
    // Wait briefly then check session; onAuthStateChange in AuthService also
    // handles the navigation, but this is a fallback.
    const { data } = await this.supabase.auth.getSession();
    if (data.session) {
      this.router.navigate(['/dashboard']);
    } else {
      // Give onAuthStateChange a moment to fire
      setTimeout(async () => {
        const { data: d2 } = await this.supabase.auth.getSession();
        this.router.navigate([d2.session ? '/dashboard' : '/login']);
      }, 1500);
    }
  }
}
