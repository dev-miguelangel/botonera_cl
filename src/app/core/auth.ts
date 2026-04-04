import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService).client;
  private router   = inject(Router);

  session = signal<Session | null>(null);
  user    = signal<User | null>(null);

  constructor() {
    // Cargar sesión inicial
    this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.user.set(data.session?.user ?? null);
    });

    // Escuchar cambios de auth
    // Solo navegar en eventos explícitos — INITIAL_SESSION puede llegar con null
    // mientras el intercambio PKCE todavía no terminó (Android/iOS PWA)
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        this.router.navigate(['/dashboard']);
      } else if (event === 'SIGNED_OUT') {
        this.router.navigate(['/login']);
      }
      // INITIAL_SESSION: no navegar, la ruta actual y el guard lo manejan
    });
  }

  async loginWithGoogle(): Promise<void> {
    await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  isLoggedIn(): boolean {
    return !!this.session();
  }
}
