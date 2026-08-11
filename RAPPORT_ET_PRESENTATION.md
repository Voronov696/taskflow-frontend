# RAPPORT ET PRÉSENTATION — TASKFLOW
### Application Web de Gestion de Projets | Отчёт и Презентация

---

> **Mode d'emploi du fichier :**  
> Chaque section est écrite **deux fois** : d'abord en **🇫🇷 Français** (pour les enseignants et le jury), puis en **🇷🇺 Русский** (pour ta préparation personnelle). Lis les deux colonnes en parallèle avant ta soutenance.

> **Как пользоваться файлом:**  
> Каждый раздел написан **дважды**: сначала на **🇫🇷 французском** (для преподавателей и жюри), затем на **🇷🇺 русском** (для твоей личной подготовки). Читай оба варианта параллельно перед защитой.

---

---

# SECTION 1 — RAPPORT TECHNIQUE ET ARCHITECTURE
# РАЗДЕЛ 1 — ТЕХНИЧЕСКИЙ ОТЧЁТ И АРХИТЕКТУРА

---

## 1.1 Introduction au projet / Введение в проект

---

🇫🇷 **Français**

TaskFlow est une application web de gestion de projets développée en **Angular 19**. Son objectif est simple : permettre à un utilisateur de créer des projets, d'y ajouter des tâches avec des délais, de les assigner à des membres de son équipe, et de suivre la progression globale depuis un tableau de bord central.

L'application va un peu plus loin que le simple gestionnaire de tâches classique : elle intègre un **score de productivité quotidien** appelé "Focus Score", qui calcule en temps réel si l'utilisateur est en train d'atteindre ses objectifs de la journée. Cela rend l'outil à la fois fonctionnel et motivant.

L'interface est entièrement **responsive**, construite avec un thème sombre cohérent, et toutes les couleurs d'accentuation sont contrôlées via une variable CSS globale `--accent`, ce qui permet à l'utilisateur de changer la couleur principale de l'application depuis les paramètres.

---

🇷🇺 **Русский**

TaskFlow — это веб-приложение для управления проектами, разработанное на **Angular 19**. Его цель проста: позволить пользователю создавать проекты, добавлять к ним задачи с дедлайнами, назначать их членам команды и отслеживать общий прогресс с центральной панели управления.

Приложение выходит за рамки обычного менеджера задач: в него встроен **ежедневный показатель продуктивности** под названием "Focus Score", который в реальном времени вычисляет, насколько пользователь выполняет свои планы на день. Это делает инструмент одновременно функциональным и мотивирующим.

Интерфейс полностью **адаптивен**, построен на тёмной теме, а все акцентные цвета управляются через глобальную CSS-переменную `--accent` — это позволяет пользователю менять основной цвет приложения прямо из настроек.

---

## 1.2 Structure et Architecture du Projet / Структура и Архитектура Проекта

---

🇫🇷 **Français**

Le projet suit une architecture modulaire claire, typique des applications Angular de niveau intermédiaire. Le dossier source `src/app/` est divisé en trois grandes zones logiques :

**`core/`** — Le cœur de l'application. C'est ici qu'on trouve les services partagés utilisés partout dans l'app :
- `AuthService` — gère la connexion, la déconnexion et la session utilisateur (via `localStorage`).
- `AuthGuard` — protège les routes privées : si l'utilisateur n'est pas connecté, il est redirigé vers la page de login.
- `DeadlineService` — calcule l'état des délais (`none`, `normal`, `warning`, `expired`) pour chaque tâche en comparant la date courante avec la `dueDate`.
- `FriendshipService` — gère la logique de recherche et d'ajout d'amis/collègues.

**`domain/`** — La couche de données. Elle contient :
- Les **modèles** (interfaces TypeScript) : `Task`, `Project`, `User`, `Friendship`.
- Les **repositories** : des classes de service qui font les appels HTTP vers le backend. Par exemple, `TaskRepository` contient des méthodes comme `getByProject()`, `updateStatus()`, ou `delete()`.

**`features/`** — L'ensemble des pages de l'application, chacune étant un **composant Angular autonome** (standalone) chargé de manière **lazy** (paresseuse) pour optimiser la vitesse de chargement initiale. Les pages disponibles sont :
- **Dashboard** — tableau de bord avec le score Focus, les projets récents et les tâches en attente.
- **Project List** — liste de tous les projets avec filtres et barre de recherche.
- **Project Detail** — détail d'un projet avec création et gestion des tâches en ligne.
- **My Tasks** — toutes les tâches assignées à l'utilisateur connecté.
- **Team** — gestion des collègues/amis avec système de recherche.
- **Settings** — profil utilisateur, couleur d'accentuation et sécurité.
- **Shell** — la structure principale (barre latérale + `router-outlet`).
- **Auth (Login / Register)** — les pages d'authentification.

Le routage est défini dans `app.routes.ts`. Les routes protégées passent par le `authGuard` avant de charger le composant.

---

🇷🇺 **Русский**

Проект следует чёткой модульной архитектуре, типичной для Angular-приложений среднего уровня. Исходная папка `src/app/` разделена на три логические зоны:

