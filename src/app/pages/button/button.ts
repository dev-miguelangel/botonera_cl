import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth';
import { ButtonService, Button } from '../../core/button.service';
import { PushService } from '../../core/push';
import { COLORS } from '../create/create';

type Tab = 'suscritos' | 'historial' | 'compartir';

@Component({
  selector: 'app-button',
  imports: [DatePipe, RouterLink],
  templateUrl: './button.html',
})
export class ButtonPage implements OnInit, OnDestroy {
  private route   = inject(ActivatedRoute);
  private auth    = inject(AuthService);
  private btnSvc  = inject(ButtonService);
  readonly push   = inject(PushService);
  private msgSub?: Subscription;

  button        = signal<Button | null>(null);
  loading       = signal(true);
  notFound      = signal(false);

  isOwner       = signal(false);
  subscribed    = signal(false);
  subLoading    = signal(false);

  pushStatus    = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  pushMsg       = signal('');

  activeTab     = signal<Tab>('suscritos');
  subscribers   = signal<any[]>([]);
  pressLog      = signal<any[]>([]);
  inviteUrl     = signal('');
  inviteLoading = signal(false);
  copied        = signal(false);

  foregroundMsg = signal<string | null>(null);

  readonly origin        = window.location.origin;
  readonly isIos         = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  readonly isStandalone  = ('standalone' in navigator && !!(navigator as any).standalone)
                        || window.matchMedia('(display-mode: standalone)').matches;
  readonly isMobile      = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
  readonly showOpenInApp = this.isIos && !this.isStandalone;
  readonly requiresPwa   = this.isMobile && !this.isStandalone;

  subMsg = signal('');

  userName = computed(() => {
    const u = this.auth.user();
    return u?.user_metadata?.['full_name'] ?? u?.email ?? 'Usuario';
  });

  buttonColor = computed(() => {
    const c = this.button()?.color ?? 'indigo';
    return COLORS.find(x => x.value === c) ?? COLORS[0];
  });

  canPress = computed(() => {
    const btn = this.button();
    if (!btn) return false;
    if (btn.press_policy === 'owner_only') return this.isOwner();
    if (btn.press_policy === 'subscribers') return this.subscribed() || this.isOwner();
    return true; // anyone_with_link
  });

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;

    // En iOS browser (no PWA): guardar pendingNav para que la app lo retome
    if (this.showOpenInApp) {
      localStorage.setItem('pendingNav', `/button/${slug}`);
    }

    const btn = await this.btnSvc.getBySlug(slug);

    if (!btn) { this.notFound.set(true); this.loading.set(false); return; }

    this.button.set(btn);
    const userId = this.auth.user()?.id;
    this.isOwner.set(btn.owner_id === userId);

    // Check subscription status
    const isSub = await this.push.isSubscribed(btn.id);
    this.subscribed.set(isSub);

    // Load owner data upfront
    if (this.isOwner()) {
      const [subs, log] = await Promise.all([
        this.btnSvc.getSubscribers(btn.id),
        this.btnSvc.getPressLog(btn.id),
      ]);
      this.subscribers.set(subs);
      this.pressLog.set(log);
    }

    this.loading.set(false);

    // Foreground push toast
    this.msgSub = this.push.swPush.messages.subscribe((msg: any) => {
      const body = msg?.notification?.body ?? msg?.body ?? 'Notificación recibida';
      this.foregroundMsg.set(body);
      setTimeout(() => this.foregroundMsg.set(null), 5000);
    });
  }

  ngOnDestroy() {
    this.msgSub?.unsubscribe();
  }

  async presionar() {
    if (this.pushStatus() === 'sending') return;
    this.pushStatus.set('sending');
    try {
      const { sent } = await this.push.sendPush(this.button()!.id, this.userName());
      this.pushMsg.set(`Notificación enviada a ${sent} dispositivo${sent !== 1 ? 's' : ''}`);
      this.pushStatus.set('sent');
    } catch (e: any) {
      this.pushMsg.set(e.message ?? 'Error al enviar');
      this.pushStatus.set('error');
    }
    setTimeout(() => this.pushStatus.set('idle'), 3000);
  }

  async toggleSubscribe() {
    if (this.subLoading()) return;
    this.subLoading.set(true);
    try {
      if (this.subscribed()) {
        await this.push.unsubscribe(this.button()!.id);
        this.subscribed.set(false);
      } else {
        const result = await this.push.subscribe(this.button()!.id);
        if (result === 'subscribed' || result === 'already') {
          this.subscribed.set(true);
          this.subMsg.set('');
          if (this.isOwner()) {
            this.subscribers.set(await this.btnSvc.getSubscribers(this.button()!.id));
          }
        } else if (result === 'disabled') {
          this.subMsg.set(this.isIos
            ? 'En iPhone, instala la app para recibir notificaciones: Safari → Compartir ⎙ → Añadir a pantalla de inicio'
            : 'Tu navegador no soporta notificaciones push. Prueba instalando la app.');
        } else {
          this.subMsg.set('No se pudo suscribir. Inténtalo de nuevo.');
        }
      }
    } finally {
      this.subLoading.set(false);
    }
  }

  async generateInvite() {
    this.inviteLoading.set(true);
    try {
      const token = await this.btnSvc.createInvite(this.button()!.id);
      this.inviteUrl.set(`${window.location.origin}/join/${token}`);
    } catch (e: any) {
      console.error('createInvite error:', e);
    } finally {
      this.inviteLoading.set(false);
    }
  }

  async copyButtonUrl() {
    const url = `${window.location.origin}/button/${this.button()!.slug}`;
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async copyInvite() {
    await navigator.clipboard.writeText(this.inviteUrl());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
