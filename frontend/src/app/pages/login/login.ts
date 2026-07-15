import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;

    this.error.set(null);
    this.loading.set(true);
    const { username, password } = this.form.getRawValue();

    try {
      await this.authService.login(username!, password!);
      this.router.navigate(['/kanbans']);
    } catch {
      this.error.set('Identifiants invalides');
    } finally {
      this.loading.set(false);
    }
  }
}