**`core/`** — Ядро приложения. Здесь находятся общие сервисы, используемые по всему приложению:
- `AuthService` — управляет входом, выходом и сессией пользователя (через `localStorage`).
- `AuthGuard` — защищает приватные маршруты: если пользователь не авторизован, он перенаправляется на страницу входа.
- `DeadlineService` — вычисляет состояние дедлайнов (`none`, `normal`, `warning`, `expired`) для каждой задачи, сравнивая текущую дату с `dueDate`.
- `FriendshipService` — управляет логикой поиска и добавления друзей/коллег.

**`domain/`** — Слой данных. Здесь находятся:
- **Модели** (TypeScript-интерфейсы): `Task`, `Project`, `User`, `Friendship`.
- **Репозитории**: сервисные классы, выполняющие HTTP-запросы к бэкенду. Например, `TaskRepository` содержит методы `getByProject()`, `updateStatus()`, `delete()`.

**`features/`** — Все страницы приложения, каждая из которых является **автономным Angular-компонентом** (standalone), загружаемым **лениво** (lazy) для оптимизации скорости первоначальной загрузки. Доступные страницы:
- **Dashboard** — панель управления с Focus Score, последними проектами и незавершёнными задачами.
- **Project List** — список всех проектов с фильтрами и поиском.
- **Project Detail** — детальная страница проекта с созданием и управлением задачами.
- **My Tasks** — все задачи, назначенные авторизованному пользователю.
- **Team** — управление коллегами/друзьями с системой поиска.
- **Settings** — профиль пользователя, акцентный цвет и безопасность.
- **Shell** — главная структура (боковая панель + `router-outlet`).
- **Auth (Login / Register)** — страницы аутентификации.

Маршрутизация определена в `app.routes.ts`. Защищённые маршруты проходят через `authGuard` перед загрузкой компонента.

---

## 1.3 Le Backend : JSON Server / Бэкенд: JSON Server

---

🇫🇷 **Français**

Pour la couche backend, nous utilisons **JSON Server** — un outil léger qui transforme un simple fichier JSON (`db.json`) en une véritable API REST, accessible via des requêtes HTTP standard.

JSON Server tourne localement sur `http://localhost:3000`. Le fichier `db.json` contient toutes les collections de données de l'application :

| Collection | Contenu |
|---|---|
| `users` | Les comptes utilisateurs (nom, email, mot de passe, id) |
| `projects` | Les projets avec leur statut (`active`, `paused`, `completed`) |
| `tasks` | Les tâches avec assigné, date limite, statut et `completedAt` |
| `friendships` | Les relations entre utilisateurs (un enregistrement par paire) |

Les composants Angular communiquent avec ce backend grâce au module `HttpClient` d'Angular. Voici les types de requêtes utilisées :

- **`GET /tasks?assignedUserId=xxx`** — récupérer toutes les tâches d'un utilisateur.
- **`POST /tasks`** — créer une nouvelle tâche.
- **`PATCH /tasks/:id`** — mettre à jour des champs spécifiques d'une tâche (par exemple `status` et `completedAt` lors d'une complétion).
- **`DELETE /tasks/:id`** — supprimer une tâche.
- **`PUT /users/:id`** — remplacer entièrement le profil d'un utilisateur (utilisé dans les Settings pour la modification du profil).

Un point important : comme JSON Server ne supporte pas les requêtes relationnelles complexes (pas de JOIN SQL), certains regroupements de données sont faits **côté frontend** avec JavaScript. Par exemple, pour récupérer la liste des amis d'un utilisateur, on fait deux requêtes séparées (dans les deux directions de la relation) et on les fusionne avec `forkJoin` de RxJS.

---

🇷🇺 **Русский**

В качестве бэкенд-слоя мы используем **JSON Server** — лёгкий инструмент, который превращает простой JSON-файл (`db.json`) в полноценный REST API, доступный через стандартные HTTP-запросы.

JSON Server работает локально на `http://localhost:3000`. Файл `db.json` содержит все коллекции данных приложения:

| Коллекция | Содержимое |
|---|---|
| `users` | Аккаунты пользователей (имя, email, пароль, id) |
| `projects` | Проекты со статусом (`active`, `paused`, `completed`) |
| `tasks` | Задачи с исполнителем, дедлайном, статусом и `completedAt` |
| `friendships` | Связи между пользователями (одна запись на пару) |

Компоненты Angular взаимодействуют с этим бэкендом через модуль `HttpClient`. Используемые типы запросов:

- **`GET /tasks?assignedUserId=xxx`** — получить все задачи пользователя.
- **`POST /tasks`** — создать новую задачу.
- **`PATCH /tasks/:id`** — обновить определённые поля задачи (например, `status` и `completedAt` при её завершении).
- **`DELETE /tasks/:id`** — удалить задачу.
- **`PUT /users/:id`** — полностью заменить профиль пользователя (используется в Settings при изменении профиля).

