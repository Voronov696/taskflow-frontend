// dotenv.config() читает server/.env и кладёт его переменные в process.env.
// Вызываем это самым первым, до всех остальных require — чтобы к моменту,
// когда ниже подключится db.js (а через него — pg), переменные PGHOST,
// PGPASSWORD и т.д. уже были на месте.
require('dotenv').config();

// Подключаем express — фреймворк для создания HTTP-сервера и маршрутов.
const express = require('express');
// Подключаем cors — middleware, разрешающий запросы с других origin
// (наш Angular-фронтенд крутится на другом порту, без cors браузер
// заблокирует запросы политикой Same-Origin).
const cors = require('cors');
// Подключаем встроенный модуль crypto — понадобится для генерации id
// новых записей (см. generateId ниже).
const crypto = require('crypto');
// Подключаем bcrypt — хешируем пароли перед записью в базу и сравниваем
// хеши при входе. Так в базе никогда не лежит открытый пароль: даже если
// база утечёт, из хеша пароль обратно не восстановить.
const bcrypt = require('bcrypt');
// Подключаем jsonwebtoken — им подписываем токен при логине (jwt.sign).
// Проверка токена (jwt.verify) и middleware, который защищает маршруты —
// это следующий шаг, пока только выдаём токен.
const jwt = require('jsonwebtoken');
// Подключаем нашу функцию query из db.js — через неё маршруты users
// теперь ходят в PostgreSQL вместо db.json.
const { query } = require('./db');
// Подключаем middleware проверки JWT — им защищаем все маршруты, кроме
// логина и регистрации (см. расстановку app.get/post/put/delete ниже).
const { authenticateToken } = require('./middleware/auth');

// Создаём экземпляр приложения express — это и есть наш сервер.
const app = express();
// Порт, на котором сервер будет слушать запросы (совпадает с тем,
// что раньше использовал json-server, чтобы фронтенд ничего не заметил).
const PORT = 3000;

// Секрет, которым подписываются JWT (jwt.sign) и проверяется подпись
// (jwt.verify) — читается из .env, а не хранится в коде (см. пояснение
// в чате про то, почему). Никакого fallback-значения по умолчанию
// намеренно нет: если JWT_SECRET не задан в .env, пусть сервер падает
// с понятной ошибкой при первом же логине, а не тихо подписывает токены
// известной всем строкой.
const JWT_SECRET = process.env.JWT_SECRET;

// Число "раундов" соли для bcrypt — влияет на то, сколько раз данные
// прогоняются через алгоритм и, соответственно, насколько дорого (по
// времени CPU) вычислить один хеш. 10 — стандартный баланс bcrypt между
// безопасностью и скоростью ответа сервера.
const SALT_ROUNDS = 10;

// Подключаем middleware cors() — он добавляет нужные заголовки
// (Access-Control-Allow-Origin и т.д.) ко всем ответам сервера.
app.use(cors());
// Подключаем встроенный middleware express.json() — он разбирает
// тело входящих запросов в формате JSON и кладёт результат в req.body.
// Пока POST/PUT не пишем, но это понадобится на следующих шагах.
app.use(express.json());

// Функция превращает "пустое" значение поля из body в null.
// Используется для необязательных внешних ключей (projectId, assignedUserId,
// userId и т.п.): если фронт прислал undefined, null или пустую строку ''
// (например, из пустого <select>), в базу должен уйти именно NULL —
// а не '', потому что '' не совпадает ни с одним реальным id и нарушит
// внешний ключ (FOREIGN KEY), вместо того чтобы значить "не назначено".
function emptyToNull(value) {
  return value === undefined || value === null || value === '' ? null : value;
}

// Функция генерации id для новых записей.
// В существующих данных id выглядят как короткие строки из 11 символов
// вида "kTcn0xkjGnA" — это формат nanoid (алфавит A-Z, a-z, 0-9, "-", "_").
// Ставить зависимость nanoid ради этого не стали — Node умеет то же самое
// встроенными средствами: crypto.randomBytes даёт случайные байты,
// а .toString('base64url') кодирует их ровно в этот алфавит.
// 8 байт в base64url дают 11 символов — то же, что и у существующих id.
function generateId() {
  return crypto.randomBytes(8).toString('base64url');
}

