-- ============================================================
-- 宜早鲜 D1 数据库表结构
-- 在 Cloudflare D1 中执行此 SQL
-- ============================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TEXT NOT NULL
);

-- 2. 用户地址表
CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    tag TEXT DEFAULT '',
    lng REAL,
    lat REAL,
    province TEXT DEFAULT '',
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    street TEXT DEFAULT '',
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. 供应商表（已添加省市区字段）
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    lng REAL,
    lat REAL,
    province TEXT DEFAULT '',
    city TEXT DEFAULT '',
    district TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

-- 4. 商品表
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT '',
    price REAL NOT NULL,
    unit TEXT DEFAULT '份',
    stock INTEGER DEFAULT 0,
    supplier_id TEXT,
    emoji TEXT DEFAULT '🥬',
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'on',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 5. 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    address_id TEXT,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    items TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 6. 库存操作记录表
CREATE TABLE IF NOT EXISTS inventory_logs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    operator TEXT DEFAULT '系统',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 7. 财务记录表
CREATE TABLE IF NOT EXISTS finance_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

-- 8. 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- ============================================================
-- 创建索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_type ON finance_records(type);

-- ============================================================
-- 初始化默认管理员账号（密码: 123456）
-- ============================================================
INSERT OR IGNORE INTO users (id, phone, password, security_question, security_answer, role, created_at)
VALUES (
    'u_admin_001',
    '13800138000',
    '123456',
    '您的出生地是？',
    '北京',
    'admin',
    datetime('now')
);