import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonService } from '../../core/button.service';

@Component({
  selector: 'app-create',
  imports: [FormsModule, RouterLink],
  templateUrl: './create.html',
})
export class Create {
  private buttons = inject(ButtonService);
  private router  = inject(Router);

  name        = '';
  description = '';
  slug        = '';
  policy      = 'anyone_with_link';
  submitting  = signal(false);
  error       = signal('');

  onNameChange() {
    this.slug = this.buttons.slugify(this.name);
  }

  async submit() {
    if (!this.name.trim() || !this.slug.trim()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const btn = await this.buttons.create({
        name:         this.name.trim(),
        description:  this.description.trim() || undefined,
        slug:         this.slug.trim(),
        press_policy: this.policy as any,
      });
      this.router.navigate(['/button', btn.slug]);
    } catch (e: any) {
      this.error.set(e.message ?? 'Error al crear el botón');
    } finally {
      this.submitting.set(false);
    }
  }
}
