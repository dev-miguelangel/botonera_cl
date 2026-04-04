import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { SupabaseService } from './supabase';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  readonly swPush  = inject(SwPush);
  private supabase = inject(SupabaseService).client;

  get isEnabled() { return this.swPush.isEnabled; }

  /** Suscribir al usuario a un botón específico */
  async subscribe(buttonId: string): Promise<'subscribed' | 'already' | 'disabled' | 'error'> {
    if (!this.swPush.isEnabled) return 'disabled';

    try {
      let sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000), catchError(() => of(null))));

      if (!sub) {
        sub = await this.swPush.requestSubscription({
          serverPublicKey: environment.vapidPublicKey,
        });
      }

      const already = await this.isSubscribed(buttonId);
      await this.saveToDb(buttonId, sub!);
      return already ? 'already' : 'subscribed';
    } catch (e) {
      console.error('PushService.subscribe error:', e);
      return 'error';
    }
  }

  /** Desuscribir del botón (elimina solo la fila de DB, no la suscripción del browser) */
  async unsubscribe(buttonId: string): Promise<void> {
    const sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000), catchError(() => of(null))));
    if (!sub) return;

    await this.supabase
      .from('subscriptions')
      .delete()
      .eq('button_id', buttonId)
      .eq('endpoint', sub.endpoint);
  }

  async isSubscribed(buttonId: string): Promise<boolean> {
    const sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000), catchError(() => of(null))));
    if (!sub) return false;

    const { data } = await this.supabase
      .from('subscriptions')
      .select('id')
      .eq('button_id', buttonId)
      .eq('endpoint', sub.endpoint)
      .maybeSingle();
    return !!data;
  }

  private async saveToDb(buttonId: string, sub: PushSubscription): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const keys = sub.toJSON().keys ?? {};
    const { error } = await this.supabase.from('subscriptions').upsert({
      button_id:  buttonId,
      user_id:    user.id,
      user_name:  user.user_metadata?.['full_name'] ?? user.email ?? 'Anónimo',
      user_email: user.email ?? '',
      endpoint:   sub.endpoint,
      p256dh:     keys['p256dh'],
      auth_token: keys['auth'],
    }, { onConflict: 'button_id,endpoint' });

    if (error) console.error('PushService.saveToDb error:', error);
  }

  async sendPush(buttonId: string, pressedBy: string): Promise<{ sent: number }> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) throw new Error('Sin sesión');

    const res = await fetch(
      `${environment.supabaseUrl}/functions/v1/send-push`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ button_id: buttonId, pressed_by: pressedBy }),
      }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al enviar');
    return json;
  }
}
