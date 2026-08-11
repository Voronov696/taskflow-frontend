// Middleware проверки JWT — стоит перед "настоящим" обработчиком маршрута
// и решает, пускать ли запрос дальше (см. пояснение про поток запроса в чате).
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Ожидаемый формат заголовка: "Authorization: Bearer <token>".
  // Интерцептор на фронте (см. предыдущий шаг) уже добавляет его сам,
  // если в localStorage есть token.
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    // Токена нет вообще — запрос анонимный, это 401 (не авторизован).
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  // process.env.JWT_SECRET читаем здесь, а не один раз в константу при
  // старте модуля — так порядок require('./middleware/auth') относительно
  // dotenv.config() в server.js не важен: секрет читается в момент запроса,
  // когда .env уже точно загружен.
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      // И невалидная подпись (токен подделан/подписан другим секретом),
      // и истёкший срок (exp) — это ошибка того же рода: предъявленный
      // токен не даёт права называться авторизованным пользователем.
      // Используем тот же 401, что и для "токена нет вообще" — 403 в
      // этом файле оставляем за проверкой владения (см. server.js),
      // где личность уже подтверждена, но действие запрещено для НЕЁ.
      return res.status(401).json({ error: 'Токен недействителен или истёк' });
    }
    // payload — это то, что мы сами положили в jwt.sign при логине:
    // { id, email, iat, exp }. Кладём его в req.user, чтобы обработчик
    // маршрута ниже мог посмотреть, кто именно сделал запрос.
    req.user = payload;
    next();
  });
}

module.exports = { authenticateToken };
