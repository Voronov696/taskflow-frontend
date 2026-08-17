-- Миграция: гарантируем, что projects.due_date допускает NULL.
-- Применить вручную через psql к уже существующей базе.
--
-- В schema.sql колонка due_date у projects всегда объявлена без NOT NULL
-- (см. "due_date DATE," — без модификатора). Но schema.sql — это файл
-- для СВЕЖЕЙ базы (CREATE TABLE IF NOT EXISTS), он не гарантирует, что
-- constraint не был добавлен позже вручную на уже существующей базе.
-- Эта миграция — защитная: ALTER COLUMN ... DROP NOT NULL безопасно
-- выполнить и на колонке, где NOT NULL и так не было — Postgres просто
-- не найдёт constraint для удаления и ничего не сломает.
--
-- Нужно для того, чтобы дата окончания ПРОЕКТА была настоящим необязательным
-- полем: проект можно создать и хранить вообще без срока (см. также
-- POST/PATCH /projects в server.js — там теперь пустая/непришедшая dueDate
-- превращается в NULL через emptyToNull, а не падает как невалидная DATE).

ALTER TABLE projects
  ALTER COLUMN due_date DROP NOT NULL;
