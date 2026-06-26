/**
 * 数据服务层 - 调用 Cloudflare Workers API
 * 数据存储在 D1 数据库
 */
window.DataService = {
    // ===== 动态获取 API 地址，始终从 CONFIG 读取 =====
    _getApiBase: function() {
        return (window.CONFIG && window.CONFIG.API_BASE) || 'https://yizaoxian-api.xiaofanzhouapple.workers.dev';
    },

    // ===== 通用请求方法 =====
    _request: function(endpoint, method, data) {
        var url = this._getApiBase() + endpoint;
        var options = {
            method: method || 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) options.body = JSON.stringify(data);
        return fetch(url, options)
            .then(function(res) {
                if (!res.ok) {
                    return res.text().then(function(text) {
                        var errMsg = '请求失败';
                        try { var json = JSON.parse(text); errMsg = json.error || json.message || '请求失败'; } catch(e) { errMsg = text || '请求失败'; }
                        throw new Error(errMsg);
                    });
                }
                return res.json();
            })
            .catch(function(error) {
                console.error('API 请求失败:', error);
                throw error;
            });
    },

    // ================================================================
    // 用户相关
    // ================================================================
    login: function(phone, password) {
        return this._request('/users/login', 'POST', { phone: phone, password: password });
    },

    register: function(phone, password, securityQuestion, securityAnswer) {
        return this._request('/users/register', 'POST', {
            phone: phone,
            password: password,
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer
        });
    },

    resetPassword: function(phone, answer, newPassword) {
        return this._request('/users/reset-password', 'POST', {
            phone: phone,
            answer: answer,
            newPassword: newPassword
        });
    },

    changePassword: function(userId, oldPassword, newPassword) {
        return this._request('/users/change-password', 'POST', {
            userId: userId,
            oldPassword: oldPassword,
            newPassword: newPassword
        });
    },

    updatePhone: function(userId, password, newPhone) {
        return this._request('/users/update-phone', 'POST', {
            userId: userId,
            password: password,
            newPhone: newPhone
        });
    },

    getUsers: function() {
        return this._request('/users', 'GET');
    },

    // ================================================================
    // 地址相关
    // ================================================================
    getAddresses: function(userId) {
        return this._request('/users/addresses?userId=' + userId, 'GET');
    },

    saveAddress: function(userId, addressData) {
        return this._request('/users/addresses', 'POST', { userId: userId, ...addressData });
    },

    deleteAddress: function(id, userId) {
        return this._request('/users/addresses?id=' + id + '&userId=' + userId, 'DELETE');
    },

    // ================================================================
    // 供应商相关
    // ================================================================
    getSuppliers: function() {
        return this._request('/suppliers', 'GET');
    },

    saveSupplier: function(supplierData) {
        return this._request('/suppliers', 'POST', supplierData);
    },

    deleteSupplier: function(id) {
        return this._request('/suppliers?id=' + id, 'DELETE');
    },

    // ================================================================
    // 商品相关
    // ================================================================
    getProducts: function() {
        return this._request('/products', 'GET');
    },

    saveProduct: function(productData) {
        return this._request('/products', 'POST', productData);
    },

    deleteProduct: function(id) {
        return this._request('/products?id=' + id, 'DELETE');
    },

    // ================================================================
    // 订单相关
    // ================================================================
    getOrders: function() {
        return this._request('/orders', 'GET');
    },

    saveOrder: function(orderData) {
        return this._request('/orders', 'POST', orderData);
    },

    updateOrderStatus: function(orderId, status) {
        return this._request('/orders/status', 'PUT', { orderId: orderId, status: status });
    },

    // ================================================================
    // 库存相关
    // ================================================================
    getInventory: function() {
        return this._request('/inventory', 'GET');
    },

    saveInventory: function(inventoryData) {
        return this._request('/inventory', 'POST', inventoryData);
    },

    // ================================================================
    // 财务相关
    // ================================================================
    getFinance: function() {
        return this._request('/finance', 'GET');
    },

    saveFinance: function(financeData) {
        return this._request('/finance', 'POST', financeData);
    },

    deleteFinance: function(id) {
        return this._request('/finance?id=' + id, 'DELETE');
    },

    // ================================================================
    // 备份相关
    // ================================================================
    exportBackup: function() {
        return this._request('/backup/export', 'GET');
    },

    importBackup: function(data) {
        return this._request('/backup/import', 'POST', { data: data });
    },

    // ================================================================
    // 管理员相关
    // ================================================================
    adminLogin: function(username, password) {
        return this._request('/admin/login', 'POST', { username: username, password: password });
    },

    getAdminMembers: function() {
        return this._request('/admin/members', 'GET');
    },

    addAdminMember: function(username, password, permissions) {
        return this._request('/admin/members', 'POST', { username: username, password: password, permissions: permissions || [] });
    },

    deleteAdminMember: function(id) {
        return this._request('/admin/members?id=' + id, 'DELETE');
    },

    updateAdminMemberPermissions: function(id, permissions) {
        return this._request('/admin/members/permissions', 'PUT', { id: id, permissions: permissions || [] });
    },

    adminChangePassword: function(id, oldPassword, newPassword) {
        return this._request('/admin/change-password', 'POST', { id: id, oldPassword: oldPassword, newPassword: newPassword });
    },

    // ================================================================
    // 购物车（localStorage）
    // ================================================================
    getCart: function() {
        try {
            var raw = localStorage.getItem('yizaoxian_cart');
            return raw ? JSON.parse(raw) : {};
        } catch(e) { return {}; }
    },

    saveCart: function(cart) {
        localStorage.setItem('yizaoxian_cart', JSON.stringify(cart));
    },

    // ================================================================
    // 兼容旧版（供 dashboard 使用）
    // ================================================================
    getAppData: function() {
        var self = this;
        return Promise.all([
            self.getSuppliers(),
            self.getProducts(),
            self.getOrders(),
            self.getFinance()
        ]).then(function(results) {
            return self.getInventory().then(function(invData) {
                return {
                    suppliers: results[0] || [],
                    products: results[1] || [],
                    orders: results[2] || [],
                    finance: results[3] || [],
                    inventory: (invData && invData.logs) || [],
                    _ids: { supplier: 1, product: 1, inventory: 1, order: 1, finance: 1 }
                };
            });
        }).catch(function(err) {
            console.warn('加载数据失败，返回空数据:', err.message);
            return {
                suppliers: [],
                products: [],
                orders: [],
                finance: [],
                inventory: [],
                _ids: { supplier: 1, product: 1, inventory: 1, order: 1, finance: 1 }
            };
        });
    }
};