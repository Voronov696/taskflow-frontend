import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router, private translate: TranslateService) {}

  onLogin() {
    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        if (user) {
          this.router.navigate(['/app/dashboard']);
        } else {
          this.errorMessage = this.translate.instant('auth.login.errors.wrongCredentials');
        }
      },
      error: () => {
        this.errorMessage = this.translate.instant('auth.login.errors.generic');
      }
    });
  }
}