-- ============================================================
-- 宜早鲜 D1 数据库表结构（v4.0 - 完整版）
-- 包含：商品、订单、评价、收藏、搜索、优惠券、消息、售后、物流
-- ============================================================

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TEXT NOT NULL
);

-- ============================================================
-- 2. 地址表
-- ============================================================
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
    last_used INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. 供应商表
-- ============================================================
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

-- ============================================================
-- 4. 商品表（新增：已售、产地、图片）
-- ============================================================
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
    is_hot INTEGER DEFAULT 0,
    today_pickup INTEGER DEFAULT 1,
    sales_count INTEGER DEFAULT 0,          -- 已售数量
    origin TEXT DEFAULT '',                  -- 产地（如：湖北省宜昌市）
    images TEXT DEFAULT '[]',               -- 商品图片JSON数组
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- ============================================================
-- 5. 商品规格表
-- ============================================================
CREATE TABLE IF NOT EXISTS product_specs (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    spec_name TEXT NOT NULL,                -- 大份/小份/1kg
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    sku_code TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. 订单表（新增：提货码、截单、预计提货）
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    address_id TEXT,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    items TEXT NOT NULL,
    pickup_code TEXT DEFAULT '',
    cutoff_time TEXT,
    expected_pickup_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ============================================================
-- 7. 订单物流表
-- ============================================================
CREATE TABLE IF NOT EXISTS order_logistics (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',          -- pending/shipping/delivered
    tracking_number TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    logistics_info TEXT DEFAULT '[]',       -- JSON轨迹数组
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- 8. 评价表
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,                -- 1-5星
    content TEXT DEFAULT '',
    images TEXT DEFAULT '[]',               -- 评价图片JSON数组
    tags TEXT DEFAULT '[]',                 -- 评价标签JSON数组（如：["新鲜","好吃"]）
    reply TEXT DEFAULT '',                  -- 商家回复
    reply_at TEXT,
    likes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 9. 评价点赞表
-- ============================================================
CREATE TABLE IF NOT EXISTS review_likes (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(review_id, user_id)
);

-- ============================================================
-- 10. 收藏表
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);

-- ============================================================
-- 11. 搜索历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 12. 优惠券表
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                     -- discount / full_reduction
    value REAL NOT NULL,                    -- 折扣金额或折扣比例
    min_amount REAL DEFAULT 0,              -- 满减门槛
    expire_at TEXT NOT NULL,
    stock INTEGER DEFAULT 999,
    created_at TEXT NOT NULL
);

-- ============================================================
-- 13. 用户优惠券表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_coupons (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coupon_id TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
);

-- ============================================================
-- 14. 消息表
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,                     -- order / system / promotion
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    link TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 15. 售后表
-- ============================================================
CREATE TABLE IF NOT EXISTS after_sales (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,                     -- refund / return
    reason TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',          -- pending / approved / rejected / completed
    admin_reply TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 16. 库存日志
-- ============================================================
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

-- ============================================================
-- 17. 财务记录
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

-- ============================================================
-- 18. 管理员表
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    permissions TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_hot ON products(is_hot);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_after_sales_user_id ON after_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_order_logistics_order_id ON order_logistics(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_finance_records_type ON finance_records(type);
CREATE INDEX IF NOT EXISTS idx_product_specs_product_id ON product_specs(product_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id);

-- ============================================================
-- 初始化默认管理员（密码: 123456）
-- ============================================================
INSERT OR IGNORE INTO admins (id, username, password, permissions, created_at)
VALUES ('admin_001', 'admin', '123456', '["dashboard","suppliers","products","inventory","orders","finance","backup","members","profile","reviews","after_sales","coupons","messages"]', datetime('now'));