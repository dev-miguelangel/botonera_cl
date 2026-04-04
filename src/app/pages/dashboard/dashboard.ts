import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/auth';
import { ButtonService, Button } from '../../core/button.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private auth    = inject(AuthService);
  private buttons = inject(ButtonService);
  private router  = inject(Router);

  sidebarOpen    = signal(false);
  myButtons      = signal<Button[]>([]);
  subButtons     = signal<Button[]>([]);
  loading        = signal(true);

  userName = computed(() => {
    const u = this.auth.user();
    return u?.user_metadata?.['full_name'] ?? u?.email ?? 'Usuario';
  });
  userAvatar   = computed(() => this.auth.user()?.user_metadata?.['avatar_url'] ?? null);
  userInitials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  });

  async ngOnInit() {
    const [mine, subscribed] = await Promise.all([
      this.buttons.getMyButtons(),
      this.buttons.getSubscribedButtons(),
    ]);
    this.myButtons.set(mine);
    this.subButtons.set(subscribed);
    this.loading.set(false);
  }

  navigateTo(slug: string) {
    this.router.navigate(['/button', slug]);
  }

  logout() { this.auth.logout(); }
}
