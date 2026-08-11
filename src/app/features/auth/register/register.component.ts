import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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

    this.authService.isEmailTaken(this.email).subscribe({
      next: (taken) => {
        if (taken) {
          this.errorMessage = 'An account with this email already exists. Please sign in or use a different email.';
          this.isChecking = false;
          return;
        }
        this.authService.register(this.name, this.email, this.password).subscribe({
          next: () => this.router.navigate(['/login']),
          error: () => {
            this.errorMessage = 'Registration failed. Try again.';
            this.isChecking = false;
          }
        });
      },
      error: () => {
        this.errorMessage = 'Could not verify email. Check your connection and try again.';
        this.isChecking = false;
      }
    });
  }
}