// Функция строит часть "WHERE ..." SQL-запроса из req.query.
//
// columnMap — объект вида { camelCaseИмяВQuery: 'snake_case_имя_в_базе' },
// например { ownerId: 'owner_id' }. Раньше (на шаге с users) здесь был
// просто массив разрешённых имён, потому что у users query-параметры
// и столбцы в базе совпадают буквально. У projects/tasks/members это уже
// не так (ownerId → owner_id и т.д.), поэтому функция стала чуть умнее:
// теперь она не только проверяет ключ по белому списку, но и переводит
// его в реальное имя столбца.
//
// ВАЖНО про безопасность: значения ($1, $2, ...) параметризуются и pg
// подставляет их безопасно (см. объяснение про SQL-инъекции в предыдущем
// шаге), но имена СТОЛБЦОВ так подставить нельзя — плейсхолдер $1 работает
// только для значений, а не для идентификаторов (имён столбцов/таблиц).
// А ключи req.query — это то, что прислал клиент в URL, то есть
// НЕДОВЕРЕННЫЕ данные. Поэтому в SQL мы подставляем не сам key из URL,
// а columnMap[key] — имя столбца, которое мы сами захардкодили в коде.
// Если клиент пришлёт незнакомый параметр (его нет в columnMap) — он
// просто игнорируется, а не попадает в SQL.
function buildWhereClause(query, columnMap) {
  const filterKeys = Object.keys(query).filter((key) =>
    Object.prototype.hasOwnProperty.call(columnMap, key)
  );
  if (filterKeys.length === 0) {
    return { whereSql: '', params: [] };
  }
  const params = filterKeys.map((key) => query[key]);
  // columnMap[key] — доверенное имя столбца из нашего же кода, не из URL.
  const conditions = filterKeys.map((key, i) => `${columnMap[key]} = $${i + 1}`);
  return { whereSql: ` WHERE ${conditions.join(' AND ')}`, params };
}

// Функция строит часть "SET ..." для частичного UPDATE (используется
// в PATCH /tasks/:id) — тот же принцип белого списка + маппинга
// camelCase → snake_case, что и в buildWhereClause, только для полей,
// которые пришли в body, а не в query.
function buildSetClause(body, columnMap) {
  const keys = Object.keys(body).filter((key) =>
    Object.prototype.hasOwnProperty.call(columnMap, key)
  );
  const params = keys.map((key) => body[key]);
  const assignments = keys.map((key, i) => `${columnMap[key]} = $${i + 1}`);
  return { setSql: assignments.join(', '), params };
}

// Столбцы таблицы users, по которым разрешена фильтрация через query.
// У users имена в query и в базе совпадают буквально (id, name, email,
// password), поэтому маппинг здесь "тождественный".
const USER_COLUMNS = { id: 'id', name: 'name', email: 'email', password: 'password' };

// GET /users — теперь читаем не db.json, а таблицу users в PostgreSQL.
// Маршрут стал асинхронным (async), потому что query() обращается к базе
// по сети и возвращает Promise — результат приходит не сразу, поэтому
// его нужно дождаться через await.
app.get('/users', authenticateToken, async (req, res) => {
  try {
    const { whereSql, params } = buildWhereClause(req.query, USER_COLUMNS);
    const result = await query(`SELECT id, name, email FROM users${whereSql}`, params);
    // pg возвращает объект результата, сами строки лежат в result.rows.
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить пользователей' });
  }
});

// GET /users/:id — один пользователь по id.
app.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email FROM users WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить пользователя' });
  }
});

// ===================== PROJECTS: столбцы и SELECT =====================

// columnMap для projects без id — используется при INSERT (маппинг
// camelCase из body → snake_case столбцы). PROJECT_FILTER_COLUMNS ниже —
// то же самое, но с добавленным id, для фильтрации по query (там id тоже
// осмысленный параметр, например GET /projects?id=X).
const PROJECT_COLUMNS = {
  name: 'name',
  description: 'description',
  dueDate: 'due_date',
  ownerId: 'owner_id',
  status: 'status',
};
const PROJECT_FILTER_COLUMNS = { id: 'id', ...PROJECT_COLUMNS };

// Список столбцов с алиасами — превращает snake_case базы в camelCase,
// который ждёт фронт. Собран в константу, чтобы не дублировать в каждом
// запросе к projects.
const PROJECTS_SELECT = `id, name, description, due_date AS "dueDate", owner_id AS "ownerId", status`;

