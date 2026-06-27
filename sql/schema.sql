-- ============================================================
-- 宜早鲜 D1 数据库表结构（v5.0 - 含地区表、规格、图片）
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
-- 2. 地址表（含 last_used）
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
-- 4. 商品表（含已售、产地、图片）
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
    sales_count INTEGER DEFAULT 0,
    origin TEXT DEFAULT '',
    images TEXT DEFAULT '[]',
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
    spec_name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER DEFAULT 0,
    sku_code TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. 订单表
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
    status TEXT DEFAULT 'pending',
    tracking_number TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    logistics_info TEXT DEFAULT '[]',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- 8. 评价表（含 images 字段，存储图片 URL 数组）
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    content TEXT DEFAULT '',
    images TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    reply TEXT DEFAULT '',
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
    type TEXT NOT NULL,
    value REAL NOT NULL,
    min_amount REAL DEFAULT 0,
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
    type TEXT NOT NULL,
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
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
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
-- ★★★ 19. 地区数据表（动态加载） ★★★
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    parent_id TEXT DEFAULT '',
    name TEXT NOT NULL,
    level INTEGER NOT NULL,  -- 1:省 2:市 3:区/县
    code TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_regions_parent_id ON regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_hot ON products(is_hot);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
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

-- ============================================================
-- ★★★ 插入初始地区数据（省/直辖市） ★★★
-- ============================================================
INSERT OR IGNORE INTO regions (id, parent_id, name, level, created_at) VALUES
('r1', '', '北京市', 1, datetime('now')),
('r2', '', '上海市', 1, datetime('now')),
('r3', '', '天津市', 1, datetime('now')),
('r4', '', '重庆市', 1, datetime('now')),
('r5', '', '河北省', 1, datetime('now')),
('r6', '', '山西省', 1, datetime('now')),
('r7', '', '辽宁省', 1, datetime('now')),
('r8', '', '吉林省', 1, datetime('now')),
('r9', '', '黑龙江省', 1, datetime('now')),
('r10', '', '江苏省', 1, datetime('now')),
('r11', '', '浙江省', 1, datetime('now')),
('r12', '', '安徽省', 1, datetime('now')),
('r13', '', '福建省', 1, datetime('now')),
('r14', '', '江西省', 1, datetime('now')),
('r15', '', '山东省', 1, datetime('now')),
('r16', '', '河南省', 1, datetime('now')),
('r17', '', '湖北省', 1, datetime('now')),
('r18', '', '湖南省', 1, datetime('now')),
('r19', '', '广东省', 1, datetime('now')),
('r20', '', '海南省', 1, datetime('now')),
('r21', '', '四川省', 1, datetime('now')),
('r22', '', '贵州省', 1, datetime('now')),
('r23', '', '云南省', 1, datetime('now')),
('r24', '', '陕西省', 1, datetime('now')),
('r25', '', '甘肃省', 1, datetime('now')),
('r26', '', '青海省', 1, datetime('now')),
('r27', '', '台湾省', 1, datetime('now')),
('r28', '', '内蒙古自治区', 1, datetime('now')),
('r29', '', '广西壮族自治区', 1, datetime('now')),
('r30', '', '西藏自治区', 1, datetime('now')),
('r31', '', '宁夏回族自治区', 1, datetime('now')),
('r32', '', '新疆维吾尔自治区', 1, datetime('now')),
('r33', '', '香港特别行政区', 1, datetime('now')),
('r34', '', '澳门特别行政区', 1, datetime('now'));

-- 注意：市/区数据量巨大，建议通过后台“同步地区数据”功能从高德API动态获取，此处不全部硬编码。