import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Раньше пускали по одному факту наличия 'user' в localStorage — но
  // теперь запросы к защищённым маршрутам требуют токен, а не сам факт
  // "юзер когда-то залогинился". Проверяем именно наличие token: без
  // него все дальнейшие запросы всё равно получат 401 от сервера.
  if (authService.isLoggedIn() && authService.getToken()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};