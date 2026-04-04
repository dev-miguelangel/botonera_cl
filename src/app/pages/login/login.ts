import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private auth = inject(AuthService);
  loading = false;

  async loginWithGoogle() {
    this.loading = true;
    await this.auth.loginWithGoogle();
  }
}
