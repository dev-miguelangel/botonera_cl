import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth';
import { PushService } from '../../core/push';

type SubStatus = 'loading' | 'subscribed' | 'already' | 'disabled' | 'error'
               | 'ios-not-installed' | 'ios-needs-permission';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  readonly push = inject(PushService);
  private msgSub?: Subscription;

  // Detect iOS and standalone (PWA installed) mode
  readonly isIos        = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  readonly isStandalone = ('standalone' in navigator && !!(navigator as any).standalone)
                       || window.matchMedia('(display-mode: standalone)').matches;

  sidebarOpen   = signal(false);
  showModal     = signal(false);
  subscribers   = signal<any[]>([]);
  pushStatus    = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  pushMsg       = signal('');
  subStatus     = signal<SubStatus>('loading');
  foregroundMsg = signal<string | null>(null);

  userName = computed(() => {
    const user = this.auth.user();
    return user?.user_metadata?.['full_name'] ?? user?.email ?? 'Usuario';
  });
  userAvatar   = computed(() => this.auth.user()?.user_metadata?.['avatar_url'] ?? null);
  userInitials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  });

  async ngOnInit() {
    if (this.isIos && !this.isStandalone) {
      // Safari on iPhone/iPad (not installed as PWA) — push not available
      this.subStatus.set('ios-not-installed');
    } else if (this.isIos) {
      // Installed PWA on iOS — must request permission via user gesture, not auto
      this.subStatus.set('ios-needs-permission');
    } else {
      const result = await this.push.autoSubscribe();
      this.subStatus.set(result);
    }

    // Toast cuando la app está en primer plano
    this.msgSub = this.push.swPush.messages.subscribe((msg: any) => {
      const body = msg?.notification?.body ?? msg?.body ?? 'Notificación recibida';
      this.foregroundMsg.set(body);
      setTimeout(() => this.foregroundMsg.set(null), 5000);
    });
  }

  ngOnDestroy() {
    this.msgSub?.unsubscribe();
  }

  async activarNotificaciones() {
    this.subStatus.set('loading');
    const result = await this.push.autoSubscribe();
    this.subStatus.set(result);
  }

  async presionar() {
    if (this.pushStatus() === 'sending') return;
    this.pushStatus.set('sending');
    try {
      const { sent } = await this.push.sendPush(this.userName());
      this.pushMsg.set(`Notificación enviada a ${sent} dispositivo${sent !== 1 ? 's' : ''}`);
      this.pushStatus.set('sent');
      setTimeout(() => this.pushStatus.set('idle'), 3000);
    } catch (e: any) {
      this.pushMsg.set(e.message ?? 'Error al enviar');
      this.pushStatus.set('error');
      setTimeout(() => this.pushStatus.set('idle'), 3000);
    }
  }

  async openModal() {
    this.subscribers.set(await this.push.getSubscribers());
    this.showModal.set(true);
  }

  logout() { this.auth.logout(); }
}
