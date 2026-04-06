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

  private get isIosNonPwa(): boolean {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = ('standalone' in navigator && !!(navigator as any).standalone)
                      || window.matchMedia('(display-mode: standalone)').matches;
    return isIos && !isStandalone;
  }

  // ── FOLLOWS (solo DB, sin push) ──────────────────────

  async follow(buttonId: string): Promise<'followed' | 'already' | 'not-authed'> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return 'not-authed';

    const user = session.user;
    const { error } = await this.supabase.from('follows').upsert({
      button_id:  buttonId,
      user_id:    user.id,
      user_name:  user.user_metadata?.['full_name'] ?? user.email ?? 'Anónimo',
      user_email: user.email ?? '',
    }, { onConflict: 'button_id,user_id', ignoreDuplicates: true });

    if (error) { console.error('follow error:', error); return 'already'; }
    return 'followed';
  }

  async unfollow(buttonId: string): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;

    await this.supabase.from('follows')
      .delete()
      .eq('button_id', buttonId)
      .eq('user_id', session.user.id);

    // Eliminar también la suscripción push si existe
    const sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(3000), catchError(() => of(null))));
    if (sub) {
      await this.supabase.from('subscriptions')
        .delete()
        .eq('button_id', buttonId)
        .eq('endpoint', sub.endpoint);
    }
  }

  async isFollowing(buttonId: string): Promise<boolean> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return false;

    const { data } = await this.supabase
      .from('follows')
      .select('id')
      .eq('button_id', buttonId)
      .eq('user_id', session.user.id)
      .maybeSingle();
    return !!data;
  }

  // ── PUSH NOTIFICATIONS ───────────────────────────────

  /** Activar notificaciones push para un botón (requiere SW activo) */
  async subscribe(buttonId: string): Promise<'subscribed' | 'already' | 'disabled' | 'not-authed' | 'error'> {
    if (!this.swPush.isEnabled) return 'disabled';
    if (this.isIosNonPwa) return 'disabled';

    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return 'not-authed';

    try {
      let sub = await firstValueFrom(this.swPush.subscription.pipe(timeout(5000), catchError(() => of(null))));

      if (!sub) {
        sub = await this.swPush.requestSubscription({
          serverPublicKey: environment.vapidPublicKey,
        });
      }

      const already = await this.isSubscribed(buttonId);
      await this.savePushToDb(buttonId, sub!, session.user);
      // También asegurar que existe el follow
      await this.follow(buttonId);
      return already ? 'already' : 'subscribed';
    } catch (e: any) {
      console.error('PushService.subscribe error:', e);
      if (e?.name === 'NotAllowedError') return 'disabled';
      return 'error';
    }
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

  private async savePushToDb(buttonId: string, sub: PushSubscription, user: any): Promise<void> {
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

    if (error) console.error('PushService.savePushToDb error:', error);
  }

  async isMuted(buttonId: string): Promise<boolean> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return false;
    const { data } = await this.supabase
      .from('follows')
      .select('is_muted')
      .eq('button_id', buttonId)
      .eq('user_id', session.user.id)
      .maybeSingle();
    return data?.is_muted ?? false;
  }

  async toggleMute(buttonId: string, muted: boolean): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;
    await this.supabase.from('follows')
      .update({ is_muted: muted })
      .eq('button_id', buttonId)
      .eq('user_id', session.user.id);
  }

  async getMutedButtonIds(): Promise<string[]> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return [];
    const { data } = await this.supabase
      .from('follows')
      .select('button_id')
      .eq('user_id', session.user.id)
      .eq('is_muted', true);
    return data?.map((f: any) => f.button_id) ?? [];
  }

  async sendPush(buttonId: string, pressedBy: string): Promise<{ sent: number; paused?: boolean }> {
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
