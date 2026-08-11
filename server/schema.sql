-- Схема базы данных taskflow.
-- Файл написан так, чтобы его можно было запускать многократно —
-- везде используется IF NOT EXISTS, повторный запуск не выдаст ошибку
-- и не тронет уже существующие таблицы.
--
-- Порядок таблиц важен: сначала users (ни от кого не зависит),
-- потом projects (зависит от users через owner_id),
-- потом tasks и members (зависят от users и projects).
-- Так PostgreSQL сможет сразу проверить внешние ключи при создании таблицы.

-- ===================== USERS =====================
-- Пользователи приложения. Ни от кого не зависит.
CREATE TABLE IF NOT EXISTS users (
  id       TEXT PRIMARY KEY,      -- nanoid-строка, как в db.json
  name     TEXT NOT NULL,
  email    TEXT NOT NULL UNIQUE,  -- на один email — только один аккаунт
  password TEXT NOT NULL
);

-- ===================== PROJECTS =====================
-- Проекты. У каждого проекта есть владелец (owner_id → users.id).
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date    DATE,                -- в db.json поле есть не у всех проектов → допускаем NULL
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active' -- 'active' | 'paused' | 'completed', см. project.model.ts
);

-- ===================== TASKS =====================
-- Задачи. Могут быть "ничьи" и по проекту (project_id = null), и по
-- исполнителю (assigned_user_id = null) — задачу можно создать без
-- назначенного пользователя. ON DELETE SET NULL у assigned_user_id:
-- при удалении юзера его задачи не удаляются, а просто отвязываются.
CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  status           TEXT NOT NULL,
  project_id       TEXT REFERENCES projects(id) ON DELETE SET NULL,
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  completed_at     DATE                       -- дата перехода в 'done', NULL пока не завершена
);

-- ===================== MEMBERS =====================
-- Участие пользователя в проекте (кто в каком проекте состоит и в какой роли).
-- project_id тоже бывает null в db.json — допускаем NULL.
CREATE TABLE IF NOT EXISTS members (
  id         TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL
);

-- ===================== FRIENDSHIPS =====================
-- Дружба между пользователями. Одна строка = одна связь; направление
-- хранится (user_id — инициатор, friend_id — кого добавили), но фронт
-- (friendship.service.ts) трактует дружбу как симметричную и сам
-- проверяет обе стороны.
CREATE TABLE IF NOT EXISTS friendships (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
