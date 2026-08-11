-- Миграция: email в users становится уникальным на уровне базы.
-- Применить вручную через psql к уже существующей базе (schema.sql
-- этого не сделает — CREATE TABLE IF NOT EXISTS не трогает существующие
-- таблицы).
--
-- Если в таблице уже есть два и более пользователя с одинаковым email,
-- ALTER ниже упадёт с ошибкой "could not create unique index... Key
-- (email)=(...) is duplicated" — сначала пришлось бы вручную решить,
-- что делать с дублями (удалить/переименовать один из них), и только
-- потом накатывать эту миграцию. Перед запуском можно проверить дубли:
--   SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;

ALTER TABLE users
  ADD CONSTRAINT users_email_unique UNIQUE (email);