Важный момент: поскольку JSON Server не поддерживает сложные реляционные запросы (нет SQL JOIN), некоторые группировки данных выполняются **на стороне фронтенда** с помощью JavaScript. Например, чтобы получить список друзей пользователя, выполняются два отдельных запроса (в обоих направлениях отношения) и объединяются с помощью `forkJoin` из RxJS.

---

## 1.4 Logique des Fonctionnalités Clés / Логика Ключевых Функций

---

### 1.4.1 Daily Focus Score — Le Score de Productivité / Показатель Продуктивности

---

🇫🇷 **Français**

Le **Daily Focus Score** est la fonctionnalité la plus originale de l'application. C'est un score sur 100 qui reflète la productivité de l'utilisateur pour la journée en cours. Il s'affiche dans un **anneau SVG animé** sur le tableau de bord.

**Formule de base :**

```
Score = (Tâches dues aujourd'hui ET complétées aujourd'hui / Total des tâches dues aujourd'hui) × 100
```

**Bonus :** Pour chaque tâche terminée aujourd'hui qui n'était pas prévue pour aujourd'hui (tâche en avance ou issue du backlog), on ajoute **+10%** au score, plafonné à **+20%** total de bonus.

**Pénalité :** Pour chaque tâche en retard (dont la `dueDate` est dépassée et dont le statut est toujours `todo`), on soustrait **5%** du score.

**Cas particulier :** Si aucune tâche n'est prévue pour aujourd'hui et qu'aucune n'a été complétée, le score affiche **100%** avec le message "Well deserved rest!" — une journée de repos légitime.

**Fonctionnement du suivi "terminé aujourd'hui" :**  
Pour savoir si une tâche a été complétée aujourd'hui (et non la semaine dernière), nous avons ajouté un champ `completedAt` au modèle `Task`. Ce champ est automatiquement rempli avec la date du jour (format `YYYY-MM-DD`) quand l'utilisateur coche une tâche, et remis à `null` si elle est décochée.

**Anneau SVG :**  
L'anneau est un cercle SVG avec un rayon de 42 unités. Sa circonférence est donc `2 × π × 42 ≈ 263.9`. L'attribut `stroke-dasharray` est calculé comme `score × 2.639`, ce qui représente la longueur d'arc proportionnelle au score. La rotation de départ est corrigée avec `stroke-dashoffset="66"` pour que l'anneau commence en haut (à 12 heures).

**Tendance sur 7 jours :**  
À chaque chargement du tableau de bord, le score du jour est sauvegardé dans `localStorage` sous la clé `tf_score_<userId>`. Les 7 derniers jours sont affichés sous forme de petites barres verticales colorées selon le score (vert pour ≥80%, accent pour ≥60%, orange pour ≥40%, rouge sinon).

---

🇷🇺 **Русский**

**Daily Focus Score** — это самая оригинальная функция приложения. Это показатель от 0 до 100, отражающий продуктивность пользователя за текущий день. Он отображается в **анимированном SVG-кольце** на панели управления.

**Базовая формула:**

```
Оценка = (Задачи, запланированные на сегодня И выполненные сегодня / Всего задач на сегодня) × 100
```

**Бонус:** За каждую задачу, выполненную сегодня, которая не была запланирована на сегодня (опережение графика или задача из бэклога), добавляется **+10%** к оценке, но не более **+20%** бонуса суммарно.

**Штраф:** За каждую просроченную задачу (у которой `dueDate` уже прошла, а статус по-прежнему `todo`), вычитается **5%** из оценки.

**Особый случай:** Если на сегодня нет ни одной запланированной задачи и ни одна не выполнена, оценка показывает **100%** с сообщением "Well deserved rest!" — заслуженный день отдыха.

**Как отслеживается "выполнено сегодня":**  
Чтобы знать, была ли задача выполнена именно сегодня (а не на прошлой неделе), мы добавили поле `completedAt` в модель `Task`. Это поле автоматически заполняется текущей датой (формат `YYYY-MM-DD`) когда пользователь отмечает задачу как выполненную, и сбрасывается в `null` при снятии отметки.

**SVG-кольцо:**  
Кольцо — это SVG-окружность с радиусом 42 единицы. Её длина окружности: `2 × π × 42 ≈ 263.9`. Атрибут `stroke-dasharray` вычисляется как `оценка × 2.639` — это длина дуги, пропорциональная показателю. Начальный поворот корректируется через `stroke-dashoffset="66"`, чтобы кольцо начиналось сверху (на 12 часах).

**Тренд за 7 дней:**  
При каждой загрузке панели управления оценка дня сохраняется в `localStorage` под ключом `tf_score_<userId>`. Последние 7 дней отображаются в виде небольших вертикальных полос, цвет которых зависит от оценки (зелёный ≥80%, акцентный ≥60%, оранжевый ≥40%, красный иначе).

---

### 1.4.2 Vérification d'Unicité de l'Email / Проверка Уникальности Email

---

🇫🇷 **Français**

Pour éviter qu'un même email soit utilisé par plusieurs comptes, nous avons mis en place une vérification côté client au moment de l'inscription et de la modification du profil.