// GET /projects — поддерживает, например, GET /projects?ownerId=X —
// тогда останутся только проекты этого владельца.
app.get('/projects', authenticateToken, async (req, res) => {
  try {
    const { whereSql, params } = buildWhereClause(req.query, PROJECT_FILTER_COLUMNS);
    const result = await query(`SELECT ${PROJECTS_SELECT} FROM projects${whereSql}`, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить проекты' });
  }
});

// GET /projects/:id — отдаём один проект по id.
// ":id" в пути — это именованный параметр маршрута. Express разбирает
// URL и кладёт значение, которое стоит на месте ":id", в req.params.id.
app.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`SELECT ${PROJECTS_SELECT} FROM projects WHERE id = $1`, [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить проект' });
  }
});

// ===================== TASKS: столбцы и SELECT =====================

const TASK_COLUMNS = {
  title: 'title',
  description: 'description',
  status: 'status',
  projectId: 'project_id',
  assignedUserId: 'assigned_user_id',
  completedAt: 'completed_at',
};
const TASK_FILTER_COLUMNS = { id: 'id', ...TASK_COLUMNS };

const TASKS_SELECT = `id, title, description, status, project_id AS "projectId", assigned_user_id AS "assignedUserId", completed_at AS "completedAt"`;

// GET /tasks — поддерживает GET /tasks?projectId=X (задачи проекта) и
// GET /tasks?assignedUserId=X (задачи конкретного пользователя), а также
// их сочетание — buildWhereClause соединяет условия через AND.
app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const { whereSql, params } = buildWhereClause(req.query, TASK_FILTER_COLUMNS);
    const result = await query(`SELECT ${TASKS_SELECT} FROM tasks${whereSql}`, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить задачи' });
  }
});

// GET /tasks/:id — отдаём одну задачу по id.
app.get('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(`SELECT ${TASKS_SELECT} FROM tasks WHERE id = $1`, [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить задачу' });
  }
});

// ===================== MEMBERS: столбцы и SELECT =====================

const MEMBER_COLUMNS = {
  projectId: 'project_id',
  userId: 'user_id',
  role: 'role',
};
const MEMBER_FILTER_COLUMNS = { id: 'id', ...MEMBER_COLUMNS };

const MEMBERS_SELECT = `id, project_id AS "projectId", user_id AS "userId", role`;

