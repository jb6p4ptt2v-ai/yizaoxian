// ============================================================
// 宜早鲜 Cloudflare Workers API - 完整版
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
            // ===== 测试路由 =====
            if (path === '/test' && method === 'GET') {
                return new Response('Worker is alive!', { headers: corsHeaders });
            }

            // ============================================================
            // 用户登录
            // ============================================================
            if (path === '/users/login' && method === 'POST') {
                const body = await request.json();
                const { phone, password } = body;
                const result = await env.DB.prepare(
                    'SELECT * FROM users WHERE phone = ? AND password = ?'
                ).bind(phone, password).first();
                if (result) {
                    const addresses = await env.DB.prepare(
                        'SELECT * FROM addresses WHERE user_id = ?'
                    ).bind(result.id).all();
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

            // ===== 用户注册 =====
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

            // ===== 重置密码 =====
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

            // ===== 修改密码 =====
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

            // ===== 修改手机号 =====
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

            // ===== 获取用户列表 =====
            if (path === '/users' && method === 'GET') {
                const result = await env.DB.prepare('SELECT id, phone, role, created_at FROM users').all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 地址管理
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
            // 供应商管理
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
            // 商品管理
            // ============================================================
            if (path === '/products' && method === 'GET') {
                const result = await env.DB.prepare(
                    `SELECT p.*, s.name as supplier_name
                     FROM products p
                     LEFT JOIN suppliers s ON p.supplier_id = s.id
                     ORDER BY p.created_at DESC`
                ).all();
                return new Response(JSON.stringify(result.results), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/products' && method === 'POST') {
                const body = await request.json();
                const { id, name, category, price, unit, stock, supplierId, emoji, description } = body;
                if (id) {
                    await env.DB.prepare(
                        `UPDATE products SET name = ?, category = ?, price = ?, unit = ?, stock = ?,
                         supplier_id = ?, emoji = ?, description = ?, updated_at = ? WHERE id = ?`
                    ).bind(name, category || '', price, unit || '份', stock || 0, supplierId || null, emoji || '🥬', description || '', new Date().toISOString(), id).run();
                } else {
                    const newId = 'PROD' + Date.now().toString(36).toUpperCase();
                    await env.DB.prepare(
                        `INSERT INTO products (id, name, category, price, unit, stock,
                         supplier_id, emoji, description, status, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(newId, name, category || '', price, unit || '份', stock || 0, supplierId || null, emoji || '🥬', description || '', 'on', new Date().toISOString(), new Date().toISOString()).run();
                }
                const result = await env.DB.prepare(
                    `SELECT p.*, s.name as supplier_name
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
            // 订单管理
            // ============================================================
            if (path === '/orders' && method === 'GET') {
                const result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                const orders = result.results.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
                return new Response(JSON.stringify(orders), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            if (path === '/orders' && method === 'POST') {
                const body = await request.json();
                const { customerName, customerPhone, address, addressId, items, total } = body;
                const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
                const itemsJson = JSON.stringify(items);
                await env.DB.prepare(
                    `INSERT INTO orders (id, customer_name, customer_phone, address, address_id,
                     total, items, status, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(orderId, customerName, customerPhone, address, addressId || null, total, itemsJson, 'pending', new Date().toISOString(), new Date().toISOString()).run();
                for (const item of items) {
                    await env.DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').bind(item.quantity, item.productId).run();
                }
                await env.DB.prepare(
                    `INSERT INTO finance_records (id, type, category, amount, description, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind('FIN' + Date.now().toString(36).toUpperCase(), 'income', '销售收入', total, '订单 ' + orderId, new Date().toISOString()).run();
                const result = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                const orders = result.results.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
                return new Response(JSON.stringify({ success: true, orders: orders }), {
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
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 库存管理
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
            // 财务管理
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
                const orders = await env.DB.prepare('SELECT * FROM orders').all();
                const inventoryLogs = await env.DB.prepare('SELECT * FROM inventory_logs').all();
                const financeRecords = await env.DB.prepare('SELECT * FROM finance_records').all();
                const admins = await env.DB.prepare('SELECT id, username, permissions, created_at FROM admins').all();

                const backupData = {
                    users: users.results,
                    addresses: addresses.results,
                    suppliers: suppliers.results,
                    products: products.results,
                    orders: orders.results,
                    inventoryLogs: inventoryLogs.results,
                    financeRecords: financeRecords.results,
                    admins: admins.results,
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

                await env.DB.prepare('DELETE FROM finance_records').run();
                await env.DB.prepare('DELETE FROM inventory_logs').run();
                await env.DB.prepare('DELETE FROM orders').run();
                await env.DB.prepare('DELETE FROM products').run();
                await env.DB.prepare('DELETE FROM suppliers').run();
                await env.DB.prepare('DELETE FROM addresses').run();
                await env.DB.prepare('DELETE FROM users').run();
                await env.DB.prepare('DELETE FROM admins').run();

                for (const user of data.users || []) {
                    await env.DB.prepare(
                        `INSERT INTO users (id, phone, password, security_question, security_answer, role, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`
                    ).bind(user.id, user.phone, user.password, user.security_question, user.security_answer, user.role, user.created_at).run();
                }
                for (const sup of data.suppliers || []) {
                    await env.DB.prepare(
                        `INSERT INTO suppliers (id, name, contact, phone, address, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)`
                    ).bind(sup.id, sup.name, sup.contact || '', sup.phone || '', sup.address || '', sup.created_at).run();
                }
                for (const p of data.products || []) {
                    await env.DB.prepare(
                        `INSERT INTO products (id, name, category, price, unit, stock,
                         supplier_id, emoji, description, status, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(p.id, p.name, p.category || '', p.price, p.unit || '份', p.stock || 0, p.supplier_id || null, p.emoji || '🥬', p.description || '', p.status || 'on', p.created_at, p.updated_at).run();
                }
                for (const o of data.orders || []) {
                    await env.DB.prepare(
                        `INSERT INTO orders (id, customer_name, customer_phone, address, address_id,
                         total, items, status, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(o.id, o.customer_name, o.customer_phone, o.address, o.address_id || null, o.total, o.items, o.status || 'pending', o.created_at, o.updated_at).run();
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
                return new Response(JSON.stringify({ success: true, message: '导入成功' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // ============================================================
            // 管理员管理
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