La méthode `isEmailTaken(email, excludeId?)` dans `AuthService` fonctionne de la façon suivante :
1. Elle fait une requête `GET /users` pour récupérer **tous les utilisateurs** de la base.
2. Elle filtre la liste pour vérifier si un autre utilisateur (différent de `excludeId`) possède le même email (comparaison en minuscules pour éviter les problèmes de casse).
3. Elle retourne un `Observable<boolean>` — `true` si l'email est déjà pris, `false` sinon.

Le paramètre `excludeId` est utilisé dans les **Settings** : quand un utilisateur modifie son profil, on exclut son propre compte de la vérification (sinon il ne pourrait pas sauvegarder si son email n'a pas changé).

Sur la page d'inscription, si l'email est déjà pris, un message d'erreur apparaît et le bouton reste actif (il était temporairement désactivé pendant la vérification asynchrone).

---

🇷🇺 **Русский**

Чтобы предотвратить использование одного email несколькими аккаунтами, мы реализовали проверку на стороне клиента при регистрации и изменении профиля.

Метод `isEmailTaken(email, excludeId?)` в `AuthService` работает следующим образом:
1. Делает запрос `GET /users` для получения **всех пользователей** из базы данных.
2. Фильтрует список, проверяя, есть ли другой пользователь (отличный от `excludeId`) с таким же email (сравнение в нижнем регистре, чтобы избежать проблем с регистром букв).
3. Возвращает `Observable<boolean>` — `true` если email уже занят, `false` иначе.

Параметр `excludeId` используется в **Settings**: когда пользователь редактирует свой профиль, его собственный аккаунт исключается из проверки (иначе он не смог бы сохранить профиль, если email не изменился).

На странице регистрации, если email уже занят, отображается сообщение об ошибке, а кнопка остаётся активной (во время асинхронной проверки она была временно заблокирована).

---

### 1.4.3 Recherche de Collègues (Team) / Поиск Коллег (Team)

---

🇫🇷 **Français**

La page **Team** permet à un utilisateur de trouver d'autres utilisateurs et de les ajouter à sa liste de collègues (système d'amis).

La recherche se fait via `FriendshipService.searchUser(query, currentUserId)` :
1. Deux requêtes parallèles sont lancées avec `forkJoin` : une recherche par **nom** et une par **email**.
2. Côté repository, la méthode `searchByName()` fait une requête `GET /users` et **filtre les résultats en JavaScript** avec `name.toLowerCase().includes(query.toLowerCase())`.
3. Les deux listes sont fusionnées, dédupliquées par `id`, et l'utilisateur courant est exclu.
4. Pour le premier résultat trouvé, on vérifie s'il est déjà ami avec l'utilisateur courant via `areFriends()`.

**Pourquoi le filtrage côté client ?** La version de JSON Server utilisée dans ce projet (v1.0.0-beta.15) ne supporte plus le filtre `_like` avec les expressions régulières. On a donc migré vers un fetch complet `GET /users` avec filtrage JavaScript — solution plus robuste et indépendante de la version du serveur.

Les relations d'amitié sont stockées dans la collection `friendships`. Un seul enregistrement est créé par paire d'utilisateurs, mais la requête est faite dans **les deux sens** (qui a ajouté qui) pour couvrir tous les cas.

---

🇷🇺 **Русский**

Страница **Team** позволяет пользователю находить других пользователей и добавлять их в список коллег (система друзей).

Поиск выполняется через `FriendshipService.searchUser(query, currentUserId)`:
1. Запускаются два параллельных запроса через `forkJoin`: поиск по **имени** и по **email**.
2. На уровне репозитория метод `searchByName()` делает запрос `GET /users` и **фильтрует результаты на JavaScript** с помощью `name.toLowerCase().includes(query.toLowerCase())`.
3. Два списка объединяются, дедублируются по `id`, и текущий пользователь исключается.
4. Для первого найденного результата проверяется, является ли он уже другом текущего пользователя через `areFriends()`.

**Почему фильтрация на стороне клиента?** Версия JSON Server, используемая в этом проекте (v1.0.0-beta.15), больше не поддерживает фильтр `_like` с регулярными выражениями. Поэтому мы перешли на полный fetch `GET /users` с фильтрацией на JavaScript — решение более надёжное и не зависящее от версии сервера.

Отношения дружбы хранятся в коллекции `friendships`. Создаётся только одна запись на пару пользователей, но запрос выполняется **в обоих направлениях** (кто кого добавил), чтобы учесть все случаи.

---

### 1.4.4 Gestion des Délais et Statuts de Tâches / Управление Дедлайнами и Статусами Задач

---

🇫🇷 **Français**

Le `DeadlineService` est responsable du calcul de l'état d'une tâche par rapport à sa date limite. Il définit quatre états possibles :

| État | Condition | Couleur |
|---|---|---|
| `none` | Pas de date limite définie | Gris |
| `normal` | Plus de 3 jours restants | Vert |
| `warning` | 3 jours ou moins | Orange |
| `expired` | Date dépassée | Rouge |

La méthode `getTaskState(dueDate)` compare la date du jour à la `dueDate` de la tâche en travaillant avec des dates locales (minuit heure locale) pour éviter les décalages de fuseau horaire liés à l'UTC.

