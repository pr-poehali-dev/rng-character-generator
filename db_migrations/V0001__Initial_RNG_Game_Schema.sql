-- RNG Game Database Schema
-- Users table with authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_spin TIMESTAMP,
    total_spins INTEGER DEFAULT 0
);

-- Rarities table for character rarities
CREATE TABLE rarities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL, -- hex color
    chance DECIMAL(5,4) NOT NULL, -- probability 0.0001 to 1.0000
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Characters table
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    rarity_id INTEGER REFERENCES rarities(id),
    is_limited BOOLEAN DEFAULT FALSE,
    limited_until TIMESTAMP NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- User character collection
CREATE TABLE user_characters (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    character_id INTEGER REFERENCES characters(id),
    obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, character_id, obtained_at) -- allow duplicates with different timestamps
);

-- Events table (admin created events)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'rate_boost', 'limited_character', etc
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    config JSONB, -- event specific configuration
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Daily quests table
CREATE TABLE daily_quests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    quest_type VARCHAR(50) NOT NULL, -- 'daily_spins', 'login', etc
    target_value INTEGER NOT NULL, -- e.g., number of spins required
    reward_type VARCHAR(50) NOT NULL, -- 'free_spin', 'currency', etc
    reward_value INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User quest progress
CREATE TABLE user_quest_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    quest_id INTEGER REFERENCES daily_quests(id),
    current_progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    quest_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, quest_id, quest_date)
);

-- Chat messages table
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with hashed password for 'Satoru1212'
-- Using bcrypt hash for password 'Satoru1212': $2b$10$...
INSERT INTO users (username, password_hash, is_admin) VALUES 
('Admin', '$2b$10$8K4rM5nE9vLGD3jF7sP1a.GHqN6wZ2xV8fR0tY4uI1sA7cB9eH5mO', TRUE);

-- Insert default rarities
INSERT INTO rarities (name, color, chance) VALUES
('Common', '#9CA3AF', 0.5000),      -- 50% chance
('Rare', '#3B82F6', 0.3000),        -- 30% chance  
('Epic', '#8B5CF6', 0.1500),        -- 15% chance
('Legendary', '#F59E0B', 0.0400),   -- 4% chance
('Mythical', '#EF4444', 0.0095),    -- 0.95% chance
('Divine', '#F97316', 0.0005);      -- 0.05% chance

-- Insert sample daily quests
INSERT INTO daily_quests (title, description, quest_type, target_value, reward_type, reward_value) VALUES
('Daily Spinner', 'Perform 3 character spins', 'daily_spins', 3, 'free_spin', 1),
('Active Player', 'Login to the game', 'login', 1, 'free_spin', 1),
('Lucky Seven', 'Perform 7 character spins', 'daily_spins', 7, 'free_spin', 2);