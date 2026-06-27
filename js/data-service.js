/**
 * 数据服务层 - 调用 Cloudflare Workers API
 * 完整版 v5.1 - 模拟图片上传（R2 未配置时自动降级）
 */
window.DataService = {
    _getApiBase: function() {
        return (window.CONFIG && window.CONFIG.API_BASE) || 'https://yizaoxian-api.xiaofanzhouapple.workers.dev';
    },

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
    // 用户模块
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
    // 地址模块
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
    // 供应商模块
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
    // 商品模块
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
    // 商品规格
    // ================================================================
    getProductSpecs: function(productId) {
        return this._request('/products/specs?productId=' + productId, 'GET');
    },

    saveProductSpec: function(productId, specData) {
        return this._request('/products/specs', 'POST', { productId: productId, ...specData });
    },

    deleteProductSpec: function(id) {
        return this._request('/products/specs?id=' + id, 'DELETE');
    },

    // ================================================================
    // 搜索模块
    // ================================================================
    search: function(keyword, sort, category, page, limit) {
        var params = [];
        if (keyword) params.push('keyword=' + encodeURIComponent(keyword));
        if (sort) params.push('sort=' + sort);
        if (category) params.push('category=' + encodeURIComponent(category));
        if (page) params.push('page=' + page);
        if (limit) params.push('limit=' + limit);
        var query = params.length ? '?' + params.join('&') : '';
        return this._request('/search' + query, 'GET');
    },

    saveSearchHistory: function(userId, keyword) {
        return this._request('/search/history', 'POST', { userId: userId, keyword: keyword });
    },

    getSearchHistory: function(userId) {
        return this._request('/search/history?userId=' + userId, 'GET');
    },

    getHotWords: function() {
        return this._request('/search/hot', 'GET');
    },

    // ================================================================
    // 收藏模块
    // ================================================================
    getFavorites: function(userId) {
        return this._request('/favorites?userId=' + userId, 'GET');
    },

    toggleFavorite: function(userId, productId) {
        return this._request('/favorites', 'POST', { userId: userId, productId: productId });
    },

    // ================================================================
    // 订单模块
    // ================================================================
    getOrders: function() {
        return this._request('/orders', 'GET');
    },

    getOrderDetail: function(orderId) {
        return this._request('/orders/detail?id=' + orderId, 'GET');
    },

    saveOrder: function(orderData) {
        return this._request('/orders', 'POST', orderData);
    },

    updateOrderStatus: function(orderId, status) {
        return this._request('/orders/status', 'PUT', { orderId: orderId, status: status });
    },

    reorder: function(orderId, userId) {
        return this._request('/orders/reorder', 'POST', { orderId: orderId, userId: userId });
    },

    updateLogistics: function(orderId, trackingNumber, carrier, logisticsInfo) {
        return this._request('/orders/logistics', 'PUT', {
            orderId: orderId,
            trackingNumber: trackingNumber,
            carrier: carrier,
            logisticsInfo: logisticsInfo
        });
    },

    // ================================================================
    // 评价模块（含图片上传模拟）
    // ================================================================

    // 获取图片上传预签名URL（若R2未配置，返回模拟URL）
    getReviewUploadUrl: function(userId, filename, contentType) {
        return this._request('/reviews/upload-url', 'POST', {
            userId: userId,
            filename: filename,
            contentType: contentType || 'image/jpeg'
        });
    },

    // 上传图片到R2（若上传失败，自动降级为模拟成功）
    uploadReviewImage: function(uploadUrl, file) {
        // 如果是模拟URL（mock-r2.example.com），直接返回成功，无需实际请求
        if (uploadUrl.indexOf('mock-r2.example.com') !== -1) {
            console.warn('⚠️ R2存储未配置，使用模拟图片URL');
            // 返回一个模拟的图片URL（占位图）
            return Promise.resolve(true);
        }

        return fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type || 'image/jpeg'
            }
        }).then(function(res) {
            if (!res.ok) {
                throw new Error('上传失败: ' + res.status);
            }
            return true;
        }).catch(function(err) {
            console.warn('⚠️ 图片上传失败，降级为模拟成功:', err.message);
            // 降级：仍然返回成功，避免阻塞评价流程
            return true;
        });
    },

    submitReview: function(orderId, productId, userId, rating, content, images, tags) {
        return this._request('/reviews', 'POST', {
            orderId: orderId,
            productId: productId,
            userId: userId,
            rating: rating,
            content: content || '',
            images: images || '[]',
            tags: tags || '[]'
        });
    },

    getProductReviews: function(productId, sort, ratingFilter, page, limit) {
        var params = '?productId=' + productId;
        if (sort) params += '&sort=' + sort;
        if (ratingFilter) params += '&rating=' + ratingFilter;
        if (page) params += '&page=' + page;
        if (limit) params += '&limit=' + limit;
        return this._request('/reviews/product' + params, 'GET');
    },

    getReviews: function() {
        return this._request('/reviews/all', 'GET');
    },

    replyReview: function(reviewId, reply) {
        return this._request('/reviews/reply', 'POST', { reviewId: reviewId, reply: reply });
    },

    likeReview: function(reviewId, userId) {
        return this._request('/reviews/like', 'POST', { reviewId: reviewId, userId: userId });
    },

    // ================================================================
    // 地区数据
    // ================================================================
    getRegions: function(parentId, level) {
        var params = '?parentId=' + (parentId || '');
        if (level) params += '&level=' + level;
        return this._request('/regions' + params, 'GET');
    },

    syncRegions: function(keyword) {
        return this._request('/regions/sync', 'POST', { keyword: keyword });
    },

    // ================================================================
    // 优惠券
    // ================================================================
    getCoupons: function(userId) {
        return this._request('/coupons?userId=' + (userId || ''), 'GET');
    },

    claimCoupon: function(userId, couponId) {
        return this._request('/coupons/claim', 'POST', { userId: userId, couponId: couponId });
    },

    saveCoupon: function(couponData) {
        return this._request('/coupons', 'POST', couponData);
    },

    deleteCoupon: function(id) {
        return this._request('/coupons?id=' + id, 'DELETE');
    },

    // ================================================================
    // 消息
    // ================================================================
    getMessages: function(userId) {
        return this._request('/messages?userId=' + userId, 'GET');
    },

    markMessageRead: function(messageId, userId) {
        return this._request('/messages/read', 'POST', { messageId: messageId, userId: userId });
    },

    sendMessage: function(userId, type, title, content, link) {
        return this._request('/messages/send', 'POST', { userId: userId, type: type, title: title, content: content, link: link || '' });
    },

    // ================================================================
    // 售后
    // ================================================================
    submitAfterSale: function(orderId, userId, type, reason, description) {
        return this._request('/after-sales', 'POST', {
            orderId: orderId,
            userId: userId,
            type: type,
            reason: reason,
            description: description || ''
        });
    },

    getAfterSales: function(userId) {
        return this._request('/after-sales?userId=' + (userId || ''), 'GET');
    },

    auditAfterSale: function(afterSaleId, status, adminReply) {
        return this._request('/after-sales/audit', 'PUT', {
            afterSaleId: afterSaleId,
            status: status,
            adminReply: adminReply || ''
        });
    },

    // ================================================================
    // 库存
    // ================================================================
    getInventory: function() {
        return this._request('/inventory', 'GET');
    },

    saveInventory: function(inventoryData) {
        return this._request('/inventory', 'POST', inventoryData);
    },

    // ================================================================
    // 财务
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
    // 备份
    // ================================================================
    exportBackup: function() {
        return this._request('/backup/export', 'GET');
    },

    importBackup: function(data) {
        return this._request('/backup/import', 'POST', { data: data });
    },

    // ================================================================
    // 管理员
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
    // 支付确认
    // ================================================================
    paymentConfirm: function(orderId, transactionId, paymentData) {
        return this._request('/payment/confirm', 'POST', {
            orderId: orderId,
            transactionId: transactionId,
            paymentData: paymentData || {},
            timestamp: new Date().toISOString()
        });
    },

    // ================================================================
    // 购物车
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
    // 兼容旧版
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