import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  errorMessage = '';
  isChecking = false;

  constructor(private authService: AuthService, private router: Router) {}

  onRegister() {
    if (!this.name || !this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }

    this.isChecking = true;
    this.errorMessage = '';

    // Проверку "email уже занят" раньше делали заранее через GET /users —
    // но этот маршрут защищён токеном, а до регистрации токена ещё нет
    // (это и вызывало "Could not verify email"). Теперь просто шлём
    // POST /users — сервер сам проверяет уникальность email на уровне
    // базы и в случае конфликта отвечает 409.
    this.authService.register(this.name, this.email, this.password).subscribe({
      next: () => {
        this.isChecking = false;
        this.router.navigate(['/login']);
      },
      error: (err: HttpErrorResponse) => {
        this.isChecking = false;
        if (err.status === 409) {
          this.errorMessage = 'Этот email уже занят';
        } else {
          this.errorMessage = 'Registration failed. Try again.';
        }
      }
    });
  }
}
