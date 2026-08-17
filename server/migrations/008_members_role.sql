-- Миграция: DEFAULT для members.role.
--
-- ВАЖНО: в исходном ТЗ этой миграции было "ALTER TABLE members ADD
-- COLUMN role TEXT NOT NULL DEFAULT 'member'" — но столбец role в
-- members существует с самого начала (см. schema.sql, исходное
-- определение таблицы members ещё с миграции на PostgreSQL), просто
-- без DEFAULT. ADD COLUMN на уже существующий столбец упал бы с
-- ошибкой "column "role" of relation "members" already exists".
-- Ниже — исправленный вариант: ALTER COLUMN ... SET DEFAULT на
-- существующий столбец, а не ADD COLUMN.
--
-- Сам DEFAULT сейчас не критичен для Части 1 — новые автоматические
-- INSERT'ы в members (владелец при создании проекта, исполнитель при
-- назначении задачи, см. server.js) везде указывают role явно. DEFAULT
-- подстраховывает на будущее (Часть 2 и любые прямые INSERT без role).
-- Применить вручную через psql к уже существующей базе.

ALTER TABLE members
  ALTER COLUMN role SET DEFAULT 'member';
