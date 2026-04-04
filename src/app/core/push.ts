import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  readonly swPush  = inject(SwPush);
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  get isEnabled() { return this.swPush.isEnabled; }

  // Suscribir automáticamente al usuario al botón de prueba
  async autoSubscribe(): Promise<'subscribed' | 'already' | 'disabled' | 'error'> {
    if (!this.swPush.isEnabled) return 'disabled';

    try {
      const existing = await firstValueFrom(this.swPush.subscription);
      if (existing) {
        await this.saveToDb(existing);
        return 'already';
      }

      const sub = await this.swPush.requestSubscription({
        serverPublicKey: environment.vapidPublicKey,
      });
      await this.saveToDb(sub);
      return 'subscribed';
    } catch (e) {
      console.error('autoSubscribe error:', e);
      return 'error';
    }
  }

  private async saveToDb(sub: PushSubscription): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    const keys = sub.toJSON().keys ?? {};
    const { error } = await this.supabase.from('subscriptions').upsert({
      user_id:    user.id,
      user_name:  user.user_metadata?.['full_name'] ?? user.email ?? 'Anónimo',
      user_email: user.email ?? '',
      endpoint:   sub.endpoint,
      p256dh:     keys['p256dh'],
      auth_token: keys['auth'],
    }, { onConflict: 'endpoint' });

    if (error) console.error('saveToDb error:', error);
  }

  // Obtener todos los suscritos (solo para el modal de admin)
  async getSubscribers() {
    const { data } = await this.supabase
      .from('subscriptions')
      .select('id, user_name, user_email, created_at')
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  // Enviar push a todos los suscritos via Edge Function
  async sendPush(pressedBy: string): Promise<{ sent: number }> {
    const session = this.auth.session();
    if (!session) throw new Error('Sin sesión');

    const res = await fetch(
      `${environment.supabaseUrl}/functions/v1/send-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pressed_by: pressedBy }),
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al enviar');
    return json;
  }
}
