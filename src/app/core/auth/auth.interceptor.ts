import { HttpInterceptorFn } from '@angular/common/http';

// Функциональный HTTP-интерцептор: Angular пропускает через него КАЖДЫЙ
// исходящий HttpClient-запрос перед тем, как реально отправить его по сети.
// Здесь мы просто дописываем заголовок Authorization, если в localStorage
// есть токен — сами запросы (URL, метод, тело) не трогаем.
//
// Токен читаем прямо из localStorage, а не через AuthService, чтобы не
// плодить циклическую зависимость (интерцептор — это тоже часть DI, а
// AuthService и так уже внедряет HttpClient).
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  // Если токена нет (например, ещё не логинились — как раз случай
  // POST /login и POST /users), просто пропускаем запрос как есть,
  // без заголовка.
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
  return next(authReq);
};