// GET /members — поддерживает GET /members?projectId=X (участники проекта)
// и GET /members?userId=X (записи участия конкретного юзера).
app.get('/members', authenticateToken, async (req, res) => {
  try {
    const { whereSql, params } = buildWhereClause(req.query, MEMBER_FILTER_COLUMNS);
    const result = await query(`SELECT ${MEMBERS_SELECT} FROM members${whereSql}`, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось получить участников' });
  }
});

// ===================== USERS: запись (PostgreSQL) =====================

// POST /users — создать нового юзера.
app.post('/users', async (req, res) => {
  try {
    // bcrypt.hash сам генерирует случайную соль (см. пояснение про соль
    // в чате) и встраивает её в итоговую строку хеша — отдельно хранить
    // соль не нужно, bcrypt.compare потом достанет её оттуда же.
    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
    // id генерируем сами, тем же способом, что и раньше — так формат
    // id не меняется, и фронту не нужно ничего переделывать.
    const newUser = {
      id: generateId(),
      name: req.body.name,
      email: req.body.email,
      password: passwordHash,
    };
    // Параметризованный запрос: вместо того чтобы вклеивать значения
    // в текст SQL через `+` или шаблонную строку, мы пишем плейсхолдеры
    // $1, $2, $3, $4, а сами значения передаём отдельным массивом.
    // pg отправляет текст запроса и значения в базу РАЗДЕЛЬНО — база
    // воспринимает $1..$4 как "дырки под данные", а не как часть SQL-кода,
    // поэтому что бы ни лежало в newUser.name (хоть "'; DROP TABLE users; --"),
    // оно никогда не будет исполнено как SQL, а останется просто текстом
    // в столбце name. Это и есть защита от SQL-инъекций.
    // RETURNING перечисляет только id, name, email — без password, поэтому
    // хеш даже не попадёт в JS-объект результата, не то что в ответ клиенту.
    const result = await query(
      'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [newUser.id, newUser.name, newUser.email, newUser.password]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // '23505' — код ошибки PostgreSQL "unique_violation": сработал
    // UNIQUE-constraint (у нас — users_email_unique из schema.sql /
    // миграции 003). Это ожидаемая ситуация ("такой email уже есть"),
    // а не сбой сервера, поэтому ловим её отдельно и отвечаем 409
    // (Conflict) с понятным сообщением, а не падаем в общий 500.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Этот email уже занят' });
    }
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать пользователя' });
  }
});

// POST /login — вход по email + паролю. Раньше фронт делал GET /users и
// искал совпадение на клиенте — это означало, что ВСЕ пароли (а раньше —
// открытым текстом) уходили в браузер каждому, кто дернёт GET /users.
// Теперь сравнение пароля происходит только на сервере, наружу уходит
// либо профиль без password, либо общая ошибка 401.
app.post('/login', async (req, res) => {
  // Общее сообщение об ошибке — намеренно одно и то же и для "нет такого
  // email", и для "неверный пароль" (см. пояснение в чате про то, почему
  // их нельзя различать в ответе).
  const INVALID_CREDENTIALS = { error: 'Неверный email или пароль' };
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }
    const result = await query('SELECT id, name, email, password FROM users WHERE email = $1', [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }
    const user = result.rows[0];
    // bcrypt.compare сам вытаскивает соль из user.password (она хранится
    // внутри строки хеша) и хеширует введённый пароль с той же солью,
    // прежде чем сравнить результаты.
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json(INVALID_CREDENTIALS);
    }
    // payload — то, что будет "внутри" токена (см. пояснение в чате). Кладём
    // только id и email — этого достаточно, чтобы на будущем защищённом
    // маршруте понять, кто стучится, не читая пароль и вообще не трогая
    // базу лишний раз. jwt.sign сам добавит в payload ещё iat (когда токен
    // выдан) и exp (когда истекает, из expiresIn).
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });
    // Явно собираем объект без password, а не "result.rows[0], но без
    // одного поля" — так исключить password из ответа нельзя забыть.
    const userWithoutPassword = { id: user.id, name: user.name, email: user.email };
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось выполнить вход' });
  }
});

