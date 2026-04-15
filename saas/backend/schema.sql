-- SQL Схема базы данных D1 для Table AI SaaS

-- Таблица пользователей (заменяет вкладки 'Лицензии' и 'Настройки' из Sheets)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,           -- Наш внутренний UUID
    vk_id TEXT UNIQUE,             -- ID ВКонтакте, если авторизовался через ВК
    email TEXT UNIQUE,             -- Email (если будет нужен в будущем)
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',      -- 'user' или 'admin'
    gemini_api_key TEXT,           -- Личный ключ пользователя (если он хочет использовать свой)
    balance INTEGER DEFAULT 0,     -- Баланс токенов/запросов (если ключ системный)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица системных промптов (заменяет функционал 'prompt_table' из Sheets)
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,     -- Ключ промпта, например 'ARCHETYPE_ANALYSIS'
    content TEXT NOT NULL,         -- Сам текст промпта с переменными
    description TEXT,              -- Для чего этот промпт
    is_active INTEGER DEFAULT 1,   -- 1 = активен, 0 = выключен
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица импортов (группировка операций)
CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL,     -- 'vk', 'telegram', 'instagram'
    post_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'error'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Таблица сырого контента пользователя (обновленная)
CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    import_id TEXT,               -- Ссылка на группу импорта
    source_type TEXT NOT NULL,
    source_id TEXT,
    raw_text TEXT NOT NULL,
    metadata TEXT,                -- JSON: дата, ссылка на оригинал, автор
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL
);

-- Таблица с результатами работы AI ("Распаковка", "ЦА" и т.д.)
CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    prompt_id TEXT NOT NULL,       -- Какой промпт использовался
    input_content_ids TEXT,        -- JSON массив ID из таблицы content, которые были поданы на вход
    ai_response TEXT NOT NULL,     -- Ответ Gemini
    status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'error'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

-- Начальные данные
INSERT OR IGNORE INTO prompts (id, name, content, description) 
VALUES ('manual', 'MANUAL_PROMPT', '{{input}}', 'Ручной ввод промпта');