Quand un projet est **mis en pause**, toutes ses tâches voient leur `dueDate` remise à `null`. Elles passent alors en état `none` et toutes les actions sur ces tâches sont bloquées tant que le projet reste en pause.

---

🇷🇺 **Русский**

`DeadlineService` отвечает за вычисление состояния задачи относительно её дедлайна. Он определяет четыре возможных состояния:

| Состояние | Условие | Цвет |
|---|---|---|
| `none` | Дедлайн не задан | Серый |
| `normal` | Осталось более 3 дней | Зелёный |
| `warning` | Осталось 3 дня или меньше | Оранжевый |
| `expired` | Дата прошла | Красный |

Метод `getTaskState(dueDate)` сравнивает текущую дату с `dueDate` задачи, работая с локальными датами (полночь по местному времени), чтобы избежать сдвигов часового пояса, связанных с UTC.

Когда проект **ставится на паузу**, у всех его задач `dueDate` сбрасывается в `null`. Они переходят в состояние `none`, и все действия с ними блокируются, пока проект остаётся на паузе.

---

## 1.5 Outils de Développement et Usage de l'IA / Инструменты Разработки и Использование ИИ

---

🇫🇷 **Français**

Ce projet a été développé avec les outils suivants :

- **Angular CLI 19** — génération et gestion du projet front-end.
- **JSON Server 1.0.0-beta.15** — backend REST local basé sur `db.json`.
- **TypeScript** — typage fort pour réduire les erreurs et améliorer la lisibilité du code.
- **SCSS** — feuilles de style avec variables et imbrication pour un code CSS maintenable.
- **Playwright** — pour les tests end-to-end afin de vérifier que chaque fonctionnalité fonctionne réellement dans le navigateur.

**Utilisation des outils d'intelligence artificielle :**  
Des outils d'IA ont été utilisés comme **co-pilote éducatif** tout au long du développement. Concrètement, ils ont servi à :
- Déboguer des erreurs asynchrones complexes (par exemple, les requêtes `forkJoin` qui échouaient silencieusement).
- Comprendre pourquoi certains paramètres de requête JSON Server ne fonctionnaient plus avec la version 1.x.
- Générer des bases de code CSS pour les composants visuels comme l'anneau SVG et les barres de tendance.
- Reformuler et corriger des erreurs TypeScript liées aux types optionnels.

L'IA n'a pas écrit le projet à la place — elle a servi d'assistant pour avancer plus vite, comprendre les erreurs et apprendre en faisant.

---

🇷🇺 **Русский**

Проект разработан с использованием следующих инструментов:

- **Angular CLI 19** — генерация и управление фронтенд-проектом.
- **JSON Server 1.0.0-beta.15** — локальный REST-бэкенд на основе `db.json`.
- **TypeScript** — строгая типизация для уменьшения ошибок и повышения читаемости кода.
- **SCSS** — стили с переменными и вложенностью для удобного CSS.
- **Playwright** — для end-to-end тестов, чтобы проверить реальную работу каждой функции в браузере.

**Использование инструментов искусственного интеллекта:**  
ИИ-инструменты использовались как **образовательный ко-пилот** на протяжении всей разработки. Конкретно они помогли:
- Отлаживать сложные асинхронные ошибки (например, запросы `forkJoin`, которые молча завершались неудачей).
- Понять, почему определённые параметры запросов JSON Server перестали работать с версией 1.x.
- Генерировать базовый CSS-код для визуальных компонентов, таких как SVG-кольцо и полосы тренда.
- Переформулировать и исправлять ошибки TypeScript, связанные с необязательными типами.

ИИ не писал проект вместо меня — он служил ассистентом, чтобы продвигаться быстрее, понимать ошибки и учиться на практике.

---

---

# SECTION 2 — SCRIPT DE PRÉSENTATION ORALE
# РАЗДЕЛ 2 — СЦЕНАРИЙ УСТНОЙ ПРЕЗЕНТАЦИИ

---

> **Instructions :** Ce script est conçu pour être **lu à voix haute** devant le jury. Les indications entre crochets `[...]` sont des repères pour toi, pas à lire. La durée estimée est de **6 à 8 minutes**.

> **Инструкции:** Этот сценарий предназначен для **чтения вслух** перед жюри. Указания в скобках `[...]` — это ориентиры для тебя, их вслух не читай. Ориентировочное время: **6–8 минут**.

---

🇫🇷 **Script Complet — Français (À LIRE DEVANT LE JURY)**

---

