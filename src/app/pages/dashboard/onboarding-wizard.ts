import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonService, Button } from '../../core/button.service';
import { ICONS, COLORS } from '../create/create';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './onboarding-wizard.html',
})
export class OnboardingWizardComponent {
  private buttons = inject(ButtonService);
  private router  = inject(Router);

  created   = output<Button>();
  dismissed = output<void>();

  readonly icons  = ICONS;
  readonly colors = COLORS;

  step       = signal<1 | 2 | 3>(1);
  name       = '';
  policy     = 'anyone_with_link';
  icon       = signal('notifications');
  color      = signal('indigo');
  submitting = signal(false);
  error      = signal('');
  createdBtn = signal<Button | null>(null);
  linkCopied = signal(false);

  selectedColor() {
    return COLORS.find(c => c.value === this.color()) ?? COLORS[0];
  }

  nextStep() {
    if (!this.name.trim()) return;
    this.step.set(2);
  }

  back() {
    this.step.set(1);
  }

  async create() {
    if (!this.name.trim() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const btn = await this.buttons.create({
        name:         this.name.trim(),
        slug:         this.buttons.slugify(this.name),
        press_policy: this.policy as Button['press_policy'],
        icon:         this.icon(),
        color:        this.color(),
      });
      this.createdBtn.set(btn);
      this.created.emit(btn);
      this.step.set(3);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al crear el botón');
    } finally {
      this.submitting.set(false);
    }
  }

  get shareUrl(): string {
    const btn = this.createdBtn();
    if (!btn) return '';
    return `${window.location.origin}/button/${btn.slug}`;
  }

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.shareUrl);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch { /* ignore */ }
  }

  goToButton() {
    const btn = this.createdBtn();
    if (btn) this.router.navigate(['/button', btn.slug]);
  }

  dismiss() {
    this.dismissed.emit();
  }
}
