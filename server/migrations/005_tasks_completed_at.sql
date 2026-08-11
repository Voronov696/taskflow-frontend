-- Миграция: добавляем completed_at в tasks.
-- Применить вручную через psql к уже существующей базе (schema.sql
-- этого не сделает — CREATE TABLE IF NOT EXISTS не трогает существующие
-- таблицы).
--
-- Без DEFAULT и без NOT NULL — задача не обязана быть завершена, поле
-- заполняется (task.repository.ts, updateStatus()) только когда status
-- переходит в 'done', и очищается обратно в NULL при отмене этого статуса.
-- У уже существующих задач completed_at станет NULL — это и есть
-- корректное значение "ещё/никогда не завершалась".

ALTER TABLE tasks
  ADD COLUMN completed_at DATE;
