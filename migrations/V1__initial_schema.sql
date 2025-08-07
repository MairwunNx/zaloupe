CREATE TABLE chats (
    chat_id BIGINT PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    messages_count INTEGER DEFAULT 0,
    searches_count INTEGER DEFAULT 0
);

CREATE INDEX idx_chats_is_active ON chats(is_active);
CREATE INDEX idx_chats_type ON chats(type);

CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);

CREATE TABLE user_chat_settings (
    user_id BIGINT,
    chat_id BIGINT,
    allow_collect BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    messages_count INTEGER DEFAULT 0,
    searches_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, chat_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(chat_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_chat_settings_user_id ON user_chat_settings(user_id);
CREATE INDEX idx_user_chat_settings_chat_id ON user_chat_settings(chat_id);
CREATE INDEX idx_user_chat_settings_allow_collect ON user_chat_settings(allow_collect);