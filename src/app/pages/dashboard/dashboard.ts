import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { ButtonService, Button } from '../../core/button.service';
import { PushService } from '../../core/push';
import { OnboardingWizardComponent } from './onboarding-wizard';
import { COLORS } from '../create/create';

interface DashboardBtn extends Button {
  isOwn: boolean;
  followerCount: number;
  isMuted: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, OnboardingWizardComponent],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private auth    = inject(AuthService);
  private btnSvc  = inject(ButtonService);
  private push    = inject(PushService);
  private router  = inject(Router);

  sidebarOpen    = signal(false);
  loading        = signal(true);
  showWizard     = signal(false);

  private myButtons      = signal<Button[]>([]);
  private subButtons     = signal<Button[]>([]);
  private followerCounts = signal<Record<string, number>>({});
  private mutedButtonIds = signal<Set<string>>(new Set());

  pressingId  = signal<string | null>(null);
  pressResult = signal<{ id: string; msg: string; ok: boolean } | null>(null);

  userName = computed(() => {
    const u = this.auth.user();
    return u?.user_metadata?.['full_name'] ?? u?.email ?? 'Usuario';
  });
  userAvatar   = computed(() => this.auth.user()?.user_metadata?.['avatar_url'] ?? null);
  userInitials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  });

  allButtons = computed<DashboardBtn[]>(() => {
    const counts = this.followerCounts();
    const mutedIds = this.mutedButtonIds();
    const own = this.myButtons()
      .map(b => ({ ...b, isOwn: true,  followerCount: counts[b.id] ?? 0, isMuted: false }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const sub = this.subButtons()
      .map(b => ({ ...b, isOwn: false, followerCount: counts[b.id] ?? 0, isMuted: mutedIds.has(b.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return [...own, ...sub];
  });

  hasOwnButtons = computed(() => this.myButtons().length > 0);

  colorHex(colorVal: string): string {
    return COLORS.find(c => c.value === colorVal)?.swatch ?? '#4f46e5';
  }

  canPressSub(btn: DashboardBtn): boolean {
    return btn.press_policy === 'anyone_with_link' || btn.press_policy === 'subscribers';
  }

  async ngOnInit() {
    const [mine, subscribed, mutedIds] = await Promise.all([
      this.btnSvc.getMyButtons(),
      this.btnSvc.getSubscribedButtons(),
      this.push.getMutedButtonIds(),
    ]);
    this.myButtons.set(mine);
    this.subButtons.set(subscribed);
    this.mutedButtonIds.set(new Set(mutedIds));

    const allIds = [...mine, ...subscribed].map(b => b.id);
    if (allIds.length) {
      this.followerCounts.set(await this.btnSvc.getFollowerCounts(allIds));
    }

    this.loading.set(false);
    if (mine.length === 0) this.showWizard.set(true);
  }

  onWizardCreated(btn: Button) {
    this.myButtons.set([btn]);
    this.showWizard.set(false);
  }

  onWizardDismissed() {
    this.showWizard.set(false);
  }

  async tapCard(btn: DashboardBtn) {
    if (btn.isOwn) {
      this.router.navigate(['/button', btn.slug]);
      return;
    }
    if (!this.canPressSub(btn)) {
      this.router.navigate(['/button', btn.slug]);
      return;
    }
    if (this.pressingId()) return;
    this.pressingId.set(btn.id);
    this.pressResult.set(null);
    try {
      const result = await this.push.sendPush(btn.id, this.userName());
      const msg = result.paused
        ? 'Botón pausado'
        : `Enviado a ${result.sent} dispositivo${result.sent !== 1 ? 's' : ''}`;
      this.pressResult.set({ id: btn.id, msg, ok: !result.paused });
    } catch (e: any) {
      this.pressResult.set({ id: btn.id, msg: e.message ?? 'Error', ok: false });
    } finally {
      this.pressingId.set(null);
      setTimeout(() => this.pressResult.set(null), 3000);
    }
  }

  logout() { this.auth.logout(); }
}