// PUT /users/:id — полностью заменить юзера по id.
app.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    // req.user.id — это id из ПОДПИСАННОГО токена, ему можно доверять
    // (см. authenticateToken). req.params.id — то, что просто стоит в URL,
    // его прислал клиент и подделать может кто угодно. Если они не
    // совпадают — залогиненный юзер пытается изменить чужой аккаунт.
    // Без этой проверки любой залогиненный (с ЛЮБЫМ валидным токеном)
    // мог бы поставить в URL чужой id и переписать чужие имя/email/пароль —
    // токен доказывает только "кто-то авторизован", а не "именно на этот id".
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Нельзя изменять чужой аккаунт' });
    }

    // Отличаем "пароль меняют" от "пароль не трогают" через 'password' in
    // req.body — проверяем, что КЛЮЧ вообще есть в теле запроса, а не то,
    // что в нём "истинное" значение. Если проверять просто req.body.password
    // (без in), это по ошибке сработало бы одинаково что для отсутствующего
    // поля, что для пустой строки — а нам нужно различать именно "поле не
    // прислали" (значит, юзер меняет только имя/email — пароль не трогаем)
    // от "поле прислали" (значит, юзер осознанно меняет пароль на новое
    // значение — его и хешируем). Тот же приём уже использовался в
    // PATCH /tasks/:id для assignedUserId/projectId.
    const passwordProvided = 'password' in req.body;

    // id берём из URL (req.params.id), а не из body — как и раньше,
    // чтобы его нельзя было подменить через тело запроса.
    let setSql = 'name = $1, email = $2';
    const params = [req.body.name, req.body.email];

    if (passwordProvided) {
      // Хешируем новый пароль так же, как при регистрации — bcrypt сам
      // сгенерирует свежую соль для этого хеша.
      const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      setSql += `, password = $${params.length + 1}`;
      params.push(passwordHash);
    }
    // Если passwordProvided === false, столбец password вообще не попадает
    // в SET — существующий хеш в базе остаётся как есть, ни хешировать
    // undefined, ни затирать пароль пустотой не приходится.

    params.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${setSql} WHERE id = $${params.length} RETURNING id, name, email`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить пользователя' });
  }
});

// PUT /users/:id/password — смена пароля из настроек. В отличие от обычного
// PUT /users/:id (там пароль просто перезаписывается, если прислали), здесь
// сначала нужно ДОКАЗАТЬ, что вызывающий знает текущий пароль — иначе смена
// пароля превращается в способ увести чужой аккаунт, просто зная его id.
// Раньше это "доказательство" (сравнение currentPassword) проверялось на
// фронте против password, лежавшего в объекте юзера в localStorage — но
// теперь пароль туда не попадает вообще (см. POST /login), да и сравнивать
// пароль на клиенте в принципе небезопасно: открытый пароль пришлось бы
// хранить в браузере. Поэтому сравнение переехало на сервер, через
// bcrypt.compare с уже сохранённым хешем.
//
// Теперь, когда есть authenticateToken, добавляем и вторую проверку —
// req.user.id === req.params.id: одного только знания currentPassword
// недостаточно, если бы кто угодно с ЛЮБЫМ валидным токеном мог прислать
// сюда чужой id и подбирать currentPassword чужого аккаунта. Обе проверки
// вместе: "ты залогинен КАК этот юзер" (middleware) И "ты знаешь его
// текущий пароль" (bcrypt.compare ниже).
app.put('/users/:id/password', authenticateToken, async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Нельзя менять чужой пароль' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Нужно указать текущий и новый пароль' });
    }

    const existing = await query('SELECT password FROM users WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, existing.rows[0].password);
    if (!passwordMatches) {
      // Тут, в отличие от /login, уточнять ошибку можно: id уже известен
      // (пришёл в URL от залогиненного юзера), это не попытка узнать,
      // существует ли такой email — enumeration тут ничего не даёт.
      return res.status(401).json({ error: 'Текущий пароль неверен' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const result = await query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, email',
      [newPasswordHash, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось сменить пароль' });
  }
});

// DELETE /users/:id — удалить юзера по id.
app.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    // Та же проверка владельца, что и в PUT /users/:id — иначе любой
    // залогиненный юзер мог бы удалить чужой аккаунт, просто подставив
    // чужой id в URL.
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Нельзя удалить чужой аккаунт' });
    }

    // RETURNING id тут нужен не сам по себе, а чтобы узнать, была ли вообще
    // удалена строка — если id не существовал, result.rows будет пустым.
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    // json-server в ответ на DELETE отдавал пустой объект — повторяем
    // это поведение, чтобы фронтенд, который так уже привык, не сломался.
    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить пользователя' });
  }
});

// ===================== PROJECTS: запись (PostgreSQL) =====================

// POST /projects — создать новый проект.
app.post('/projects', authenticateToken, async (req, res) => {
  try {
    // Пример маппинга camelCase (req.body) → snake_case (столбцы базы):
    // фронт присылает { name, description, dueDate, ownerId }, а колонки
    // в базе называются name, description, due_date, owner_id.
    // Явно читаем нужные поля из body (а не кладём req.body целиком) —
    // это заодно защищает от "лишних" полей, которых нет в таблице.
    const newProject = {
      id: generateId(),
      name: req.body.name,
      description: req.body.description,
      dueDate: req.body.dueDate ?? null, // необязательное поле, как и в схеме
      ownerId: req.body.ownerId,
      // Если фронт не прислал status явно — берём тот же 'active', что
      // и DEFAULT в схеме таблицы (см. schema.sql / миграцию 004).
      // Задаём его и здесь, а не полагаемся только на DEFAULT в базе,
      // чтобы RETURNING сразу вернул корректное значение независимо
      // от того, меняли схему или нет.
      status: req.body.status ?? 'active',
    };
    const result = await query(
      `INSERT INTO projects (id, name, description, due_date, owner_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${PROJECTS_SELECT}`,
      [newProject.id, newProject.name, newProject.description, newProject.dueDate, newProject.ownerId, newProject.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать проект' });
  }
});

// PATCH /projects/:id — частично обновить проект (например, только status
// для паузы/возобновления — project-list.component.ts, pauseProject()/
// unpauseProject()). Устроен так же, как PATCH /tasks/:id: белый список
// PROJECT_COLUMNS + buildSetClause, только известные поля из body попадают
// в SQL.
app.patch('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { setSql, params } = buildSetClause(req.body, PROJECT_COLUMNS);

    if (!setSql) {
      const existing = await query(`SELECT ${PROJECTS_SELECT} FROM projects WHERE id = $1`, [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Проект не найден' });
      }
      return res.json(existing.rows[0]);
    }

    params.push(req.params.id);
    const result = await query(
      `UPDATE projects SET ${setSql} WHERE id = $${params.length} RETURNING ${PROJECTS_SELECT}`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить проект' });
  }
});

// DELETE /projects/:id — удалить проект по id.
app.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить проект' });
  }
});

// ===================== TASKS: запись (PostgreSQL) =====================

// POST /tasks — создать новую задачу.
app.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const newTask = {
      id: generateId(),
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      projectId: emptyToNull(req.body.projectId), // задача может быть без проекта
      assignedUserId: emptyToNull(req.body.assignedUserId), // и без исполнителя
      completedAt: emptyToNull(req.body.completedAt), // пусто/не пришло → NULL, не завершена
    };
    const result = await query(
      `INSERT INTO tasks (id, title, description, status, project_id, assigned_user_id, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${TASKS_SELECT}`,
      [
        newTask.id,
        newTask.title,
        newTask.description,
        newTask.status,
        newTask.projectId,
        newTask.assignedUserId,
        newTask.completedAt,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать задачу' });
  }
});

// PATCH /tasks/:id — частично обновить задачу (например, только status).
app.patch('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    // Перед buildSetClause нормализуем assignedUserId/projectId: если поле
    // ПРИСУТСТВУЕТ в body, но пришло пустой строкой (например, фронт снял
    // исполнителя через пустой <select>), в базу должен уйти NULL, а не '' —
    // иначе упрёмся в тот же FK, что и в POST /tasks. Проверяем "in", а не
    // просто читаем поле, чтобы не задеть партийность PATCH: если поля вовсе
    // не было в body, оно и не должно появиться здесь (buildSetClause сам
    // отфильтрует то, чего нет).
    const patchBody = { ...req.body };
    if ('assignedUserId' in patchBody) {
      patchBody.assignedUserId = emptyToNull(patchBody.assignedUserId);
    }
    if ('projectId' in patchBody) {
      patchBody.projectId = emptyToNull(patchBody.projectId);
    }
    if ('completedAt' in patchBody) {
      patchBody.completedAt = emptyToNull(patchBody.completedAt);
    }

    // buildSetClause берёт из patchBody только те поля, что есть в
    // TASK_COLUMNS (белый список), и переводит их в snake_case столбцы —
    // если прислали { status: 'done' }, остальные столбцы в SQL не попадут
    // и, соответственно, не изменятся.
    const { setSql, params } = buildSetClause(patchBody, TASK_COLUMNS);

    // Если в body не было ни одного известного поля — обновлять нечего,
    // SQL с пустым SET был бы синтаксически неверным. Просто возвращаем
    // задачу как есть (или 404, если её не существует).
    if (!setSql) {
      const existing = await query(`SELECT ${TASKS_SELECT} FROM tasks WHERE id = $1`, [
        req.params.id,
      ]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Задача не найдена' });
      }
      return res.json(existing.rows[0]);
    }

    // id задачи (из URL) добавляем последним параметром — под него
    // отведён плейсхолдер $N, где N — следующий свободный номер после
    // параметров из setSql.
    params.push(req.params.id);
    const result = await query(
      `UPDATE tasks SET ${setSql} WHERE id = $${params.length} RETURNING ${TASKS_SELECT}`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить задачу' });
  }
});

// DELETE /tasks/:id — удалить задачу по id.
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить задачу' });
  }
});

// ===================== MEMBERS: запись (PostgreSQL) =====================

// POST /members — создать нового участника.
app.post('/members', authenticateToken, async (req, res) => {
  try {
    const newMember = {
      id: generateId(),
      projectId: emptyToNull(req.body.projectId), // как и в схеме, участие может быть без проекта
      userId: emptyToNull(req.body.userId),
      role: req.body.role,
    };
    const result = await query(
      `INSERT INTO members (id, project_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${MEMBERS_SELECT}`,
      [newMember.id, newMember.projectId, newMember.userId, newMember.role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать участника' });
  }
});

// DELETE /members/:id — удалить участника по id.
app.delete('/members/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM members WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Участник не найден' });
    }
    res.json({});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить участника' });
  }
});

// Запускаем сервер — он начинает слушать входящие соединения на PORT.
// Второй аргумент — callback, который выполнится после успешного запуска.
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
