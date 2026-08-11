-- Миграция: assigned_user_id в tasks становится необязательным.
-- Применить вручную через psql к уже существующей базе (schema.sql
-- этого не сделает — CREATE TABLE IF NOT EXISTS не трогает существующие
-- таблицы).

-- 1) Снимаем NOT NULL с assigned_user_id — теперь можно создавать задачи
--    без исполнителя (NULL).
ALTER TABLE tasks
  ALTER COLUMN assigned_user_id DROP NOT NULL;

-- 2) Пересоздаём внешний ключ с ON DELETE SET NULL вместо ON DELETE CASCADE.
--    Postgres не даёт поменять правило ON DELETE у существующего constraint —
--    нужно сначала удалить старый, потом создать новый с тем же именем
--    (по умолчанию Postgres называет его "tasks_assigned_user_id_fkey").
--    Если у вас имя другое — проверьте командой:
--      \d tasks
--    или запросом:
--      SELECT conname FROM pg_constraint WHERE conrelid = 'tasks'::regclass AND contype = 'f';
ALTER TABLE tasks
  DROP CONSTRAINT tasks_assigned_user_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_user_id_fkey
  FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;
