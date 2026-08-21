-- Миграция: таблица notifications — уведомления пользователю о трёх
-- событиях (заявка в друзья, назначение задачи, выполнение задачи
-- в общем проекте). "Дедлайн приближается" сюда не входит — это НЕ
-- хранимое событие, оно считается на лету на фронте из задач
-- (см. UrgencyService), в этой таблице для него записей не будет.
-- Применить вручную через psql к уже существующей базе.
--
-- user_id — кому показать уведомление. ON DELETE CASCADE: удалили
-- юзера — удалились и все уведомления, адресованные ему.
--
-- actor_id — кто совершил действие (отправил заявку/назначил задачу/
-- выполнил задачу). ON DELETE SET NULL (не CASCADE): если удалили
-- того, кто это сделал, само уведомление получателю не обязано
-- исчезать вместе с ним — просто потеряет "кто именно".
--
-- task_id/project_id/friendship_id — ссылка на объект уведомления;
-- у каждого type используется свой поднабор (friend_request →
-- только friendship_id; task_assigned/task_completed → task_id +
-- project_id). Все три nullable — ни одно из полей не нужно сразу
-- всем типам. ON DELETE CASCADE у всех трёх: удалили задачу, проект
-- или заявку — уведомление про неё теряет смысл и уходит вместе с ней,
-- а не остаётся висеть на несуществующий id (тот же принцип, что и
-- у cascade-связей в остальной схеме — см. миграцию 011).
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL, -- 'friend_request' | 'task_assigned' | 'task_completed'
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  task_id       TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  project_id    TEXT REFERENCES projects(id) ON DELETE CASCADE,
  friendship_id TEXT REFERENCES friendships(id) ON DELETE CASCADE,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- Единственный способ, которым мы читаем эту таблицу (GET /notifications) —
-- "мои, непрочитанные и более новые сверху", то есть всегда WHERE user_id = ...
-- ORDER BY is_read, created_at DESC. Индекс построен ровно под этот запрос.
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);