**[OUVERTURE — rester calme, regarder l'audience, sourire]**

Bonjour à tous. Je m'appelle [Ton Prénom Nom], et aujourd'hui je vous présente mon projet de fin de module : **TaskFlow**, une application web de gestion de projets et de tâches développée en Angular 19.

Avant de commencer la démonstration, permettez-moi de vous expliquer en une phrase ce que fait cette application et pourquoi elle est un peu différente des gestionnaires de tâches classiques.

TaskFlow ne se contente pas d'afficher une liste de choses à faire. Elle analyse ce que vous avez accompli dans la journée, compare ça à ce qui était prévu, et vous donne un **score de productivité personnalisé** appelé le "Focus Score". L'idée, c'est que gérer ses tâches efficacement, c'est bien — mais savoir si on est réellement en train d'avancer, c'est encore mieux.

---

**[ARCHITECTURE — rapide, une minute maximum]**

Techniquement, l'application repose sur **Angular 19** pour le frontend, avec des composants autonomes chargés de manière paresseuse pour optimiser les performances. Le backend est assuré par **JSON Server**, qui lit et écrit dynamiquement dans un fichier `db.json` via des requêtes HTTP standard.

La structure du code est divisée en trois grandes parties : le `core` pour les services partagés comme l'authentification, le `domain` pour les modèles de données et les repositories, et les `features` pour les pages de l'application.

---

**[DÉMONSTRATION — pointer l'écran ou le vidéoprojecteur au fur et à mesure]**

Passons maintenant à la démonstration en direct.

**Tableau de bord — le Dashboard**

Si vous regardez l'écran, vous voyez la page principale de l'application, le **Dashboard**. En haut, on a trois indicateurs rapides : le nombre de projets actifs, les tâches en attente, et les tâches terminées.

En dessous, vous voyez notre fonctionnalité phare : le **panneau Focus Score**. À gauche, un anneau SVG affiche un pourcentage en temps réel. Aujourd'hui, ce score indique [lire la valeur affichée]%. Juste à côté, vous voyez le libellé — ici "Great progress!" — et une ligne de détail qui explique comment le score a été calculé : combien de tâches étaient prévues, combien ont été faites, et s'il y a une pénalité pour des tâches en retard.

En bas du panneau, vous avez les **barres de tendance sur 7 jours**. Chaque petite barre représente une journée. La barre d'aujourd'hui est mise en évidence en couleur. C'est particulièrement utile pour voir si on maintient un rythme de travail régulier sur la semaine.

À droite du panneau, quatre chiffres résument la journée : tâches planifiées, tâches terminées aujourd'hui, tâches bonus, et tâches en retard.

---

**Projets — la liste de vos projets**

Maintenant, navigeons vers l'onglet **Projets**. [Cliquer sur Projects dans le menu]

Ici, on voit la liste de tous les projets créés par l'utilisateur connecté. Chaque carte affiche le nom du projet, sa progression avec une barre de pourcentage, et les avatars des membres assignés.

On peut filtrer par statut : actif, en pause, ou terminé. Les projets en pause apparaissent dans un accordéon séparé avec un indicateur visuel orange.

Je vais créer un nouveau projet rapidement. [Cliquer sur "New Project"] Vous voyez le formulaire — j'entre un nom, une description optionnelle, et une **date limite**. Remarquez que le champ de date est personnalisé : il a une icône de calendrier intégrée qui correspond visuellement au thème sombre de l'application, et non le widget natif basique du navigateur.

[Remplir et créer ou annuler]

Si on ouvre un projet existant, on arrive sur la **page de détail**. L'owner du projet peut ajouter des tâches directement depuis la barre en haut de la liste, assigner un membre de l'équipe et définir une date limite. Les tâches sont triées automatiquement par urgence : celles qui arrivent à expiration apparaissent en premier, avec un badge d'avertissement orange ou rouge.

---

**My Tasks — Mes Tâches**

Passons maintenant à l'onglet **My Tasks**. [Cliquer sur My Tasks]

Cette page regroupe toutes les tâches qui me sont assignées, quel que soit le projet. Je peux filtrer par état : toutes, actives, en avertissement, expirées, ou terminées.

Je vais cocher une tâche. [Cliquer sur le cercle d'une tâche] Voilà — la tâche passe en "done". Et c'est à ce moment précis que le champ `completedAt` est écrit dans la base de données avec la date d'aujourd'hui. Grâce à ça, si je reviens sur le Dashboard, le Focus Score se met à jour et reflète cette complétion.

Les tâches des projets en pause sont visibles ici mais toutes les actions sont bloquées — c'est le comportement prévu pour éviter des modifications incohérentes.

---

**Team — L'équipe**

Direction l'onglet **Team**. [Cliquer sur Team]

Ici, on voit les collègues déjà connectés à notre compte. Pour en ajouter un nouveau, je clique sur "Add Friend". [Cliquer sur le bouton]

Dans cette fenêtre de recherche, je peux chercher un utilisateur par son nom ou son adresse email. Je tape "Denys". [Taper et cliquer sur Search] Le système fait une requête vers le backend, filtre les résultats côté JavaScript, et affiche la fiche de l'utilisateur trouvé avec son email. Je peux l'ajouter directement depuis cette fenêtre.

---

**Settings — Les Paramètres**

Dernière étape, les **Settings**. [Cliquer sur Settings dans la barre latérale]

Ici, l'utilisateur peut modifier son profil, changer son email — avec une vérification automatique qu'il n'est pas déjà utilisé par un autre compte — et modifier son mot de passe. Dans l'onglet Apparence, on peut changer la **couleur d'accentuation** de toute l'application. [Cliquer sur une autre couleur] Vous voyez que les boutons, les liens actifs et les indicateurs changent de couleur instantanément, grâce à la variable CSS `--accent` appliquée globalement.

---

**[CONCLUSION TECHNIQUE — s'adresser directement aux professeurs]**

Pour résumer sur le plan technique : l'application tourne sur **Angular 19** avec le routing lazy-loading, une authentification par garde de route, et une communication HTTP propre avec JSON Server. L'interface est entièrement responsive et fonctionne aussi bien sur grand écran que sur mobile. Chaque fonctionnalité a été testée manuellement et via des tests automatisés avec **Playwright** pour garantir que rien ne casse lors des modifications.

Ce projet m'a permis de consolider mes bases en développement front-end, de comprendre comment structurer une application Angular de taille réelle, et de livrer quelque chose de fonctionnel de bout en bout.

Je vous remercie pour votre attention, et je suis disponible pour répondre à vos questions.

---

🇷🇺 **Полный Сценарий — Русский (ДЛЯ ЛИЧНОЙ ПОДГОТОВКИ)**

---

**[ВСТУПЛЕНИЕ — оставайся спокойным, смотри на аудиторию, улыбайся]**

Здравствуйте. Меня зовут [Твоё Имя Фамилия], и сегодня я представляю мой итоговый проект: **TaskFlow** — веб-приложение для управления проектами и задачами, разработанное на Angular 19.

Прежде чем начать демонстрацию, позвольте объяснить одной фразой, что делает это приложение и чем оно отличается от обычных менеджеров задач.

TaskFlow — это не просто список дел. Оно анализирует, что ты сделал за день, сравнивает это с запланированным, и выдаёт **персонализированный показатель продуктивности** — "Focus Score". Идея в том, что эффективно управлять задачами — хорошо, но знать, действительно ли ты продвигаешься вперёд — ещё лучше.

---

**[АРХИТЕКТУРА — кратко, максимум одна минута]**

С технической стороны приложение построено на **Angular 19** для фронтенда, с автономными компонентами, загружаемыми лениво для оптимизации производительности. Бэкенд — **JSON Server**, который динамически читает и записывает данные в файл `db.json` через стандартные HTTP-запросы.

Структура кода разделена на три части: `core` — для общих сервисов (аутентификация и т.д.), `domain` — для моделей данных и репозиториев, и `features` — для страниц приложения.

---

**[ДЕМОНСТРАЦИЯ — указывай на экран или проектор]**

Перейдём к живой демонстрации.

**Панель управления — Dashboard**

На экране вы видите главную страницу приложения — **Dashboard**. Сверху три быстрых показателя: количество активных проектов, задачи в ожидании и выполненные задачи.

Ниже — наша ключевая функция: **панель Focus Score**. Слева SVG-кольцо отображает процент в реальном времени. Сегодня показатель составляет [прочитай значение]%. Рядом — подпись: "Great progress!" — и строка, объясняющая расчёт: сколько задач было запланировано, сколько выполнено, есть ли штраф за просроченные.

Внизу панели — **полосы тренда за 7 дней**. Каждая полоса — один день. Полоса сегодняшнего дня выделена цветом. Это удобно, чтобы видеть, поддерживается ли стабильный темп работы в течение недели.

Справа от панели — четыре цифры: запланированные задачи, выполненные сегодня, бонусные задачи и просроченные.

---

**Проекты — список проектов**

Перейдём на вкладку **Projects**. [Нажать на Projects в меню]

Здесь список всех проектов пользователя. Каждая карточка показывает название, прогресс в процентах и аватары назначенных участников.

Можно фильтровать по статусу: активный, на паузе или завершённый. Проекты на паузе появляются в отдельном аккордеоне с оранжевым визуальным индикатором.

Создам новый проект. [Нажать "New Project"] Форма — ввожу название, опциональное описание и **дедлайн**. Обратите внимание на поле даты: у него встроенная иконка календаря, которая вписывается в тёмную тему приложения, а не стандартный браузерный виджет.

[Заполнить и создать или отменить]

Открыв существующий проект, попадаем на **страницу деталей**. Владелец может добавлять задачи прямо из строки вверху списка, назначать участника и устанавливать дедлайн. Задачи автоматически сортируются по срочности: ближайшие к истечению отображаются первыми с оранжевым или красным предупреждением.

---

**My Tasks — Мои задачи**

Перейдём на **My Tasks**. [Нажать My Tasks]

Здесь все задачи, назначенные мне, независимо от проекта. Можно фильтровать: все, активные, с предупреждением, просроченные или выполненные.

Отмечу задачу. [Нажать на кружок задачи] Готово — задача переходит в "done". Именно в этот момент поле `completedAt` записывается в базу данных с сегодняшней датой. Благодаря этому, если вернуться на Dashboard, Focus Score обновится и отразит это выполнение.

Задачи проектов на паузе видны, но все действия заблокированы — это предотвращает несогласованные изменения.

---

**Team — Команда**

Переходим на **Team**. [Нажать Team]

Здесь видны коллеги, уже подключённые к аккаунту. Чтобы добавить нового, нажимаю "Add Friend". [Нажать кнопку]

В этом окне поиска можно найти пользователя по имени или email. Ввожу "Denys". [Ввести и нажать Search] Система делает запрос к бэкенду, фильтрует результаты на JavaScript и отображает карточку найденного пользователя с его email. Можно добавить его прямо из этого окна.

---

**Settings — Настройки**

Последний шаг — **Settings**. [Нажать Settings в боковой панели]

Здесь пользователь может изменить профиль, поменять email — с автоматической проверкой, что он не используется другим аккаунтом — и изменить пароль. На вкладке "Appearance" можно выбрать **акцентный цвет** всего приложения. [Нажать другой цвет] Видите: кнопки, активные ссылки и индикаторы мгновенно меняют цвет — благодаря глобальной CSS-переменной `--accent`.

---

**[ТЕХНИЧЕСКИЙ ВЫВОД — обращайся к преподавателям]**

Подводя технический итог: приложение работает на **Angular 19** с lazy-loading роутингом, защитой маршрутов через guard и чистым HTTP-взаимодействием с JSON Server. Интерфейс полностью адаптивен и работает как на большом экране, так и на мобильном. Каждая функция протестирована вручную и через автоматизированные тесты на **Playwright**, чтобы гарантировать стабильность при изменениях.

Этот проект помог мне закрепить основы фронтенд-разработки, понять, как структурировать Angular-приложение реального размера, и создать что-то функциональное от начала до конца.

Спасибо за внимание, я готов ответить на ваши вопросы.

---

---

# SECTION 3 — CONCLUSION
# РАЗДЕЛ 3 — ЗАКЛЮЧЕНИЕ

---

🇫🇷 **Français**

Ce projet m'a permis d'atteindre plusieurs objectifs concrets en tant qu'étudiant en informatique.

**Sur le plan technique**, j'ai appris à structurer une application Angular de manière modulaire et maintenable, à gérer des flux de données asynchrones avec RxJS (`forkJoin`, `switchMap`, `catchError`), et à faire communiquer un frontend Angular avec un backend REST. J'ai également mieux compris le cycle de vie des composants, la gestion de l'état local, et l'importance de séparer la logique métier (services/repositories) de la présentation (composants).

**Sur le plan fonctionnel**, l'application couvre un cas d'usage réel et complet : création de projets, gestion des tâches avec délais et priorités, collaboration en équipe, et suivi de la productivité. Ce n'est pas un projet "démo" — c'est une application que l'on pourrait réellement utiliser au quotidien.

**Sur le plan personnel**, développer TaskFlow m'a enseigné quelque chose d'important : un bug n'est pas un obstacle, c'est une opportunité de comprendre comment fonctionne vraiment le système. Les problèmes rencontrés — comme l'incompatibilité de JSON Server v1.x avec les filtres regex, ou les décalages de fuseaux horaires dans les calculs de dates — ont été les moments où j'ai le plus appris.

Ce projet est fonctionnel, testé, et documenté. Il constitue une base solide sur laquelle je pourrais continuer à construire : par exemple, en ajoutant une vraie authentification par JWT, en migrant vers une base de données relationnelle, ou en déployant l'application sur un serveur en ligne.

Je reste convaincu que la meilleure façon d'apprendre le développement web, c'est de construire quelque chose de réel, de le casser, de le réparer, et de recommencer.

---

🇷🇺 **Русский**

Этот проект позволил мне достичь нескольких конкретных целей как студенту IT-специальности.

**С технической стороны**, я научился структурировать Angular-приложение модульно и поддерживаемо, управлять асинхронными потоками данных с RxJS (`forkJoin`, `switchMap`, `catchError`), и обеспечивать взаимодействие Angular-фронтенда с REST-бэкендом. Я также лучше понял жизненный цикл компонентов, управление локальным состоянием и важность отделения бизнес-логики (сервисы/репозитории) от представления (компоненты).

**С функциональной стороны**, приложение охватывает реальный и полный сценарий использования: создание проектов, управление задачами с дедлайнами и приоритетами, командное сотрудничество и отслеживание продуктивности. Это не "демо-проект" — это приложение, которое можно реально использовать ежедневно.

**На личном уровне**, разработка TaskFlow научила меня важному: баг — это не препятствие, это возможность понять, как на самом деле работает система. Проблемы, с которыми пришлось столкнуться — например, несовместимость JSON Server v1.x с regex-фильтрами или сдвиги часовых поясов в расчётах дат — стали моментами, когда я узнал больше всего.

Этот проект функционален, протестирован и задокументирован. Он представляет собой прочную основу для дальнейшего развития: например, можно добавить настоящую JWT-аутентификацию, перейти на реляционную базу данных или задеплоить приложение на облачный сервер.

Я убеждён, что лучший способ научиться веб-разработке — это создать что-то реальное, сломать это, починить и начать снова.

---

---

*Fin du document — Конец документа*

*TaskFlow — Angular 19 | JSON Server | TypeScript | SCSS | RxJS | Playwright*
