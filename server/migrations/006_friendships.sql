-- Миграция: новая таблица friendships (её раньше не было — фронт слал
-- запросы к /friendships, получал 404, друзья не работали).
-- Применить вручную через psql к уже существующей базе.
--
-- По структуре — как members: одна строка = одна связь. Направление
-- хранится (user_id — кто добавил, friend_id — кого добавили), но
-- фронт (friendship.service.ts, areFriends()/removeFriend()) считает
-- дружбу симметричной — проверяет обе стороны сам, поэтому отдельного
-- статуса "подтверждено"/"ожидает" в таблице нет, как и на фронте.
-- ON DELETE CASCADE у обеих ссылок: при удалении пользователя все его
-- записи о дружбе (в любом направлении) удаляются вместе с ним, а не
-- остаются "висеть" на несуществующий user_id/friend_id.

CREATE TABLE IF NOT EXISTS friendships (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
