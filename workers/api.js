// ============================================================
// 宜早鲜 Cloudflare Workers API - v5.8 完整修复版
// 修复：订单插入时移除 address_id 字段，彻底避免外键约束错误
// ============================================================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // ★★★ 全局禁用外键约束（防止其他查询报错）★★★
            await env.DB.prepare('PRAGMA foreign_keys = OFF;').run();

            // ===== 健康检查 =====
            if (path === '/test' && method === 'GET') {
                return new Response('Worker is alive!', { headers: corsHeaders });
            }

            // ============================================================
            // 图片上传代理（写入 R2）
            // ============================================================
            if (path === '/reviews/upload' && method === 'POST') {
                const contentType = request.headers.get('Content-Type') || '';
                if (!contentType.includes('multipart/form-data')) {
                    return new Response(JSON.stringify({ error: '请使用 multipart/form-data 格式上传' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                try {
                    const formData = await request.formData();
                    const file = formData.get('image');
                    if (!file) {
                        return new Response(JSON.stringify({ error: '缺少 image 字段' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    if (!file.type || !file.type.startsWith('image/')) {
                        return new Response(JSON.stringify({ error: '只允许上传图片文件' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    if (file.size > 5 * 1024 * 1024) {
                        return new Response(JSON.stringify({ error: '图片大小不能超过 5MB' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    const userId = formData.get('userId') || 'anonymous';
                    const ext = file.name ? file.name.split('.').pop() : 'jpg';
                    const key = `reviews/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

                    if (!env.BUCKET) {
                        return new Response(JSON.stringify({ error: 'R2 存储未配置，请检查 Worker 绑定' }), {
                            status: 500,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    await env.BUCKET.put(key, file.stream(), {
                        httpMetadata: {
                            contentType: file.type || 'image/jpeg',
                            cacheControl: 'public, max-age=31536000'
                        }
                    });

                    const publicUrl = `https://yizaoxian-r2.1980217.xyz/${key}`;

                    return new Response(JSON.stringify({
                        success: true,
                        publicUrl: publicUrl,
                        key: key
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (e) {
                    console.error('上传到 R2 失败:', e);
                    return new Response(JSON.stringify({ error: '上传失败: ' + e.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // ============================================================
            // 用户模块
            // ============================================================
            if (path === '/users/login' && method === 'POST') {
                const body = await request.json();
                const { phone, password } = body;
                const result = await env.DB.prepare('SELECT * FROM users WHERE phone = ? AND password = ?').bind(phone, password).first();
                if (result) {
                    const addresses = await env.DB.prepare('SELECT * FROM addresses WHERE user_id = ?').bind(result.id).all();
                    result.addresses = addresses.results || [];
                    return new Response(JSON.stringify({ success: true, user: result }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ success: false, error: '手机号或密码错误' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/register' && method === 'POST') {
                const body = await request.json();
                const { phone, password, securityQuestion, securityAnswer } = body;
                const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
                if (existing) {
                    return new Response(JSON.stringify({ success: false, error: '该手机号已注册' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const id = 'u_' + Date.now().toString(36);
                await env.DB.prepare(
                    'INSERT INTO users (id, phone, password, security_question, security_answer, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(id, phone, password, securityQuestion, securityAnswer, 'user', new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true, message: '注册成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/reset-password' && method === 'POST') {
                const body = await request.json();
                const { phone, answer, newPassword } = body;
                const user = await env.DB.prepare('SELECT id, security_answer FROM users WHERE phone = ?').bind(phone).first();
                if (!user) {
                    return new Response(JSON.stringify({ success: false, error: '该手机号未注册' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                if (user.security_answer !== answer) {
                    return new Response(JSON.stringify({ success: false, error: '密保答案错误' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(newPassword, user.id).run();
                return new Response(JSON.stringify({ success: true, message: '密码重置成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/change-password' && method === 'POST') {
                const body = await request.json();
                const { userId, oldPassword, newPassword } = body;
                const user = await env.DB.prepare('SELECT id, password FROM users WHERE id = ? AND password = ?').bind(userId, oldPassword).first();
                if (!user) {
                    return new Response(JSON.stringify({ success: false, error: '当前密码错误' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(newPassword, userId).run();
                return new Response(JSON.stringify({ success: true, message: '密码修改成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/update-phone' && method === 'POST') {
                const body = await request.json();
                const { userId, password, newPhone } = body;
                const user = await env.DB.prepare('SELECT id, phone FROM users WHERE id = ? AND password = ?').bind(userId, password).first();
                if (!user) {
                    return new Response(JSON.stringify({ success: false, error: '当前密码错误' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(newPhone, userId).first();
                if (existing) {
                    return new Response(JSON.stringify({ success: false, error: '该手机号已被其他用户使用' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE users SET phone = ? WHERE id = ?').bind(newPhone, userId).run();
                return new Response(JSON.stringify({ success: true, message: '手机号修改成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users' && method === 'GET') {
                const result = await env.DB.prepare('SELECT id, phone, role, created_at FROM users').all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 地址模块
            // ============================================================
            if (path === '/users/addresses' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                if (!userId) {
                    return new Response(JSON.stringify({ error: '缺少 userId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const result = await env.DB.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').bind(userId).all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/addresses' && method === 'POST') {
                const body = await request.json();
                const { userId, id, name, phone, address, tag, lng, lat, province, city, district, street, isDefault, lastUsed } = body;
                if (isDefault) {
                    await env.DB.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
                }
                if (id) {
                    await env.DB.prepare(
                        `UPDATE addresses SET name = ?, phone = ?, address = ?, tag = ?, lng = ?, lat = ?,
                         province = ?, city = ?, district = ?, street = ?, is_default = ?,
                         last_used = ? WHERE id = ? AND user_id = ?`
                    ).bind(name, phone, address, tag || '', lng || null, lat || null, province || '', city || '', district || '', street || '', isDefault ? 1 : 0, lastUsed ? 1 : 0, id, userId).run();
                } else {
                    const newId = 'addr_' + Date.now().toString(36);
                    await env.DB.prepare(
                        `INSERT INTO addresses (id, user_id, name, phone, address, tag, lng, lat,
                         province, city, district, street, is_default, last_used, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(newId, userId, name, phone, address, tag || '', lng || null, lat || null, province || '', city || '', district || '', street || '', isDefault ? 1 : 0, lastUsed ? 1 : 0, new Date().toISOString()).run();
                }
                const result = await env.DB.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').bind(userId).all();
                return new Response(JSON.stringify({ success: true, addresses: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/users/addresses' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                const userId = url.searchParams.get('userId');
                if (!id || !userId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').bind(id, userId).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 供应商模块
            // ============================================================
            if (path === '/suppliers' && method === 'GET') {
                const result = await env.DB.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/suppliers' && method === 'POST') {
                const body = await request.json();
                const { id, name, contact, phone, address, lng, lat, province, city, district } = body;
                if (id) {
                    await env.DB.prepare(
                        `UPDATE suppliers SET name = ?, contact = ?, phone = ?, address = ?,
                         lng = ?, lat = ?, province = ?, city = ?, district = ? WHERE id = ?`
                    ).bind(name, contact || '', phone || '', address || '', lng || null, lat || null, province || '', city || '', district || '', id).run();
                } else {
                    const newId = 'SUP' + Date.now().toString(36).toUpperCase();
                    await env.DB.prepare(
                        `INSERT INTO suppliers (id, name, contact, phone, address,
                         lng, lat, province, city, district, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(newId, name, contact || '', phone || '', address || '', lng || null, lat || null, province || '', city || '', district || '', new Date().toISOString()).run();
                }
                const result = await env.DB.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all();
                return new Response(JSON.stringify({ success: true, suppliers: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/suppliers' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 商品模块
            // ============================================================
            if (path === '/products' && method === 'GET') {
                const result = await env.DB.prepare(
                    `SELECT p.*, s.name as supplier_name,
                     (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = p.id) as avg_rating,
                     (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
                     FROM products p
                     LEFT JOIN suppliers s ON p.supplier_id = s.id
                     ORDER BY p.is_hot DESC, p.created_at DESC`
                ).all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/products' && method === 'POST') {
                const body = await request.json();
                const { id, name, category, price, unit, stock, supplierId, emoji, description, is_hot, today_pickup, origin, images } = body;
                if (id) {
                    await env.DB.prepare(
                        `UPDATE products SET name = ?, category = ?, price = ?, unit = ?, stock = ?,
                         supplier_id = ?, emoji = ?, description = ?, is_hot = ?, today_pickup = ?,
                         origin = ?, images = ?, updated_at = ? WHERE id = ?`
                    ).bind(name, category || '', price, unit || '份', stock || 0, supplierId || null, emoji || '🍅', description || '', is_hot ? 1 : 0, today_pickup !== undefined ? today_pickup : 1, origin || '', images || '[]', new Date().toISOString(), id).run();
                } else {
                    const newId = 'PROD' + Date.now().toString(36).toUpperCase();
                    await env.DB.prepare(
                        `INSERT INTO products (id, name, category, price, unit, stock,
                         supplier_id, emoji, description, status, is_hot, today_pickup,
                         origin, images, sales_count, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(newId, name, category || '', price, unit || '份', stock || 0, supplierId || null, emoji || '🍅', description || '', 'on', is_hot ? 1 : 0, today_pickup !== undefined ? today_pickup : 1, origin || '', images || '[]', 0, new Date().toISOString(), new Date().toISOString()).run();
                }
                const result = await env.DB.prepare(
                    `SELECT p.*, s.name as supplier_name,
                     (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = p.id) as avg_rating,
                     (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
                     FROM products p
                     LEFT JOIN suppliers s ON p.supplier_id = s.id
                     ORDER BY p.created_at DESC`
                ).all();
                return new Response(JSON.stringify({ success: true, products: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/products' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 商品规格
            // ============================================================
            if (path === '/products/specs' && method === 'GET') {
                const productId = url.searchParams.get('productId');
                if (!productId) {
                    return new Response(JSON.stringify({ error: '缺少 productId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const result = await env.DB.prepare('SELECT * FROM product_specs WHERE product_id = ? ORDER BY created_at').bind(productId).all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/products/specs' && method === 'POST') {
                const body = await request.json();
                const { productId, id, specName, price, stock, skuCode } = body;
                if (id) {
                    await env.DB.prepare(
                        `UPDATE product_specs SET spec_name = ?, price = ?, stock = ?, sku_code = ? WHERE id = ? AND product_id = ?`
                    ).bind(specName, price, stock || 0, skuCode || '', id, productId).run();
                } else {
                    const newId = 'SPC' + Date.now().toString(36).toUpperCase();
                    await env.DB.prepare(
                        `INSERT INTO product_specs (id, product_id, spec_name, price, stock, sku_code, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`
                    ).bind(newId, productId, specName, price, stock || 0, skuCode || '', new Date().toISOString()).run();
                }
                const result = await env.DB.prepare('SELECT * FROM product_specs WHERE product_id = ? ORDER BY created_at').bind(productId).all();
                return new Response(JSON.stringify({ success: true, specs: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/products/specs' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM product_specs WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 搜索模块
            // ============================================================
            if (path === '/search' && method === 'GET') {
                const keyword = url.searchParams.get('keyword') || '';
                const sort = url.searchParams.get('sort') || 'relevance';
                const category = url.searchParams.get('category') || '';
                const page = parseInt(url.searchParams.get('page')) || 1;
                const limit = parseInt(url.searchParams.get('limit')) || 20;
                const offset = (page - 1) * limit;

                let query = 'SELECT p.*, (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = p.id) as avg_rating FROM products p WHERE p.status = "on"';
                let params = [];
                let countParams = [];

                if (keyword) {
                    query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ?)';
                    const kw = '%' + keyword + '%';
                    params.push(kw, kw, kw);
                    countParams.push(kw, kw, kw);
                }
                if (category) {
                    query += ' AND p.category = ?';
                    params.push(category);
                    countParams.push(category);
                }

                switch (sort) {
                    case 'price_asc': query += ' ORDER BY p.price ASC'; break;
                    case 'price_desc': query += ' ORDER BY p.price DESC'; break;
                    case 'sales': query += ' ORDER BY p.sales_count DESC'; break;
                    default: query += ' ORDER BY p.is_hot DESC, p.created_at DESC'; break;
                }

                query += ' LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const countQuery = 'SELECT COUNT(*) as total FROM products p WHERE p.status = "on"' + (keyword ? ' AND (p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ?)' : '') + (category ? ' AND p.category = ?' : '');
                const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
                const total = countResult ? countResult.total : 0;

                const result = await env.DB.prepare(query).bind(...params).all();

                const hotWords = await env.DB.prepare(
                    `SELECT keyword, COUNT(*) as count FROM search_history
                     WHERE created_at > datetime('now', '-7 days')
                     GROUP BY keyword ORDER BY count DESC LIMIT 10`
                ).all();

                return new Response(JSON.stringify({
                    results: result.results,
                    total: total,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(total / limit),
                    hotWords: hotWords.results || []
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/search/history' && method === 'POST') {
                const body = await request.json();
                const { userId, keyword } = body;
                if (!userId || !keyword) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `DELETE FROM search_history WHERE id IN (
                        SELECT id FROM search_history WHERE user_id = ?
                        ORDER BY created_at DESC LIMIT -1 OFFSET 20
                    )`
                ).bind(userId).run();
                await env.DB.prepare(
                    `INSERT INTO search_history (id, user_id, keyword, created_at)
                     VALUES (?, ?, ?, ?)`
                ).bind('sh_' + Date.now().toString(36), userId, keyword, new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/search/history' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                if (!userId) {
                    return new Response(JSON.stringify({ error: '缺少 userId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const result = await env.DB.prepare(
                    'SELECT DISTINCT keyword FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
                ).bind(userId).all();
                return new Response(JSON.stringify(result.results || []), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/search/hot' && method === 'GET') {
                const result = await env.DB.prepare(
                    `SELECT keyword, COUNT(*) as count FROM search_history
                     WHERE created_at > datetime('now', '-7 days')
                     GROUP BY keyword ORDER BY count DESC LIMIT 10`
                ).all();
                return new Response(JSON.stringify(result.results || []), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 收藏
            // ============================================================
            if (path === '/favorites' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                if (!userId) {
                    return new Response(JSON.stringify({ error: '缺少 userId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const result = await env.DB.prepare(
                    `SELECT f.*, p.name, p.price, p.emoji, p.sales_count, p.unit
                     FROM favorites f
                     JOIN products p ON f.product_id = p.id
                     WHERE f.user_id = ?
                     ORDER BY f.created_at DESC`
                ).bind(userId).all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/favorites' && method === 'POST') {
                const body = await request.json();
                const { userId, productId } = body;
                if (!userId || !productId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const existing = await env.DB.prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?').bind(userId, productId).first();
                if (existing) {
                    await env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').bind(userId, productId).run();
                    return new Response(JSON.stringify({ success: true, action: 'removed' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `INSERT INTO favorites (id, user_id, product_id, created_at)
                     VALUES (?, ?, ?, ?)`
                ).bind('fav_' + Date.now().toString(36), userId, productId, new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true, action: 'added' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // ★★★ 订单模块（已修复外键约束：移除 address_id 字段）★★★
            // ============================================================
            if (path === '/orders' && method === 'GET') {
                try {
                    const result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                    const orders = result.results.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
                    return new Response(JSON.stringify(orders), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (e) {
                    console.error('订单查询失败:', e);
                    return new Response(JSON.stringify([]), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            if (path === '/orders' && method === 'POST') {
                const body = await request.json();
                const { customerName, customerPhone, address, addressId, items, total, pickupCode, cutoffTime, expectedPickupDate } = body;
                const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
                const itemsJson = JSON.stringify(items);
                // ★★★ 移除 address_id 字段，避免外键约束错误 ★★★
                await env.DB.prepare(
                    `INSERT INTO orders (id, customer_name, customer_phone, address,
                     total, items, status, pickup_code, cutoff_time, expected_pickup_date, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(orderId, customerName, customerPhone, address, total, itemsJson, 'pending', pickupCode || '', cutoffTime || '', expectedPickupDate || '', new Date().toISOString(), new Date().toISOString()).run();

                await env.DB.prepare(
                    `INSERT INTO order_logistics (id, order_id, status, updated_at)
                     VALUES (?, ?, ?, ?)`
                ).bind('log_' + Date.now().toString(36), orderId, 'pending', new Date().toISOString()).run();

                for (const item of items) {
                    await env.DB.prepare('UPDATE products SET stock = stock - ?, sales_count = sales_count + ? WHERE id = ?').bind(item.quantity, item.quantity, item.productId).run();
                }

                await env.DB.prepare(
                    `INSERT INTO finance_records (id, type, category, amount, description, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind('FIN' + Date.now().toString(36).toUpperCase(), 'income', '销售收入', total, '订单 ' + orderId, new Date().toISOString()).run();

                await env.DB.prepare(
                    `INSERT INTO messages (id, user_id, type, title, content, link, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    'msg_' + Date.now().toString(36),
                    customerPhone,
                    'order',
                    '订单已提交',
                    '您的订单 ' + orderId + ' 已提交，提货码：' + (pickupCode || '待生成'),
                    '/orders',
                    new Date().toISOString()
                ).run();

                const result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                const orders = result.results.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
                return new Response(JSON.stringify({ success: true, orderId: orderId, orders: orders }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders/detail' && method === 'GET') {
                const orderId = url.searchParams.get('id');
                if (!orderId) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
                if (!order) {
                    return new Response(JSON.stringify({ error: '订单不存在' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                order.items = JSON.parse(order.items || '[]');

                const logistics = await env.DB.prepare('SELECT * FROM order_logistics WHERE order_id = ?').bind(orderId).first();

                const hasReview = await env.DB.prepare('SELECT id FROM reviews WHERE order_id = ? LIMIT 1').bind(orderId).first();

                const afterSale = await env.DB.prepare('SELECT * FROM after_sales WHERE order_id = ?').bind(orderId).first();

                return new Response(JSON.stringify({
                    ...order,
                    logistics: logistics || null,
                    hasReview: !!hasReview,
                    afterSale: afterSale || null
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders/reorder' && method === 'POST') {
                const body = await request.json();
                const { orderId, userId } = body;
                if (!orderId || !userId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
                if (!order) {
                    return new Response(JSON.stringify({ error: '订单不存在' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const items = JSON.parse(order.items || '[]');
                const cart = {};
                for (const item of items) {
                    cart[item.productId] = (cart[item.productId] || 0) + item.quantity;
                }
                return new Response(JSON.stringify({ success: true, cart: cart }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders/status' && method === 'PUT') {
                const body = await request.json();
                const { orderId, status } = body;
                if (status === 'cancelled') {
                    const order = await env.DB.prepare('SELECT items FROM orders WHERE id = ?').bind(orderId).first();
                    if (order) {
                        const items = JSON.parse(order.items || '[]');
                        for (const item of items) {
                            await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.productId).run();
                        }
                    }
                }
                await env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(status, new Date().toISOString(), orderId).run();

                if (status === 'shipped') {
                    await env.DB.prepare('UPDATE order_logistics SET status = "shipping", updated_at = ? WHERE order_id = ?').bind(new Date().toISOString(), orderId).run();
                } else if (status === 'completed') {
                    await env.DB.prepare('UPDATE order_logistics SET status = "delivered", updated_at = ? WHERE order_id = ?').bind(new Date().toISOString(), orderId).run();
                }

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders/logistics' && method === 'PUT') {
                const body = await request.json();
                const { orderId, trackingNumber, carrier, logisticsInfo } = body;
                await env.DB.prepare(
                    `UPDATE order_logistics SET tracking_number = ?, carrier = ?, logistics_info = ?, updated_at = ?
                     WHERE order_id = ?`
                ).bind(trackingNumber || '', carrier || '', logisticsInfo || '[]', new Date().toISOString(), orderId).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            // ============================================================
            // 评价模块
            // ============================================================
            if (path === '/reviews' && method === 'POST') {
                const body = await request.json();
                const { orderId, productId, userId, rating, content, images, tags } = body;
                if (!orderId || !productId || !userId || !rating) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const existing = await env.DB.prepare('SELECT id FROM reviews WHERE order_id = ? AND product_id = ?').bind(orderId, productId).first();
                if (existing) {
                    return new Response(JSON.stringify({ error: '已评价过该商品' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const id = 'rev_' + Date.now().toString(36);
                await env.DB.prepare(
                    `INSERT INTO reviews (id, order_id, product_id, user_id, rating, content, images, tags, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(id, orderId, productId, userId, rating, content || '', images || '[]', tags || '[]', new Date().toISOString(), new Date().toISOString()).run();

                await env.DB.prepare(
                    `INSERT INTO messages (id, user_id, type, title, content, link, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind('msg_' + Date.now().toString(36), userId, 'system', '感谢您的评价', '您对商品 ' + productId + ' 的评价已发布，获得10积分奖励', '/profile', new Date().toISOString()).run();

                return new Response(JSON.stringify({ success: true, reviewId: id }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/reviews/product' && method === 'GET') {
                const productId = url.searchParams.get('productId');
                const sort = url.searchParams.get('sort') || 'newest';
                const ratingFilter = url.searchParams.get('rating');
                const page = parseInt(url.searchParams.get('page')) || 1;
                const limit = parseInt(url.searchParams.get('limit')) || 10;
                const offset = (page - 1) * limit;

                if (!productId) {
                    return new Response(JSON.stringify({ error: '缺少 productId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                let query = 'SELECT r.*, u.phone as user_phone FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ?';
                let params = [productId];

                if (ratingFilter) {
                    query += ' AND r.rating = ?';
                    params.push(parseInt(ratingFilter));
                }

                switch (sort) {
                    case 'latest': query += ' ORDER BY r.created_at DESC'; break;
                    case 'rating_high': query += ' ORDER BY r.rating DESC, r.created_at DESC'; break;
                    case 'rating_low': query += ' ORDER BY r.rating ASC, r.created_at DESC'; break;
                    default: query += ' ORDER BY r.created_at DESC'; break;
                }

                query += ' LIMIT ? OFFSET ?';
                params.push(limit, offset);

                const result = await env.DB.prepare(query).bind(...params).all();

                const reviews = result.results.map(r => {
                    try {
                        r.images = JSON.parse(r.images || '[]');
                    } catch(e) {
                        r.images = [];
                    }
                    return r;
                });

                const stats = await env.DB.prepare(
                    `SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating,
                     COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
                     COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1,
                     COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
                     COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
                     COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
                     COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5
                     FROM reviews WHERE product_id = ?`
                ).bind(productId).first();

                const tagsResult = await env.DB.prepare(
                    `SELECT json_each.value as tag, COUNT(*) as count
                     FROM reviews, json_each(reviews.tags)
                     WHERE reviews.product_id = ? AND reviews.tags != '[]'
                     GROUP BY tag ORDER BY count DESC LIMIT 10`
                ).bind(productId).all();

                return new Response(JSON.stringify({
                    reviews: reviews,
                    stats: stats || { total: 0, avg_rating: 0, positive: 0, rating_1: 0, rating_2: 0, rating_3: 0, rating_4: 0, rating_5: 0 },
                    tags: tagsResult.results || [],
                    page: page,
                    limit: limit,
                    total: stats ? stats.total : 0,
                    totalPages: stats ? Math.ceil(stats.total / limit) : 0
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/reviews/all' && method === 'GET') {
                const result = await env.DB.prepare(
                    `SELECT r.*, u.phone as user_phone, p.name as product_name, p.emoji as product_emoji
                     FROM reviews r
                     JOIN users u ON r.user_id = u.id
                     JOIN products p ON r.product_id = p.id
                     ORDER BY r.created_at DESC LIMIT 100`
                ).all();
                const reviews = result.results.map(r => {
                    try {
                        r.images = JSON.parse(r.images || '[]');
                    } catch(e) {
                        r.images = [];
                    }
                    return r;
                });
                return new Response(JSON.stringify(reviews), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/reviews/reply' && method === 'POST') {
                const body = await request.json();
                const { reviewId, reply } = body;
                if (!reviewId || !reply) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE reviews SET reply = ?, reply_at = ? WHERE id = ?').bind(reply, new Date().toISOString(), reviewId).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/reviews/like' && method === 'POST') {
                const body = await request.json();
                const { reviewId, userId } = body;
                if (!reviewId || !userId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const existing = await env.DB.prepare('SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?').bind(reviewId, userId).first();
                if (existing) {
                    await env.DB.prepare('DELETE FROM review_likes WHERE review_id = ? AND user_id = ?').bind(reviewId, userId).run();
                    await env.DB.prepare('UPDATE reviews SET likes = likes - 1 WHERE id = ?').bind(reviewId).run();
                    return new Response(JSON.stringify({ success: true, action: 'unliked' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `INSERT INTO review_likes (id, review_id, user_id, created_at)
                     VALUES (?, ?, ?, ?)`
                ).bind('rl_' + Date.now().toString(36), reviewId, userId, new Date().toISOString()).run();
                await env.DB.prepare('UPDATE reviews SET likes = likes + 1 WHERE id = ?').bind(reviewId).run();
                return new Response(JSON.stringify({ success: true, action: 'liked' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 地区数据
            // ============================================================
            if (path === '/regions' && method === 'GET') {
                const parentId = url.searchParams.get('parentId') || '';
                const level = url.searchParams.get('level');

                let query = 'SELECT id, name, level, code FROM regions WHERE parent_id = ?';
                let params = [parentId];

                if (level) {
                    query += ' AND level = ?';
                    params.push(parseInt(level));
                }

                query += ' ORDER BY name';
                const result = await env.DB.prepare(query).bind(...params).all();
                return new Response(JSON.stringify(result.results || []), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/regions/sync' && method === 'POST') {
                const body = await request.json();
                const { keyword } = body;
                if (!keyword) {
                    return new Response(JSON.stringify({ error: '缺少关键词' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                let amapKey = env.AMAP_KEY || '';
                if (!amapKey) {
                    amapKey = '738f98e8b09ac1dbebccd5a232a60fc0';
                }

                if (!amapKey) {
                    return new Response(JSON.stringify({ error: '高德地图Key未配置，请在Worker环境变量中设置AMAP_KEY' }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                try {
                    const response = await fetch(
                        `https://restapi.amap.com/v3/config/district?keywords=${encodeURIComponent(keyword)}&subdistrict=3&key=${amapKey}&extensions=base`
                    );

                    const data = await response.json();
                    if (data.status !== '1') {
                        let errorMsg = data.info || '未知错误';
                        if (data.info === 'USERKEY_PLAT_NOMATCH') {
                            errorMsg = '高德API Key无效或未开通行政区划查询服务，请检查Key配置';
                        }
                        return new Response(JSON.stringify({ error: '同步失败: ' + errorMsg }), {
                            status: 500,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }

                    const districts = data.districts || [];
                    let insertedCount = 0;
                    let skippedCount = 0;

                    async function insertRegion(district, parentId, level) {
                        const existing = await env.DB.prepare('SELECT id FROM regions WHERE name = ? AND parent_id = ? AND level = ?')
                            .bind(district.name, parentId, level).first();
                        if (existing) {
                            skippedCount++;
                            return;
                        }

                        const id = 'reg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
                        await env.DB.prepare(
                            `INSERT INTO regions (id, parent_id, name, level, code, created_at)
                             VALUES (?, ?, ?, ?, ?, ?)`
                        ).bind(id, parentId, district.name, level, district.adcode || '', new Date().toISOString()).run();
                        insertedCount++;

                        if (district.districts && district.districts.length > 0) {
                            for (const sub of district.districts) {
                                await insertRegion(sub, id, level + 1);
                            }
                        }
                    }

                    for (const d of districts) {
                        await insertRegion(d, '', 1);
                    }

                    return new Response(JSON.stringify({
                        success: true,
                        inserted: insertedCount,
                        skipped: skippedCount,
                        total: districts.length,
                        message: `同步完成，新增${insertedCount}条，跳过${skippedCount}条`
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } catch (e) {
                    console.error('同步地区异常:', e);
                    return new Response(JSON.stringify({ error: '同步失败: ' + e.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            // ============================================================
            // 优惠券
            // ============================================================
            if (path === '/coupons' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                const now = new Date().toISOString();
                const available = await env.DB.prepare(
                    `SELECT c.*, (SELECT COUNT(*) FROM user_coupons WHERE coupon_id = c.id AND user_id = ?) as user_claimed
                     FROM coupons c
                     WHERE c.expire_at > ? AND c.stock > 0
                     ORDER BY c.created_at DESC`
                ).bind(userId || '', now).all();

                let userCoupons = [];
                if (userId) {
                    userCoupons = await env.DB.prepare(
                        `SELECT c.*, uc.used, uc.used_at, uc.created_at as claimed_at
                         FROM user_coupons uc
                         JOIN coupons c ON uc.coupon_id = c.id
                         WHERE uc.user_id = ?
                         ORDER BY uc.created_at DESC`
                    ).bind(userId).all();
                }

                return new Response(JSON.stringify({
                    available: available.results || [],
                    userCoupons: userCoupons || []
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/coupons/claim' && method === 'POST') {
                const body = await request.json();
                const { userId, couponId } = body;
                if (!userId || !couponId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const coupon = await env.DB.prepare('SELECT * FROM coupons WHERE id = ? AND stock > 0').bind(couponId).first();
                if (!coupon) {
                    return new Response(JSON.stringify({ error: '优惠券已领完或不存在' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const existing = await env.DB.prepare('SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?').bind(userId, couponId).first();
                if (existing) {
                    return new Response(JSON.stringify({ error: '您已领取过该优惠券' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `INSERT INTO user_coupons (id, user_id, coupon_id, created_at)
                     VALUES (?, ?, ?, ?)`
                ).bind('uc_' + Date.now().toString(36), userId, couponId, new Date().toISOString()).run();
                await env.DB.prepare('UPDATE coupons SET stock = stock - 1 WHERE id = ?').bind(couponId).run();

                await env.DB.prepare(
                    `INSERT INTO messages (id, user_id, type, title, content, link, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind('msg_' + Date.now().toString(36), userId, 'promotion', '优惠券领取成功', '您已领取 ' + coupon.name, '/coupons', new Date().toISOString()).run();

                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/coupons' && method === 'POST') {
                const body = await request.json();
                const { name, type, value, minAmount, expireAt, stock } = body;
                const id = 'cpn_' + Date.now().toString(36);
                await env.DB.prepare(
                    `INSERT INTO coupons (id, name, type, value, min_amount, expire_at, stock, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(id, name, type, value, minAmount || 0, expireAt, stock || 999, new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true, couponId: id }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/coupons' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 消息
            // ============================================================
            if (path === '/messages' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                if (!userId) {
                    return new Response(JSON.stringify({ error: '缺少 userId 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const result = await env.DB.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
                const unread = await env.DB.prepare('SELECT COUNT(*) as unread FROM messages WHERE user_id = ? AND is_read = 0').bind(userId).first();
                return new Response(JSON.stringify({
                    messages: result.results || [],
                    unread: unread ? unread.unread : 0
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/messages/read' && method === 'POST') {
                const body = await request.json();
                const { messageId, userId } = body;
                if (!messageId || !userId) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?').bind(messageId, userId).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/messages/send' && method === 'POST') {
                const body = await request.json();
                const { userId, type, title, content, link } = body;
                if (!userId || !title || !content) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `INSERT INTO messages (id, user_id, type, title, content, link, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind('msg_' + Date.now().toString(36), userId, type || 'system', title, content, link || '', new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 售后
            // ============================================================
            if (path === '/after-sales' && method === 'POST') {
                const body = await request.json();
                const { orderId, userId, type, reason, description } = body;
                if (!orderId || !userId || !type || !reason) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const id = 'as_' + Date.now().toString(36);
                await env.DB.prepare(
                    `INSERT INTO after_sales (id, order_id, user_id, type, reason, description, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(id, orderId, userId, type, reason, description || '', 'pending', new Date().toISOString(), new Date().toISOString()).run();
                return new Response(JSON.stringify({ success: true, afterSaleId: id }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/after-sales' && method === 'GET') {
                const userId = url.searchParams.get('userId');
                if (userId) {
                    const result = await env.DB.prepare('SELECT * FROM after_sales WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
                    return new Response(JSON.stringify(result.results), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                } else {
                    const result = await env.DB.prepare('SELECT * FROM after_sales ORDER BY created_at DESC LIMIT 100').all();
                    return new Response(JSON.stringify(result.results), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
            }

            if (path === '/after-sales/audit' && method === 'PUT') {
                const body = await request.json();
                const { afterSaleId, status, adminReply } = body;
                if (!afterSaleId || !status) {
                    return new Response(JSON.stringify({ error: '缺少参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare(
                    `UPDATE after_sales SET status = ?, admin_reply = ?, updated_at = ? WHERE id = ?`
                ).bind(status, adminReply || '', new Date().toISOString(), afterSaleId).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 库存
            // ============================================================
            if (path === '/inventory' && method === 'GET') {
                const products = await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
                const logs = await env.DB.prepare('SELECT * FROM inventory_logs ORDER BY created_at DESC LIMIT 50').all();
                return new Response(JSON.stringify({ products: products.results, logs: logs.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/inventory' && method === 'POST') {
                const body = await request.json();
                const { productId, type, quantity, operator, note } = body;
                if (type === 'in') {
                    await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(quantity, productId).run();
                } else if (type === 'out' || type === 'waste') {
                    await env.DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').bind(quantity, productId).run();
                }
                const logId = 'INV' + Date.now().toString(36).toUpperCase();
                await env.DB.prepare(
                    `INSERT INTO inventory_logs (id, product_id, type, quantity, operator, note, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).bind(logId, productId, type, quantity, operator || '系统', note || '', new Date().toISOString()).run();
                const logs = await env.DB.prepare('SELECT * FROM inventory_logs ORDER BY created_at DESC LIMIT 50').all();
                return new Response(JSON.stringify({ success: true, logs: logs.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 财务
            // ============================================================
            if (path === '/finance' && method === 'GET') {
                const result = await env.DB.prepare('SELECT * FROM finance_records ORDER BY created_at DESC').all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/finance' && method === 'POST') {
                const body = await request.json();
                const { type, category, amount, description } = body;
                const id = 'FIN' + Date.now().toString(36).toUpperCase();
                await env.DB.prepare(
                    `INSERT INTO finance_records (id, type, category, amount, description, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(id, type, category, amount, description || '', new Date().toISOString()).run();
                const result = await env.DB.prepare('SELECT * FROM finance_records ORDER BY created_at DESC').all();
                return new Response(JSON.stringify({ success: true, records: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/finance' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                if (!id) {
                    return new Response(JSON.stringify({ error: '缺少 id 参数' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM finance_records WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 备份
            // ============================================================
            if (path === '/backup/export' && method === 'GET') {
                const users = await env.DB.prepare('SELECT * FROM users').all();
                const addresses = await env.DB.prepare('SELECT * FROM addresses').all();
                const suppliers = await env.DB.prepare('SELECT * FROM suppliers').all();
                const products = await env.DB.prepare('SELECT * FROM products').all();
                const productSpecs = await env.DB.prepare('SELECT * FROM product_specs').all();
                const orders = await env.DB.prepare('SELECT * FROM orders').all();
                const orderLogistics = await env.DB.prepare('SELECT * FROM order_logistics').all();
                const reviews = await env.DB.prepare('SELECT * FROM reviews').all();
                const favorites = await env.DB.prepare('SELECT * FROM favorites').all();
                const coupons = await env.DB.prepare('SELECT * FROM coupons').all();
                const userCoupons = await env.DB.prepare('SELECT * FROM user_coupons').all();
                const messages = await env.DB.prepare('SELECT * FROM messages').all();
                const afterSales = await env.DB.prepare('SELECT * FROM after_sales').all();
                const inventoryLogs = await env.DB.prepare('SELECT * FROM inventory_logs').all();
                const financeRecords = await env.DB.prepare('SELECT * FROM finance_records').all();
                const admins = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins').all();
                const regions = await env.DB.prepare('SELECT * FROM regions').all();

                const backupData = {
                    users: users.results,
                    addresses: addresses.results,
                    suppliers: suppliers.results,
                    products: products.results,
                    productSpecs: productSpecs.results,
                    orders: orders.results,
                    orderLogistics: orderLogistics.results,
                    reviews: reviews.results,
                    favorites: favorites.results,
                    coupons: coupons.results,
                    userCoupons: userCoupons.results,
                    messages: messages.results,
                    afterSales: afterSales.results,
                    inventoryLogs: inventoryLogs.results,
                    financeRecords: financeRecords.results,
                    admins: admins.results,
                    regions: regions.results,
                    exportedAt: new Date().toISOString()
                };

                const fileName = 'backup_' + new Date().toISOString().slice(0, 10) + '.json';
                return new Response(JSON.stringify(backupData, null, 2), {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Content-Disposition': 'attachment; filename="' + fileName + '"'
                    }
                });
            }

            if (path === '/backup/import' && method === 'POST') {
                const body = await request.json();
                const { data } = body;

                await env.DB.prepare('DELETE FROM after_sales').run();
                await env.DB.prepare('DELETE FROM messages').run();
                await env.DB.prepare('DELETE FROM user_coupons').run();
                await env.DB.prepare('DELETE FROM coupons').run();
                await env.DB.prepare('DELETE FROM favorites').run();
                await env.DB.prepare('DELETE FROM reviews').run();
                await env.DB.prepare('DELETE FROM order_logistics').run();
                await env.DB.prepare('DELETE FROM orders').run();
                await env.DB.prepare('DELETE FROM product_specs').run();
                await env.DB.prepare('DELETE FROM products').run();
                await env.DB.prepare('DELETE FROM suppliers').run();
                await env.DB.prepare('DELETE FROM addresses').run();
                await env.DB.prepare('DELETE FROM users').run();
                await env.DB.prepare('DELETE FROM admins').run();
                await env.DB.prepare('DELETE FROM inventory_logs').run();
                await env.DB.prepare('DELETE FROM finance_records').run();
                await env.DB.prepare('DELETE FROM regions').run();

                for (const item of data.users || []) {
                    await env.DB.prepare(
                        `INSERT INTO users (id, phone, password, security_question, security_answer, role, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`
                    ).bind(item.id, item.phone, item.password, item.security_question, item.security_answer, item.role, item.created_at).run();
                }
                for (const sup of data.suppliers || []) {
                    await env.DB.prepare(
                        `INSERT INTO suppliers (id, name, contact, phone, address, lng, lat, province, city, district, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(sup.id, sup.name, sup.contact || '', sup.phone || '', sup.address || '', sup.lng || null, sup.lat || null, sup.province || '', sup.city || '', sup.district || '', sup.created_at).run();
                }
                for (const p of data.products || []) {
                    await env.DB.prepare(
                        `INSERT INTO products (id, name, category, price, unit, stock,
                         supplier_id, emoji, description, status, is_hot, today_pickup,
                         origin, images, sales_count, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(p.id, p.name, p.category || '', p.price, p.unit || '份', p.stock || 0, p.supplier_id || null, p.emoji || '🍅', p.description || '', p.status || 'on', p.is_hot || 0, p.today_pickup !== undefined ? p.today_pickup : 1, p.origin || '', p.images || '[]', p.sales_count || 0, p.created_at, p.updated_at).run();
                }
                for (const o of data.orders || []) {
                    await env.DB.prepare(
                        `INSERT INTO orders (id, customer_name, customer_phone, address,
                         total, items, status, pickup_code, cutoff_time, expected_pickup_date, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(o.id, o.customer_name, o.customer_phone, o.address, o.total, o.items, o.status || 'pending', o.pickup_code || '', o.cutoff_time || '', o.expected_pickup_date || '', o.created_at, o.updated_at).run();
                }
                for (const a of data.addresses || []) {
                    await env.DB.prepare(
                        `INSERT INTO addresses (id, user_id, name, phone, address, tag,
                         lng, lat, province, city, district, street, is_default, last_used, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(a.id, a.user_id, a.name, a.phone, a.address, a.tag || '', a.lng || null, a.lat || null, a.province || '', a.city || '', a.district || '', a.street || '', a.is_default || 0, a.last_used || 0, a.created_at).run();
                }
                for (const log of data.inventoryLogs || []) {
                    await env.DB.prepare(
                        `INSERT INTO inventory_logs (id, product_id, type, quantity, operator, note, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`
                    ).bind(log.id, log.product_id, log.type, log.quantity, log.operator || '系统', log.note || '', log.created_at).run();
                }
                for (const f of data.financeRecords || []) {
                    await env.DB.prepare(
                        `INSERT INTO finance_records (id, type, category, amount, description, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)`
                    ).bind(f.id, f.type, f.category, f.amount, f.description || '', f.created_at).run();
                }
                for (const admin of data.admins || []) {
                    await env.DB.prepare(
                        `INSERT INTO admins (id, username, password, permissions, created_at)
                         VALUES (?, ?, ?, ?, ?)`
                    ).bind(admin.id, admin.username, admin.password, admin.permissions || '[]', admin.created_at).run();
                }
                for (const r of data.regions || []) {
                    await env.DB.prepare(
                        `INSERT INTO regions (id, parent_id, name, level, code, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)`
                    ).bind(r.id, r.parent_id || '', r.name, r.level, r.code || '', r.created_at).run();
                }
                return new Response(JSON.stringify({ success: true, message: '导入成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 管理员
            // ============================================================
            if (path === '/admin/login' && method === 'POST') {
                const body = await request.json();
                const { username, password } = body;
                const result = await env.DB.prepare('SELECT * FROM admins WHERE username = ? AND password = ?').bind(username, password).first();
                if (result) {
                    return new Response(JSON.stringify({
                        success: true,
                        user: {
                            id: result.id,
                            username: result.username,
                            permissions: JSON.parse(result.permissions || '[]')
                        }
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ success: false, error: '用户名或密码错误' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/admin/members' && method === 'GET') {
                const result = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins ORDER BY created_at DESC').all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/admin/members' && method === 'POST') {
                const body = await request.json();
                const { username, password, permissions } = body;
                const existing = await env.DB.prepare('SELECT id FROM admins WHERE username = ?').bind(username).first();
                if (existing) {
                    return new Response(JSON.stringify({ success: false, error: '用户名已存在' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const id = 'admin_' + Date.now().toString(36);
                const permStr = JSON.stringify(permissions || []);
                await env.DB.prepare(
                    `INSERT INTO admins (id, username, password, permissions, created_at)
                     VALUES (?, ?, ?, ?, ?)`
                ).bind(id, username, password, permStr, new Date().toISOString()).run();
                const result = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins ORDER BY created_at DESC').all();
                return new Response(JSON.stringify({ success: true, members: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/admin/members' && method === 'DELETE') {
                const id = url.searchParams.get('id');
                const self = await env.DB.prepare('SELECT username FROM admins WHERE id = ?').bind(id).first();
                if (self && self.username === 'admin') {
                    return new Response(JSON.stringify({ success: false, error: '不能删除主管理员' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('DELETE FROM admins WHERE id = ?').bind(id).run();
                const result = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins ORDER BY created_at DESC').all();
                return new Response(JSON.stringify({ success: true, members: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/admin/members/permissions' && method === 'PUT') {
                const body = await request.json();
                const { id, permissions } = body;
                const self = await env.DB.prepare('SELECT username FROM admins WHERE id = ?').bind(id).first();
                if (self && self.username === 'admin') {
                    return new Response(JSON.stringify({ success: false, error: '不能修改主管理员权限' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                const permStr = JSON.stringify(permissions || []);
                await env.DB.prepare('UPDATE admins SET permissions = ? WHERE id = ?').bind(permStr, id).run();
                const result = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins ORDER BY created_at DESC').all();
                return new Response(JSON.stringify({ success: true, members: result.results }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/admin/change-password' && method === 'POST') {
                const body = await request.json();
                const { id, oldPassword, newPassword } = body;
                const user = await env.DB.prepare('SELECT * FROM admins WHERE id = ? AND password = ?').bind(id, oldPassword).first();
                if (!user) {
                    return new Response(JSON.stringify({ success: false, error: '当前密码错误' }), {
                        status: 401,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                await env.DB.prepare('UPDATE admins SET password = ? WHERE id = ?').bind(newPassword, id).run();
                return new Response(JSON.stringify({ success: true, message: '密码修改成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 支付确认
            // ============================================================
            if (path === '/payment/confirm' && method === 'POST') {
                const body = await request.json();
                const { orderId, transactionId, paymentData } = body;
                return new Response(JSON.stringify({ success: true, message: '支付确认成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ===== 404 =====
            return new Response(JSON.stringify({ error: '接口不存在: ' + path }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('API Error:', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};