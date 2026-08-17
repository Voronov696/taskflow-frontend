-- Миграция: удаление проекта должно каскадно удалять его задачи и
-- участников, а не отвязывать их (ON DELETE SET NULL).
-- Применить вручную через psql к уже существующей базе.
--
-- БАГ, который чиним: tasks.project_id и members.project_id объявлены в
-- schema.sql с ON DELETE SET NULL (см. исходное определение таблиц —
-- ещё с миграции на PostgreSQL). Из-за этого DELETE /projects/:id не
-- удаляет задачи и участников проекта, а молча отвязывает их — задачи
-- становятся "ничьими" (project_id = NULL), но остаются висеть у своих
-- исполнителей в Мои задачи/дашборде НАВСЕГДА, хотя проекта, которому
-- они принадлежали, больше не существует.
--
-- Имена constraint'ов ниже — стандартные автосгенерированные Postgres-имена
-- вида "<таблица>_<колонка>_fkey" (schema.sql объявляет REFERENCES инлайном,
-- без CONSTRAINT ... с явным именем, поэтому Postgres называет их так сам).
-- Перед применением стоит свериться командой \d tasks / \d members в psql —
-- если имена отличаются (например, constraint когда-то пересоздавали
-- вручную под другим именем), DROP CONSTRAINT ниже упадёт с понятной
-- ошибкой "constraint ... does not exist", и тогда нужно подставить
-- реальное имя из \d.

-- ── tasks.project_id: SET NULL → CASCADE ────────────────────────────────
ALTER TABLE tasks
  DROP CONSTRAINT tasks_project_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- ── members.project_id: тоже SET NULL → CASCADE ─────────────────────────
-- Та же проблема ровно того же рода: без этого при удалении проекта
-- в members остаются строки-сироты (project_id = NULL, user_id — жив).
-- Раз задачи проекта теперь удаляются каскадно, участие в удалённом
-- проекте тем более не должно переживать сам проект.
ALTER TABLE members
  DROP CONSTRAINT members_project_id_fkey;

ALTER TABLE members
  ADD CONSTRAINT members_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
