window.ClientPages = {
    app: null,
    currentCategory: '全部',
    currentOrderStatus: '全部',
    addressPageMode: 'list',
    editingAddressId: null,
    _selectedTag: '',
    _hotProducts: [],
    _currentProductId: null,
    _searchKeyword: '',
    _searchSort: 'relevance',
    _selectedSpec: {},
    _uploadedImages: [],
    _maxImages: 6,
    _currentReviewPage: 1,
    _currentReviews: [],
    _isSubmittingReview: false,

    // ================================================================
    // 初始化
    // ================================================================
    init: function(app) {
        this.app = app;
        if (window.RegionData && window.RegionData.init) {
            window.RegionData.init();
        }
        this.loadHotWords();
        this.loadUnreadCount();
    },

    // ================================================================
    // 商品展示
    // ================================================================
    renderProducts: function() {
        var self = this;
        var grid = document.getElementById('productGrid');
        if (!grid) return;

        var search = document.getElementById('searchInput');
        var keyword = search ? search.value.trim().toLowerCase() : '';

        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];

            var list = products.filter(function(p) { return p.status !== 'off'; });

            if (self.currentCategory !== '全部') {
                list = list.filter(function(p) { return p.category === self.currentCategory; });
            }

            if (keyword) {
                list = list.filter(function(p) {
                    return (p.name && p.name.toLowerCase().includes(keyword)) ||
                           (p.description && p.description.toLowerCase().includes(keyword)) ||
                           (p.origin && p.origin.toLowerCase().includes(keyword));
                });
            }

            list.sort(function(a, b) {
                if (a.is_hot && !b.is_hot) return -1;
                if (!a.is_hot && b.is_hot) return 1;
                return (b.created_at || '').localeCompare(a.created_at || '');
            });

            self._hotProducts = list.filter(function(p) { return p.is_hot; });

            if (!list.length) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🥬</div><p>暂无商品</p></div>';
                return;
            }

            var cart = DataService.getCart();
            if (!cart) cart = {};

            var hotHtml = '';
            if (self._hotProducts.length > 0) {
                hotHtml = '<div class="hot-banner"><div class="hot-title">🔥 热卖榜</div><div class="hot-list">';
                self._hotProducts.slice(0, 8).forEach(function(p) {
                    hotHtml += '<div class="hot-item" onclick="ClientPages.showProductDetail(\'' + p.id + '\')">' +
                        '<span class="hot-emoji">' + (p.emoji || '🍅') + '</span>' +
                        '<span class="hot-name">' + p.name + '</span>' +
                        '<span class="hot-price">' + Utils.formatPrice(p.price) + '</span>' +
                        '</div>';
                });
                hotHtml += '</div></div>';
            }

            grid.innerHTML = hotHtml + list.map(function(p) {
                var stock = p.stock || 0;
                var inCart = cart[p.id] || 0;
                var stockClass = '';
                var stockText = '';
                var todayPickupText = p.today_pickup ? ' <span class="today-pickup-tag">今日可提</span>' : '';
                var hotTag = p.is_hot ? ' <span class="hot-tag">🔥</span>' : '';
                var soldText = p.sales_count > 0 ? ' <span class="sold-tag">已售 ' + p.sales_count + ' 份</span>' : '';
                if (stock <= 0) { stockClass = 'out'; stockText = '已售罄'; }
                else if (stock < 10) { stockClass = 'low'; stockText = '仅剩' + stock; }
                else { stockText = '库存 ' + stock; }

                return '<div class="product-card" onclick="ClientPages.showProductDetail(\'' + p.id + '\')">' +
                    '<div class="product-img">' + (p.emoji || '🍅') + hotTag + '</div>' +
                    '<div class="product-info">' +
                    '<div class="product-name">' + (p.name || '未命名') + todayPickupText + '</div>' +
                    '<div class="product-unit">' + (p.unit || '份') + soldText + '</div>' +
                    '<div class="product-meta">' +
                    '<div class="product-price">' +
                    '<span class="price-symbol">¥</span>' + (p.price || 0).toFixed(2) +
                    '<span class="price-unit">/' + (p.unit || '份') + '</span>' +
                    '</div>' +
                    '<button class="add-cart-btn" onclick="event.stopPropagation();ClientPages.addToCart(\'' + p.id + '\')" ' + (stock <= 0 ? 'disabled' : '') + '>' +
                    (stock <= 0 ? '✕' : '+') +
                    '</button>' +
                    '</div>' +
                    '<span class="stock-tag ' + stockClass + '">' + stockText + '</span>' +
                    (inCart > 0 ? '<span class="selected-tag">已选' + inCart + ' 份</span>' : '') +
                    '</div></div>';
            }).join('');
        }).catch(function(err) {
            grid.innerHTML = '<div class="empty-state"><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    filterByCategory: function(cat) {
        this.currentCategory = cat;
        document.querySelectorAll('#clientApp .category-tabs .cat-tab').forEach(function(t) {
            t.classList.toggle('active', t.dataset.cat === cat);
        });
        this.renderProducts();
    },

    filterProducts: function() {
        this.renderProducts();
    },

    performSearch: function() {
        var input = document.getElementById('searchInput');
        var keyword = input ? input.value.trim() : '';
        if (!keyword) {
            this.renderProducts();
            return;
        }
        var user = Auth.getCurrentUser();
        if (user && user.id) {
            DataService.saveSearchHistory(user.id, keyword).catch(function() {});
        }
        this._searchKeyword = keyword;
        this.renderProducts();
    },

    loadHotWords: function() {
        DataService.getHotWords().then(function(words) {
            var container = document.getElementById('hotWordsContainer');
            if (!container || !words || words.length === 0) return;
            var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 0 8px;">';
            words.slice(0, 8).forEach(function(w) {
                html += '<span class="hot-word" onclick="ClientPages.searchByHotWord(\'' + w.keyword + '\')">🔥 ' + w.keyword + '</span>';
            });
            html += '</div>';
            container.innerHTML = html;
            container.style.display = 'block';
        }).catch(function() {});
    },

    searchByHotWord: function(keyword) {
        var input = document.getElementById('searchInput');
        if (input) input.value = keyword;
        this.performSearch();
    },

    loadUnreadCount: function() {
        var user = Auth.getCurrentUser();
        if (!user || !user.id) return;
        DataService.getMessages(user.id).then(function(result) {
            var badge = document.getElementById('messageBadge');
            if (badge && result.unread > 0) {
                badge.textContent = result.unread;
                badge.style.display = 'flex';
            } else if (badge) {
                badge.style.display = 'none';
            }
        }).catch(function() {});
    },

    addToCart: function(productId, specId) {
        var self = this;
        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];
            var product = products.find(function(p) { return p.id === productId; });
            if (!product || (product.stock || 0) <= 0) {
                Utils.toast('该商品暂无库存');
                return;
            }

            var cart = DataService.getCart();
            if (!cart) cart = {};

            if (specId) {
                DataService.getProductSpecs(productId).then(function(specs) {
                    if (!Array.isArray(specs)) specs = [];
                    var spec = specs.find(function(s) { return s.id === specId; });
                    if (!spec || spec.stock <= 0) {
                        Utils.toast('该规格暂无库存');
                        return;
                    }
                    var cartKey = productId + '_' + specId;
                    if (!cart[cartKey]) cart[cartKey] = 0;
                    if (cart[cartKey] >= spec.stock) {
                        Utils.toast('库存不足');
                        return;
                    }
                    cart[cartKey] = (cart[cartKey] || 0) + 1;
                    DataService.saveCart(cart);
                    if (window.ClientApp) window.ClientApp.updateBadges();
                    window.ClientPages.renderProducts();
                    Utils.toast('已添加' + (product.name || '商品') + ' (' + spec.spec_name + ')');
                }).catch(function() {
                    self._addToCartSimple(productId);
                });
                return;
            }

            self._addToCartSimple(productId);
        });
    },

    _addToCartSimple: function(productId) {
        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];
            var product = products.find(function(p) { return p.id === productId; });
            if (!product || (product.stock || 0) <= 0) {
                Utils.toast('该商品暂无库存');
                return;
            }
            var cart = DataService.getCart();
            if (!cart) cart = {};
            if (!cart[productId]) cart[productId] = 0;
            if (cart[productId] >= (product.stock || 0)) {
                Utils.toast('库存不足');
                return;
            }
            cart[productId] = (cart[productId] || 0) + 1;
            DataService.saveCart(cart);
            if (window.ClientApp) window.ClientApp.updateBadges();
            window.ClientPages.renderProducts();
            Utils.toast('已添加' + (product.name || '商品'));
        });
    },

    removeFromCart: function(cartKey) {
        var cart = DataService.getCart();
        if (!cart) cart = {};
        if (cart[cartKey]) {
            cart[cartKey]--;
            if (cart[cartKey] <= 0) delete cart[cartKey];
            DataService.saveCart(cart);
            if (window.ClientApp) window.ClientApp.updateBadges();
            window.ClientPages.renderCart();
            window.ClientPages.renderProducts();
        }
    },

    renderCart: function() {
        var list = document.getElementById('cartList');
        var empty = document.getElementById('cartEmpty');
        var footer = document.getElementById('cartFooter');
        if (!list || !empty || !footer) return;

        var cart = DataService.getCart();
        if (!cart) cart = {};
        var keys = Object.keys(cart);

        if (!keys.length) {
            list.innerHTML = '';
            empty.style.display = 'block';
            footer.classList.add('hidden');
            return;
        }

        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];
            var items = [];
            var total = 0;
            var invalidItems = [];

            keys.forEach(function(key) {
                var parts = key.split('_');
                var productId = parts[0];
                var specId = parts[1] || null;
                var p = products.find(function(pr) { return pr.id === productId; });
                if (p && cart[key] > 0) {
                    if ((p.stock || 0) <= 0) {
                        invalidItems.push({ key: key, name: p.name || '已失效商品', qty: cart[key] });
                    } else {
                        items.push({
                            key: key,
                            id: productId,
                            specId: specId,
                            name: p.name || '未命名',
                            specName: '',
                            price: p.price || 0,
                            qty: cart[key],
                            emoji: p.emoji || '🍅',
                            stock: p.stock || 0
                        });
                        total += p.price * cart[key];
                    }
                } else {
                    invalidItems.push({ key: key, name: '商品已下架', qty: cart[key] });
                }
            });

            DataService.saveCart(cart);

            if (!items.length && !invalidItems.length) {
                list.innerHTML = '';
                empty.style.display = 'block';
                footer.classList.add('hidden');
                return;
            }

            empty.style.display = 'none';
            footer.classList.remove('hidden');

            var html = '';
            if (invalidItems.length > 0) {
                html += '<div style="background:#fff5f5;border-radius:8px;padding:8px 12px;margin-bottom:8px;border:1px solid #ffd0d0;">';
                html += '<div style="font-size:12px;color:#ff3b30;font-weight:500;margin-bottom:4px;">⚠️ 以下商品已失效，请移除</div>';
                invalidItems.forEach(function(item) {
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px;">' +
                        '<span style="color:#999;">' + item.name + ' ✕ ' + item.qty + '</span>' +
                        '<button onclick="ClientPages.removeFromCart(\'' + item.key + '\')" style="color:#ff3b30;background:none;border:none;font-size:12px;cursor:pointer;">移除</button>' +
                        '</div>';
                });
                html += '</div>';
            }

            items.forEach(function(item) {
                var maxQty = Math.min(item.stock, 99);
                html += '<div class="cart-item">' +
                    '<div style="font-size:28px;">' + item.emoji + '</div>' +
                    '<div class="item-info"><div class="item-name">' + item.name + item.specName + '</div><div class="item-price">' + Utils.formatPrice(item.price) + '</div></div>' +
                    '<div class="item-qty">' +
                    '<button onclick="ClientPages.removeFromCart(\'' + item.key + '\')">−</button>' +
                    '<span class="qty-num">' + item.qty + '</span>' +
                    '<button onclick="ClientPages.addToCart(\'' + item.id + '\',\'' + (item.specId || '') + '\')" ' + (item.qty >= maxQty ? 'disabled style="opacity:0.3;"' : '') + '>+</button>' +
                    '</div></div>';
            });

            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px;">' +
                '<button onclick="ClientPages.batchRemoveCart()" style="color:#ff3b30;background:none;border:none;font-size:13px;cursor:pointer;">🗑️ 清空购物车</button>' +
                '</div>';

            list.innerHTML = html;

            var totalEl = document.getElementById('cartTotalPrice');
            if (totalEl) totalEl.textContent = Utils.formatPrice(total);

            var btn = document.getElementById('checkoutBtn');
            if (btn) btn.disabled = (items.length === 0);

            if (window.ClientApp) window.ClientApp.updateBadges();
        });
    },

    batchRemoveCart: function() {
        if (!confirm('确定清空购物车吗？')) return;
        DataService.saveCart({});
        if (window.ClientApp) window.ClientApp.updateBadges();
        window.ClientPages.renderCart();
        Utils.toast('已清空购物车');
    },

    showCheckout: function() {
        var self = this;
        if (!Auth.getCurrentUser()) {
            if (confirm('请先登录后再结算，是否现在登录？')) {
                ClientApp.showLoginModal();
                ClientApp._returnCallback = function() {
                    self._doCheckout();
                };
            }
            return;
        }
        this._doCheckout();
    },

    _doCheckout: function() {
        var cart = DataService.getCart();
        if (!cart) cart = {};
        var keys = Object.keys(cart);
        if (!keys.length) {
            Utils.toast('购物车是空的');
            return;
        }

        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }

        if (OrderHelper.isPastCutoff()) {
            Utils.toast('⏰ 已过截单时间（23:00），请明日再下单');
            return;
        }

        DataService.getAddresses(user.id).then(function(addresses) {
            if (!Array.isArray(addresses)) addresses = [];

            if (!addresses.length) {
                if (confirm('您还没有收货地址，现在去添加？')) {
                    window.ClientPages.showAddressManager();
                }
                return;
            }

            var html = '<div class="modal-title">选择收货地址</div>';
            html += '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;text-align:center;">⏰ 截单时间 23:00 · 预计 ' + OrderHelper.getExpectedPickupDate() + ' 可提货</div>';
            addresses.forEach(function(addr) {
                if (!addr) return;
                var tagDisplay = addr.tag ? ' [' + addr.tag + ']' : '';
                var lastUsedDisplay = addr.last_used ? ' <span style="font-size:11px;color:var(--text-secondary);">上次使用</span>' : '';
                var parts = [];
                if (addr.province) parts.push(addr.province);
                if (addr.city && addr.city !== addr.province) parts.push(addr.city);
                if (addr.district && addr.district !== addr.city) parts.push(addr.district);
                if (addr.address) parts.push(addr.address);
                var fullDisplayAddress = parts.join('');
                html += '<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">' +
                    '<div><div><strong>' + (addr.name || '') + '</strong> ' + (addr.phone || '') + tagDisplay + (addr.is_default ? ' <span style="color:var(--primary);font-size:12px;">默认</span>' : '') + lastUsedDisplay + '</div>' +
                    '<div style="font-size:13px;color:var(--text-secondary);">' + fullDisplayAddress + '</div></div>' +
                    '<button class="btn-sm" style="background:var(--primary);color:#fff;" onclick="ClientPages.selectAddress(\'' + addr.id + '\')">选择</button>' +
                    '</div>';
            });

            html += '<div style="margin-top:12px;"><button class="btn-sm" onclick="ClientPages.showAddressManager()" style="background:var(--primary);color:#fff;padding:6px 16px;">+ 新增地址</button></div>';
            html += '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button></div>';

            var content = document.getElementById('modalContent');
            if (content) content.innerHTML = html;

            var overlay = document.getElementById('modalOverlay');
            if (overlay) overlay.classList.add('active');
        });
    },

    selectAddress: function(addressId) {
        window.closeModal();

        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }

        DataService.getAddresses(user.id).then(function(addresses) {
            if (!Array.isArray(addresses)) addresses = [];
            var addr = addresses.find(function(a) { return a && a.id === addressId; });
            if (!addr) {
                Utils.toast('地址不存在');
                return;
            }

            var cart = DataService.getCart();
            if (!cart) cart = {};
            var keys = Object.keys(cart);
            if (!keys.length) {
                Utils.toast('购物车是空的');
                return;
            }

            DataService.getProducts().then(function(products) {
                if (!Array.isArray(products)) products = [];
                var items = [];
                var total = 0;
                var stockOk = true;

                keys.forEach(function(key) {
                    var parts = key.split('_');
                    var productId = parts[0];
                    var specId = parts[1] || null;
                    var p = products.find(function(pr) { return pr.id === productId; });
                    if (!p || (p.stock || 0) < cart[key]) {
                        stockOk = false;
                        Utils.toast('商品 ' + (p ? p.name : key) + ' 库存不足');
                        return;
                    }
                    items.push({
                        productId: p.id,
                        specId: specId,
                        name: p.name || '未命名',
                        price: p.price || 0,
                        quantity: cart[key]
                    });
                    total += p.price * cart[key];
                });

                if (!stockOk || !items.length) return;

                var parts = [];
                if (addr.province) parts.push(addr.province);
                if (addr.city && addr.city !== addr.province) parts.push(addr.city);
                if (addr.district && addr.district !== addr.city) parts.push(addr.district);
                if (addr.address) parts.push(addr.address);
                var fullAddress = parts.join('');

                var updateData = {
                    id: addr.id,
                    name: addr.name || '',
                    phone: addr.phone || '',
                    address: addr.address || '',
                    fullAddress: fullAddress,
                    tag: addr.tag || '',
                    lng: addr.lng || null,
                    lat: addr.lat || null,
                    province: addr.province || '',
                    city: addr.city || '',
                    district: addr.district || '',
                    street: addr.street || '',
                    isDefault: addr.is_default || false,
                    lastUsed: true
                };

                DataService.saveAddress(user.id, updateData).then(function() {
                    var orderData = {
                        customerName: addr.name || '用户',
                        customerPhone: addr.phone || '',
                        address: fullAddress,
                        addressId: addr.id,
                        items: items,
                        total: total
                    };

                    var builtOrder = OrderHelper.buildOrder(orderData);

                    DataService.saveOrder(builtOrder).then(function(orderResult) {
                        DataService.saveCart({});
                        if (window.ClientApp) window.ClientApp.updateBadges();
                        window.ClientPages.renderCart();
                        window.ClientPages.renderProducts();

                        var orderId = orderResult.orderId;
                        if (!orderId && orderResult.orders && orderResult.orders.length > 0) {
                            var savedOrders = orderResult.orders;
                            var lastOrder = savedOrders[savedOrders.length - 1];
                            orderId = lastOrder.id;
                        }
                        if (!orderId) {
                            orderId = 'ORD' + Date.now().toString(36);
                        }

                        PaymentHelper.pay({
                            orderId: orderId,
                            total: total,
                            subject: '宜早鲜订单#' + orderId
                        }, function(payResult) {
                            if (payResult.success) {
                                Utils.toast('🎉 支付成功！提货码：' + builtOrder.pickupCode);
                                setTimeout(function() {
                                    if (confirm('订单已支付成功！是否现在评价商品？')) {
                                        window.ClientPages.showReviewForm(orderId);
                                    }
                                }, 1000);
                                if (window.ClientApp) window.ClientApp.navigateTo('orders');
                            } else {
                                Utils.toast('❌ 支付失败，请重试');
                            }
                        });
                    });
                });
            });
        });
    },

    renderOrders: function() {
        var list = document.getElementById('orderList');
        var empty = document.getElementById('orderEmpty');
        if (!list || !empty) return;

        var user = Auth.getCurrentUser();
        if (!user) {
            list.innerHTML = '<div class="empty-state"><p>请先登录查看订单</p></div>';
            empty.style.display = 'none';
            return;
        }

        DataService.getOrders().then(function(orders) {
            if (!Array.isArray(orders)) orders = [];

            if (window.ClientPages.currentOrderStatus !== '全部') {
                orders = orders.filter(function(o) { return o && o.status === window.ClientPages.currentOrderStatus; });
            }

            orders.sort(function(a, b) {
                return (b.created_at || '').localeCompare(a.created_at || '');
            });

            if (!orders.length) {
                list.innerHTML = '';
                empty.style.display = 'block';
                return;
            }

            empty.style.display = 'none';

            var statusMap = { pending: '待提货', shipped: '配送中', completed: '已完成', cancelled: '已取消', ready_pickup: '待提货', picked: '已提货' };
            var statusCls = { pending: 'pending', shipped: 'shipped', completed: 'completed', cancelled: 'cancelled', ready_pickup: 'pending', picked: 'completed' };

            list.innerHTML = orders.map(function(o) {
                if (!o) return '';
                var itemsHtml = '';
                if (Array.isArray(o.items)) {
                    itemsHtml = o.items.map(function(i) {
                        var specText = i.specId ? ' (' + i.specName + ')' : '';
                        return (i.name || '') + specText + ' ✕ ' + (i.quantity || 0);
                    }).join('、');
                }
                var pickupInfo = o.pickup_code ? ' 🎫 提货码：<strong>' + o.pickup_code + '</strong>' : '';
                var pickupDate = o.expected_pickup_date ? ' · 📮 ' + o.expected_pickup_date + ' 可提货' : '';
                var statusText = statusMap[o.status] || o.status || '未知';
                var isCompleted = o.status === 'completed' || o.status === 'picked';
                var canReview = isCompleted && !o._hasReview;

                return '<div class="order-card" onclick="ClientPages.showOrderDetail(\'' + o.id + '\')">' +
                    '<div class="order-header"><span class="order-id">' + (o.id || '') + pickupInfo + '</span><span class="order-status ' + (statusCls[o.status] || '') + '">' + statusText + '</span></div>' +
                    '<div class="order-items">' + itemsHtml + '</div>' +
                    '<div class="order-total">' + Utils.formatPrice(o.total || 0) + '</div>' +
                    '<div class="order-address">📷 ' + (o.address || '默认地址') + pickupDate + ' · ' + (o.created_at || '').slice(0, 16) + '</div>' +
                    '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
                    (o.status === 'pending' ? '<button onclick="event.stopPropagation();ClientPages.cancelOrder(\'' + o.id + '\')" style="font-size:12px;color:#ff3b30;background:none;border:1px solid #ff3b30;border-radius:12px;padding:2px 14px;cursor:pointer;">取消订单</button>' : '') +
                    (o.status === 'shipped' ? '<button onclick="event.stopPropagation();ClientPages.confirmOrder(\'' + o.id + '\')" style="font-size:12px;color:var(--primary);background:none;border:1px solid var(--primary);border-radius:12px;padding:2px 14px;cursor:pointer;">确认收货</button>' : '') +
                    (isCompleted ? '<button onclick="event.stopPropagation();ClientPages.reorder(\'' + o.id + '\')" style="font-size:12px;color:#333;background:none;border:1px solid #ddd;border-radius:12px;padding:2px 14px;cursor:pointer;">再次购买</button>' : '') +
                    (canReview ? '<button onclick="event.stopPropagation();ClientPages.showReviewForm(\'' + o.id + '\')" style="font-size:12px;color:#ff6b00;background:none;border:1px solid #ff6b00;border-radius:12px;padding:2px 14px;cursor:pointer;">✍️ 评价</button>' : '') +
                    (o.status === 'completed' || o.status === 'cancelled' ? '<button onclick="event.stopPropagation();ClientPages.deleteOrder(\'' + o.id + '\')" style="font-size:12px;color:#999;background:none;border:1px solid #ddd;border-radius:12px;padding:2px 14px;cursor:pointer;">删除</button>' : '') +
                    '</div></div>';
            }).join('');
        }).catch(function(err) {
            list.innerHTML = '<div class="empty-state"><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    showOrderDetail: function(orderId) {
        DataService.getOrderDetail(orderId).then(function(order) {
            if (!order) {
                Utils.toast('订单不存在');
                return;
            }

            var statusMap = { pending: '待提货', shipped: '配送中', completed: '已完成', cancelled: '已取消', ready_pickup: '待提货', picked: '已提货' };
            var itemsHtml = '';
            if (Array.isArray(order.items)) {
                itemsHtml = order.items.map(function(i) {
                    var specText = i.specId ? ' (' + i.specName + ')' : '';
                    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f5f5f5;font-size:14px;">' +
                        '<span>' + (i.name || '') + specText + ' ✕ ' + (i.quantity || 0) + '</span>' +
                        '<span>' + Utils.formatPrice((i.price || 0) * (i.quantity || 0)) + '</span>' +
                        '</div>';
                }).join('');
            }

            var logisticsHtml = '';
            if (order.logistics) {
                var logStatus = { pending: '待发货', shipping: '运输中', delivered: '已签收' };
                var logInfo = order.logistics.logistics_info ? JSON.parse(order.logistics.logistics_info) : [];
                logisticsHtml = '<div style="margin-top:8px;padding:8px;background:#f8f8f8;border-radius:6px;">' +
                    '<div style="font-size:13px;font-weight:500;">📝 物流状态：' + (logStatus[order.logistics.status] || order.logistics.status) + '</div>' +
                    (order.logistics.tracking_number ? '<div style="font-size:12px;color:#666;">运单号：' + order.logistics.tracking_number + '</div>' : '') +
                    (order.logistics.carrier ? '<div style="font-size:12px;color:#666;">承运商：' + order.logistics.carrier + '</div>' : '') +
                    (logInfo.length > 0 ? '<div style="font-size:12px;color:#666;margin-top:4px;">' + logInfo.map(function(l) { return l.time + ' ' + l.status; }).join('<br>') + '</div>' : '') +
                    '</div>';
            }

            var afterSaleHtml = '';
            if (order.afterSale) {
                var asStatus = { pending: '审核中', approved: '已通过', rejected: '已拒绝', completed: '已完成' };
                afterSaleHtml = '<div style="margin-top:8px;padding:8px;background:#fff8e1;border-radius:6px;border:1px solid #ffd54f;">' +
                    '<div style="font-size:13px;font-weight:500;">🔧 售后状态：' + (asStatus[order.afterSale.status] || order.afterSale.status) + '</div>' +
                    (order.afterSale.admin_reply ? '<div style="font-size:12px;color:#666;">回复：' + order.afterSale.admin_reply + '</div>' : '') +
                    '</div>';
            }

            var html = '<div class="modal-title">📵 订单详情</div>' +
                '<div style="font-size:13px;color:#666;margin-bottom:8px;">订单号：' + order.id + '</div>' +
                '<div style="font-size:13px;color:var(--primary);margin-bottom:12px;">状态：' + (statusMap[order.status] || order.status) + '</div>' +
                '<div style="font-size:13px;font-weight:500;margin:8px 0 4px;">商品清单</div>' +
                itemsHtml +
                '<div style="display:flex;justify-content:space-between;font-weight:600;font-size:16px;padding:8px 0;border-top:2px solid var(--border);">' +
                '<span>合计</span><span style="color:#ff3b30;">' + Utils.formatPrice(order.total || 0) + '</span></div>' +
                (order.pickup_code ? '<div style="font-size:13px;padding:8px 0;">🎫 提货码：<strong>' + order.pickup_code + '</strong></div>' : '') +
                (order.expected_pickup_date ? '<div style="font-size:13px;padding:4px 0;">📮 预计提货：' + order.expected_pickup_date + '</div>' : '') +
                logisticsHtml +
                afterSaleHtml +
                '<div style="font-size:12px;color:#999;margin-top:8px;">下单时间：' + (order.created_at || '').slice(0, 16) + '</div>' +
                '<div class="form-actions" style="margin-top:12px;">' +
                '<button class="btn-cancel" onclick="window.closeModal()">关闭</button>' +
                (order.status === 'pending' ? '<button class="btn-danger" onclick="window.closeModal();ClientPages.cancelOrder(\'' + order.id + '\')">取消订单</button>' : '') +
                (order.status === 'completed' || order.status === 'picked' ? '<button class="btn-submit" onclick="window.closeModal();ClientPages.reorder(\'' + order.id + '\')">再次购买</button>' : '') +
                '</div>';

            var content = document.getElementById('modalContent');
            if (content) content.innerHTML = html;
            var overlay = document.getElementById('modalOverlay');
            if (overlay) overlay.classList.add('active');
        }).catch(function(err) {
            Utils.toast('加载订单详情失败: ' + err.message);
        });
    },

    cancelOrder: function(id) {
        if (!confirm('确定要取消该订单吗？')) return;
        DataService.updateOrderStatus(id, 'cancelled').then(function() {
            window.ClientPages.renderOrders();
            Utils.toast('订单已取消');
        }).catch(function(err) {
            Utils.toast('取消失败: ' + err.message);
        });
    },

    confirmOrder: function(id) {
        DataService.updateOrderStatus(id, 'completed').then(function() {
            window.ClientPages.renderOrders();
            Utils.toast('🎉 已确认收货！');
            setTimeout(function() {
                if (confirm('确认收货成功！是否现在评价商品？')) {
                    window.ClientPages.showReviewForm(id);
                }
            }, 500);
        }).catch(function(err) {
            Utils.toast('确认失败: ' + err.message);
        });
    },

    deleteOrder: function(id) {
        if (!confirm('确定删除该订单吗？此操作不可恢复。')) return;
        DataService.deleteOrder(id).then(function() {
            window.ClientPages.renderOrders();
            Utils.toast('订单已删除');
        }).catch(function(err) {
            Utils.toast('删除失败: ' + err.message);
        });
    },

    reorder: function(orderId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.reorder(orderId, user.id).then(function(result) {
            if (result.success && result.cart) {
                var cart = DataService.getCart();
                if (!cart) cart = {};
                for (var pid in result.cart) {
                    if (result.cart.hasOwnProperty(pid)) {
                        cart[pid] = (cart[pid] || 0) + result.cart[pid];
                    }
                }
                DataService.saveCart(cart);
                if (window.ClientApp) window.ClientApp.updateBadges();
                Utils.toast('✅ 已加入购物车');
                ClientApp.navigateTo('cart');
            }
        }).catch(function(err) {
            Utils.toast('再次购买失败: ' + err.message);
        });
    },

    filterOrders: function(status) {
        this.currentOrderStatus = status;
        document.querySelectorAll('#clientApp .order-tabs .order-tab').forEach(function(t) {
            t.classList.toggle('active', t.dataset.status === status);
        });
        this.renderOrders();
    },

    // ================================================================
    // 评价模块（含 Worker 代理上传，修复重复提交）
    // ================================================================
    showReviewForm: function(orderId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }

        DataService.getOrderDetail(orderId).then(function(order) {
            if (!order) {
                Utils.toast('订单不存在');
                return;
            }
            if (order.hasReview) {
                Utils.toast('您已经评价过该订单');
                return;
            }
            if (!order.items || order.items.length === 0) {
                Utils.toast('订单无商品可评价');
                return;
            }

            var self = window.ClientPages;
            self._uploadedImages = [];
            self._selectedSpec = {};
            self._isSubmittingReview = false;

            var product = order.items[0];

            var html = '<div class="modal-title">✍️ 评价商品</div>';
            html += '<div style="text-align:center;font-size:36px;padding:8px 0;">' + (product.emoji || '🍅') + '</div>';
            html += '<div style="text-align:center;font-weight:500;">' + product.name + '</div>';

            html += '<div style="margin:12px 0;">';
            html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">评分</label>';
            html += '<div style="display:flex;gap:8px;font-size:28px;" id="ratingStars">';
            html += '<span onclick="ClientPages._setRating(1)" style="cursor:pointer;">☆</span>';
            html += '<span onclick="ClientPages._setRating(2)" style="cursor:pointer;">☆</span>';
            html += '<span onclick="ClientPages._setRating(3)" style="cursor:pointer;">☆</span>';
            html += '<span onclick="ClientPages._setRating(4)" style="cursor:pointer;">☆</span>';
            html += '<span onclick="ClientPages._setRating(5)" style="cursor:pointer;">☆</span>';
            html += '</div>';
            html += '<input type="hidden" id="reviewRating" value="5">';
            html += '</div>';

            html += '<div style="margin:12px 0;">';
            html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">评价内容</label>';
            html += '<textarea id="reviewContent" rows="4" placeholder="说说您的使用感受..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;"></textarea>';
            html += '</div>';

            html += '<div style="margin:12px 0;">';
            html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">上传图片（最多6张）</label>';
            html += '<div id="reviewImagePreview" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;"></div>';
            html += '<label for="reviewImageInput" id="uploadBtnLabel" style="display:inline-block;padding:8px 16px;background:var(--primary);color:#fff;border-radius:6px;cursor:pointer;font-size:13px;">📲 选择图片</label>';
            html += '<input type="file" id="reviewImageInput" accept="image/*" multiple style="display:none;" onchange="ClientPages._handleReviewImages(event)">';
            html += '<span style="font-size:11px;color:#999;margin-left:8px;">支持 JPG/PNG，每张不超过5MB</span>';
            html += '</div>';

            html += '<div style="margin:12px 0;">';
            html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">标签（点击选择）</label>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;" id="reviewTags">';
            var tags = ['新鲜', '好吃', '份量足', '性价比高', '包装好', '送货快', '会回购'];
            tags.forEach(function(tag) {
                html += '<span class="review-tag" onclick="ClientPages._toggleReviewTag(this)" style="padding:4px 12px;border:1px solid #ddd;border-radius:14px;font-size:12px;cursor:pointer;">' + tag + '</span>';
            });
            html += '</div>';
            html += '</div>';

            html += '<div class="form-actions">';
            html += '<button class="btn-cancel" onclick="window.closeModal()">取消</button>';
            html += '<button class="btn-submit" id="submitReviewBtn" onclick="ClientPages._submitReview(\'' + orderId + '\',\'' + product.productId + '\')">提交评价</button>';
            html += '</div>';

            var content = document.getElementById('modalContent');
            if (content) content.innerHTML = html;
            var overlay = document.getElementById('modalOverlay');
            if (overlay) overlay.classList.add('active');

            self._setRating(5);
        }).catch(function(err) {
            Utils.toast('加载订单信息失败: ' + err.message);
        });
    },

    _setRating: function(rating) {
        document.getElementById('reviewRating').value = rating;
        var stars = document.querySelectorAll('#ratingStars span');
        for (var i = 0; i < 5; i++) {
            stars[i].textContent = i < rating ? '★' : '☆';
            stars[i].style.color = i < rating ? '#ff6b00' : '#ccc';
        }
    },

    _toggleReviewTag: function(el) {
        el.classList.toggle('active');
        if (el.classList.contains('active')) {
            el.style.borderColor = 'var(--primary)';
            el.style.background = 'var(--primary-light)';
        } else {
            el.style.borderColor = '#ddd';
            el.style.background = 'transparent';
        }
    },

    _handleReviewImages: function(event) {
        var files = event.target.files;
        var self = this;

        for (var i = 0; i < files.length; i++) {
            if (self._uploadedImages.length >= self._maxImages) {
                Utils.toast('最多上传' + self._maxImages + ' 张图片');
                break;
            }
            var file = files[i];
            if (!file.type.startsWith('image/')) {
                Utils.toast('请选择图片文件');
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                Utils.toast('图片不能超过5MB');
                continue;
            }

            var reader = new FileReader();
            reader.onload = function(e) {
                var previewContainer = document.getElementById('reviewImagePreview');
                if (!previewContainer) return;

                var wrapper = document.createElement('div');
                wrapper.style.cssText = 'position:relative;width:72px;height:72px;border-radius:6px;overflow:hidden;border:1px solid #ddd;';

                var img = document.createElement('img');
                img.src = e.target.result;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';

                var removeBtn = document.createElement('button');
                removeBtn.textContent = '✕';
                removeBtn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:#ff3b30;color:#fff;font-size:12px;cursor:pointer;line-height:1;';
                removeBtn.onclick = function(e) {
                    e.stopPropagation();
                    wrapper.remove();
                    var idx = self._uploadedImages.indexOf(file);
                    if (idx > -1) self._uploadedImages.splice(idx, 1);
                };

                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                previewContainer.appendChild(wrapper);

                self._uploadedImages.push(file);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    },

    _uploadReviewImages: function(userId) {
        var self = this;
        var uploadPromises = [];

        self._uploadedImages.forEach(function(file) {
            var promise = DataService.uploadReviewImageViaWorker(userId, file)
                .then(function(result) {
                    if (result.success) {
                        return result.publicUrl;
                    }
                    return null;
                })
                .catch(function(err) {
                    console.warn('图片上传失败:', err);
                    return null;
                });
            uploadPromises.push(promise);
        });

        return Promise.all(uploadPromises).then(function(urls) {
            return urls.filter(function(url) { return url; });
        });
    },

    _submitReview: function(orderId, productId) {
        if (this._isSubmittingReview) {
            Utils.toast('正在提交，请勿重复点击');
            return;
        }

        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }

        var rating = parseInt(document.getElementById('reviewRating').value) || 5;
        var content = document.getElementById('reviewContent').value.trim();
        if (!content) {
            Utils.toast('请填写评价内容');
            return;
        }

        var tags = [];
        document.querySelectorAll('#reviewTags .review-tag.active').forEach(function(el) {
            tags.push(el.textContent.trim());
        });

        var self = this;
        var submitBtn = document.getElementById('submitReviewBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';
        }
        self._isSubmittingReview = true;

        Utils.toast('⏳ 上传图片...');

        this._uploadReviewImages(user.id).then(function(imageUrls) {
            Utils.toast('⏳ 提交评价...');
            DataService.submitReview(orderId, productId, user.id, rating, content, JSON.stringify(imageUrls), JSON.stringify(tags))
                .then(function() {
                    Utils.toast('✅ 评价已提交，感谢您的反馈！');
                    window.closeModal();
                    window.ClientPages.renderOrders();
                })
                .catch(function(err) {
                    Utils.toast('评价提交失败: ' + err.message);
                })
                .finally(function() {
                    self._isSubmittingReview = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '提交评价';
                    }
                });
        }).catch(function(err) {
            Utils.toast('图片上传失败: ' + err.message);
            self._isSubmittingReview = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '提交评价';
            }
        });
    },

    // ================================================================
    // 商品详情弹窗
    // ================================================================
    showProductDetail: function(productId) {
        var self = this;
        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];
            var product = products.find(function(p) { return p.id === productId; });
            if (!product) {
                Utils.toast('商品不存在');
                return;
            }

            self._currentProductId = productId;
            self._currentReviewPage = 1;
            var user = Auth.getCurrentUser();
            var isFavorited = false;

            DataService.getProductSpecs(productId).then(function(specs) {
                if (user && user.id) {
                    DataService.getFavorites(user.id).then(function(favorites) {
                        if (Array.isArray(favorites)) {
                            isFavorited = favorites.some(function(f) { return f.product_id === productId; });
                        }
                        self._renderProductDetail(product, specs || [], isFavorited);
                    }).catch(function() {
                        self._renderProductDetail(product, specs || [], false);
                    });
                } else {
                    self._renderProductDetail(product, specs || [], false);
                }
            }).catch(function() {
                self._renderProductDetail(product, [], false);
            });
        }).catch(function(err) {
            Utils.toast('加载商品详情失败: ' + err.message);
        });
    },

    _renderProductDetail: function(product, specs, isFavorited) {
        var self = this;
        var stock = product.stock || 0;
        var stockText = stock <= 0 ? '已售罄' : '库存 ' + stock;
        var todayPickupText = product.today_pickup ? ' ✅ 今日可提' : '';
        var hotTag = product.is_hot ? ' 🔥 热卖' : '';
        var cart = DataService.getCart();
        var inCart = 0;
        var avgRating = product.avg_rating || 0;
        var reviewCount = product.review_count || 0;

        for (var key in cart) {
            if (cart.hasOwnProperty(key)) {
                var parts = key.split('_');
                if (parts[0] === product.id) {
                    inCart += cart[key];
                }
            }
        }

        var images = [];
        try {
            images = JSON.parse(product.images || '[]');
        } catch(e) { images = []; }

        var html = '<div class="modal-title">' + (product.emoji || '🍅') + ' ' + product.name + '</div>';

        if (images.length > 0) {
            html += '<div style="position:relative;overflow:hidden;border-radius:8px;margin-bottom:8px;">';
            html += '<div id="productImageCarousel" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:4px;padding:4px 0;">';
            images.forEach(function(img) {
                html += '<div style="flex-shrink:0;width:100%;scroll-snap-align:start;aspect-ratio:1/1;background:#f5f8f5;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px;">';
                html += '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">';
                html += '</div>';
            });
            html += '</div>';
            html += '<div style="display:flex;justify-content:center;gap:6px;padding:4px 0;">';
            images.forEach(function(img, idx) {
                html += '<span style="width:6px;height:6px;border-radius:50%;background:' + (idx === 0 ? 'var(--primary)' : '#ddd') + ';"></span>';
            });
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div style="text-align:center;font-size:56px;padding:8px 0;">' + (product.emoji || '🍅') + '</div>';
        }

        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>价格</span><span style="font-weight:600;color:#ff3b30;">' + Utils.formatPrice(product.price) + '/' + (product.unit || '份') + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>库存</span><span>' + stockText + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>分类</span><span>' + (product.category || '未分类') + '</span></div>';
        if (product.origin) {
            html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>产地</span><span>' + product.origin + '</span></div>';
        }
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>已售</span><span>' + (product.sales_count || 0) + ' 份</span></div>';
        html += '<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>状态</span><span>' + todayPickupText + hotTag + '</span></div>';
        if (product.description) {
            html += '<div style="padding:4px 0;color:var(--text-secondary);">📑 ' + product.description + '</div>';
        }

        if (reviewCount > 0) {
            html += '<div style="padding:4px 0;border-top:1px solid #f0f0f0;margin-top:4px;">⭐ 好评率' + (avgRating * 20).toFixed(0) + '%（' + reviewCount + '条评价）</div>';
        }

        if (specs && specs.length > 0) {
            html += '<div style="margin:8px 0;padding:8px;background:#f8f9fa;border-radius:6px;">';
            html += '<div style="font-size:13px;font-weight:500;margin-bottom:4px;">选择规格</div>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
            specs.forEach(function(spec, idx) {
                var selected = idx === 0 ? 'style="border-color:var(--primary);background:var(--primary-light);"' : '';
                var stockClass = spec.stock <= 0 ? ' style="opacity:0.4;cursor:not-allowed;"' : '';
                html += '<span class="spec-option" data-spec-id="' + spec.id + '" data-price="' + spec.price + '" data-stock="' + spec.stock + '" ' + selected + ' ' + stockClass + ' onclick="ClientPages._selectSpec(this, \'' + spec.id + '\', ' + spec.price + ', ' + spec.stock + ')">' +
                    spec.spec_name + ' ¥' + spec.price.toFixed(2) + (spec.stock > 0 ? ' (库存' + spec.stock + ')' : ' (已售罄)') +
                    '</span>';
            });
            html += '</div>';
            html += '</div>';
            if (specs.length > 0 && specs[0].stock > 0) {
                html += '<input type="hidden" id="selectedSpecId" value="' + specs[0].id + '">';
                html += '<input type="hidden" id="selectedSpecPrice" value="' + specs[0].price + '">';
            } else {
                html += '<input type="hidden" id="selectedSpecId" value="">';
                html += '<input type="hidden" id="selectedSpecPrice" value="' + product.price + '">';
            }
        } else {
            html += '<input type="hidden" id="selectedSpecId" value="">';
            html += '<input type="hidden" id="selectedSpecPrice" value="' + product.price + '">';
        }

        if (inCart > 0) {
            html += '<div style="padding:4px 0;color:var(--primary);">🛒 已选' + inCart + ' 份</div>';
        }

        html += '<div id="productReviewsPreview" style="margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;max-height:200px;overflow-y:auto;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:13px;font-weight:500;">用户评价</span>';
        if (reviewCount > 3) {
            html += '<span onclick="ClientPages._loadMoreReviews(\'' + product.id + '\')" style="font-size:12px;color:var(--primary);cursor:pointer;">查看全部 →</span>';
        }
        html += '</div>';
        html += '<div id="reviewListContainer"><div style="font-size:12px;color:#999;">加载中...</div></div>';
        html += '</div>';

        html += '<div class="form-actions" style="margin-top:12px;">';
        html += '<button class="btn-cancel" onclick="window.closeModal()">关闭</button>';
        html += '<button style="flex:1;padding:10px;border-radius:10px;font-weight:600;background:transparent;color:#ff6b00;border:1px solid #ff6b00;cursor:pointer;" onclick="ClientPages.toggleFavorite(\'' + product.id + '\', this)">' + (isFavorited ? '❤️ 已收藏' : '🤍 收藏') + '</button>';
        var disabled = stock <= 0 ? 'disabled style="opacity:0.4;"' : '';
        html += '<button class="btn-submit" onclick="ClientPages._addToCartWithSpec(\'' + product.id + '\')" ' + disabled + '>加入购物车</button>';
        html += '</div>';
        if (stock > 0 && stock < 10) {
            html += '<div style="text-align:center;font-size:12px;color:#ff3b30;margin-top:4px;">⚠️ 仅剩 ' + stock + ' 份，欲购从速</div>';
        }

        var content = document.getElementById('modalContent');
        if (content) content.innerHTML = html;
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('active');

        DataService.getProductReviews(product.id, 'latest', null, 1, 5).then(function(result) {
            self._currentReviews = result.reviews || [];
            var container = document.getElementById('reviewListContainer');
            if (!container) return;
            if (!self._currentReviews || self._currentReviews.length === 0) {
                container.innerHTML = '<div style="font-size:12px;color:#999;">暂无评价</div>';
                return;
            }
            var reviewsHtml = self._currentReviews.map(function(r) {
                var stars = '';
                for (var i = 0; i < 5; i++) {
                    stars += i < r.rating ? '★' : '☆';
                }
                var imgHtml = '';
                if (r.images && r.images.length > 0) {
                    var imgs = Array.isArray(r.images) ? r.images : JSON.parse(r.images);
                    if (imgs && imgs.length > 0) {
                        imgHtml = '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">';
                        imgs.slice(0, 3).forEach(function(imgUrl) {
                            imgHtml += '<img src="' + imgUrl + '" style="width:48px;height:48px;border-radius:4px;object-fit:cover;border:1px solid #eee;" onerror="this.style.display=\'none\'">';
                        });
                        if (imgs.length > 3) {
                            imgHtml += '<span style="font-size:11px;color:#999;display:flex;align-items:center;">+' + (imgs.length - 3) + '</span>';
                        }
                        imgHtml += '</div>';
                    }
                }
                return '<div style="padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">' +
                    '<span style="color:#ff6b00;">' + stars + '</span> ' +
                    '<span style="font-size:12px;color:#999;">' + (r.user_phone ? r.user_phone.slice(-4) : '用户') + '</span>' +
                    '<div style="margin-top:2px;">' + r.content + '</div>' +
                    imgHtml +
                    (r.reply ? '<div style="font-size:12px;color:#666;background:#f8f8f8;padding:4px 8px;border-radius:4px;margin-top:2px;">商家回复：' + r.reply + '</div>' : '') +
                    '</div>';
            }).join('');
            container.innerHTML = reviewsHtml;
        }).catch(function() {
            var container = document.getElementById('reviewListContainer');
            if (container) container.innerHTML = '<div style="font-size:12px;color:#999;">加载评价失败</div>';
        });
    },

    _loadMoreReviews: function(productId) {
        var self = this;
        self._currentReviewPage++;
        DataService.getProductReviews(productId, 'latest', null, self._currentReviewPage, 10).then(function(result) {
            if (!result.reviews || result.reviews.length === 0) {
                Utils.toast('没有更多评价了');
                return;
            }
            var container = document.getElementById('reviewListContainer');
            if (!container) return;
            var newReviews = result.reviews || [];
            self._currentReviews = self._currentReviews.concat(newReviews);
            var reviewsHtml = self._currentReviews.map(function(r) {
                var stars = '';
                for (var i = 0; i < 5; i++) {
                    stars += i < r.rating ? '★' : '☆';
                }
                var imgHtml = '';
                if (r.images && r.images.length > 0) {
                    var imgs = Array.isArray(r.images) ? r.images : JSON.parse(r.images);
                    if (imgs && imgs.length > 0) {
                        imgHtml = '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">';
                        imgs.slice(0, 3).forEach(function(imgUrl) {
                            imgHtml += '<img src="' + imgUrl + '" style="width:48px;height:48px;border-radius:4px;object-fit:cover;border:1px solid #eee;" onerror="this.style.display=\'none\'">';
                        });
                        if (imgs.length > 3) {
                            imgHtml += '<span style="font-size:11px;color:#999;display:flex;align-items:center;">+' + (imgs.length - 3) + '</span>';
                        }
                        imgHtml += '</div>';
                    }
                }
                return '<div style="padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:13px;">' +
                    '<span style="color:#ff6b00;">' + stars + '</span> ' +
                    '<span style="font-size:12px;color:#999;">' + (r.user_phone ? r.user_phone.slice(-4) : '用户') + '</span>' +
                    '<div style="margin-top:2px;">' + r.content + '</div>' +
                    imgHtml +
                    (r.reply ? '<div style="font-size:12px;color:#666;background:#f8f8f8;padding:4px 8px;border-radius:4px;margin-top:2px;">商家回复：' + r.reply + '</div>' : '') +
                    '</div>';
            }).join('');
            container.innerHTML = reviewsHtml;
            if (result.reviews.length < 10) {
                Utils.toast('已加载全部评价');
            } else {
                Utils.toast('已加载更多评价');
            }
        }).catch(function(err) {
            Utils.toast('加载评价失败: ' + err.message);
        });
    },

    _selectSpec: function(el, specId, price, stock) {
        if (stock <= 0) {
            Utils.toast('该规格已售罄');
            return;
        }
        document.querySelectorAll('.spec-option').forEach(function(opt) {
            opt.style.borderColor = '#ddd';
            opt.style.background = 'transparent';
        });
        el.style.borderColor = 'var(--primary)';
        el.style.background = 'var(--primary-light)';
        document.getElementById('selectedSpecId').value = specId;
        document.getElementById('selectedSpecPrice').value = price;
    },

    _addToCartWithSpec: function(productId) {
        var specId = document.getElementById('selectedSpecId') ? document.getElementById('selectedSpecId').value : '';
        if (specId) {
            this.addToCart(productId, specId);
        } else {
            this.addToCart(productId);
        }
        window.closeModal();
    },

    toggleFavorite: function(productId, btn) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.toggleFavorite(user.id, productId).then(function(result) {
            if (result.action === 'added') {
                Utils.toast('❤️ 已收藏');
                if (btn) btn.textContent = '❤️ 已收藏';
            } else {
                Utils.toast('已取消收藏');
                if (btn) btn.textContent = '🤍 收藏';
            }
        }).catch(function(err) {
            Utils.toast('操作失败: ' + err.message);
        });
    },

    renderFavorites: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.getFavorites(user.id).then(function(favorites) {
            if (!Array.isArray(favorites)) favorites = [];
            var container = document.getElementById('favoritesList') || document.getElementById('productGrid');
            if (!container) return;
            if (favorites.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">🤍</div><p>暂无收藏商品</p></div>';
                return;
            }
            var html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">';
            favorites.forEach(function(f) {
                html += '<div class="product-card" onclick="ClientPages.showProductDetail(\'' + f.product_id + '\')">' +
                    '<div class="product-img">' + (f.emoji || '🍅') + '</div>' +
                    '<div class="product-info">' +
                    '<div class="product-name">' + f.name + '</div>' +
                    '<div class="product-meta">' +
                    '<div class="product-price">' + Utils.formatPrice(f.price || 0) + '</div>' +
                    '<span style="font-size:12px;color:#999;">已售 ' + (f.sales_count || 0) + '份</span>' +
                    '</div></div></div>';
            });
            html += '</div>';
            container.innerHTML = html;
        }).catch(function(err) {
            Utils.toast('加载收藏失败: ' + err.message);
        });
    },

    renderCoupons: function() {
        var user = Auth.getCurrentUser();
        DataService.getCoupons(user ? user.id : null).then(function(result) {
            var container = document.getElementById('couponContainer');
            if (!container) return;
            var html = '<div class="admin-card"><div class="card-title">🎫 优惠券中心</div>';

            if (result.available && result.available.length > 0) {
                html += '<div style="margin-bottom:12px;"><div style="font-size:13px;font-weight:500;">可领取</div>';
                result.available.forEach(function(c) {
                    var claimed = c.user_claimed > 0;
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #e8ecf0;border-radius:6px;margin-bottom:6px;">' +
                        '<div><div style="font-weight:500;">' + c.name + '</div>' +
                        '<div style="font-size:12px;color:#666;">' + (c.type === 'discount' ? '折扣 ' + c.value + '折' : '满' + c.min_amount + ' 减' + c.value) + '</div>' +
                        '</div>' +
                        (claimed ? '<span style="color:#999;font-size:12px;">已领取</span>' : '<button onclick="ClientPages.claimCoupon(\'' + c.id + '\')" style="background:var(--primary);color:#fff;border:none;border-radius:16px;padding:4px 16px;font-size:12px;cursor:pointer;">领取</button>') +
                        '</div>';
                });
                html += '</div>';
            } else {
                html += '<p style="color:#999;">暂无可用优惠券</p>';
            }

            if (result.userCoupons && result.userCoupons.length > 0) {
                html += '<div style="margin-top:12px;"><div style="font-size:13px;font-weight:500;">我的优惠券</div>';
                result.userCoupons.forEach(function(uc) {
                    html += '<div style="display:flex;justify-content:space-between;padding:8px;border:1px solid #e8ecf0;border-radius:6px;margin-bottom:6px;">' +
                        '<div><div style="font-weight:500;">' + uc.name + '</div>' +
                        '<div style="font-size:12px;color:#666;">' + (uc.used ? '已使用' : '未使用') + ' · ' + (uc.expire_at || '').slice(0, 10) + '过期</div>' +
                        '</div>' +
                        (uc.used ? '<span style="color:#999;">已使用</span>' : '<span style="color:var(--primary);">可用</span>') +
                        '</div>';
                });
                html += '</div>';
            }

            html += '</div>';
            container.innerHTML = html;
        }).catch(function(err) {
            Utils.toast('加载优惠券失败: ' + err.message);
        });
    },

    claimCoupon: function(couponId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.claimCoupon(user.id, couponId).then(function() {
            Utils.toast('✅ 优惠券领取成功！');
            ClientPages.renderCoupons();
        }).catch(function(err) {
            Utils.toast('领取失败: ' + err.message);
        });
    },

    renderMessages: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.getMessages(user.id).then(function(result) {
            var container = document.getElementById('messageContainer');
            if (!container) return;
            var messages = result.messages || [];
            if (messages.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无消息</p></div>';
                return;
            }
            var html = '<div class="admin-card"><div class="card-title">📤 消息中心 <span style="font-size:12px;color:#999;">共' + messages.length + ' 条</span></div>';
            messages.forEach(function(msg) {
                var typeMap = { order: '📝 订单', system: '🔔 系统', promotion: '🎉 促销' };
                html += '<div style="padding:10px 0;border-bottom:1px solid #f5f5f5;' + (msg.is_read ? 'opacity:0.7;' : 'background:#f0faff;') + '" onclick="ClientPages.markMessageRead(\'' + msg.id + '\')">' +
                    '<div style="display:flex;justify-content:space-between;">' +
                    '<span style="font-weight:' + (msg.is_read ? '400' : '600') + ';">' + msg.title + '</span>' +
                    '<span style="font-size:12px;color:#999;">' + (msg.created_at || '').slice(0, 16) + '</span>' +
                    '</div>' +
                    '<div style="font-size:13px;color:#666;margin-top:2px;">' + msg.content + '</div>' +
                    (msg.link ? '<div style="font-size:12px;color:var(--primary);margin-top:4px;">查看详情 →</div>' : '') +
                    '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
            if (result.unread > 0) {
                var badge = document.getElementById('messageBadge');
                if (badge) { badge.textContent = result.unread; badge.style.display = 'flex'; }
            }
        }).catch(function(err) {
            Utils.toast('加载消息失败: ' + err.message);
        });
    },

    markMessageRead: function(messageId) {
        var user = Auth.getCurrentUser();
        if (!user) return;
        DataService.markMessageRead(messageId, user.id).then(function() {
            ClientPages.renderMessages();
            ClientPages.loadUnreadCount();
        }).catch(function() {});
    },

    showAfterSaleForm: function(orderId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        var html = '<div class="modal-title">🔧 申请售后</div>' +
            '<div style="margin:12px 0;">' +
            '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">售后类型</label>' +
            '<select id="afterSaleType" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">' +
            '<option value="refund">仅退款</option>' +
            '<option value="return">退货退款</option>' +
            '</select>' +
            '</div>' +
            '<div style="margin:12px 0;">' +
            '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">退款原因</label>' +
            '<select id="afterSaleReason" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">' +
            '<option value="质量问题">质量问题</option>' +
            '<option value="商品与描述不符">商品与描述不符</option>' +
            '<option value="发错货">发错货</option>' +
            '<option value="未收到货">未收到货</option>' +
            '<option value="其他">其他</option>' +
            '</select>' +
            '</div>' +
            '<div style="margin:12px 0;">' +
            '<label style="display:block;font-size:13px;color:#666;margin-bottom:4px;">详细说明</label>' +
            '<textarea id="afterSaleDesc" rows="3" placeholder="请详细描述问题..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:14px;"></textarea>' +
            '</div>' +
            '<div class="form-actions">' +
            '<button class="btn-cancel" onclick="window.closeModal()">取消</button>' +
            '<button class="btn-submit" onclick="ClientPages._submitAfterSale(\'' + orderId + '\')">提交申请</button>' +
            '</div>';

        var content = document.getElementById('modalContent');
        if (content) content.innerHTML = html;
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('active');
    },

    _submitAfterSale: function(orderId) {
        var user = Auth.getCurrentUser();
        if (!user) return;
        var type = document.getElementById('afterSaleType').value;
        var reason = document.getElementById('afterSaleReason').value;
        var description = document.getElementById('afterSaleDesc').value.trim();
        if (!description) {
            Utils.toast('请填写详细说明');
            return;
        }
        DataService.submitAfterSale(orderId, user.id, type, reason, description).then(function() {
            Utils.toast('✅ 售后申请已提交，请等待审核');
            window.closeModal();
        }).catch(function(err) {
            Utils.toast('提交失败: ' + err.message);
        });
    },

    renderAfterSales: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
            return;
        }
        DataService.getAfterSales(user.id).then(function(list) {
            if (!Array.isArray(list)) list = [];
            var container = document.getElementById('afterSalesContainer') || document.getElementById('orderList');
            if (!container) return;
            if (list.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔧</div><p>暂无售后记录</p></div>';
                return;
            }
            var statusMap = { pending: '待审核', approved: '已通过', rejected: '已拒绝', completed: '已完成' };
            var typeMap = { refund: '仅退款', return: '退货退款' };
            var html = '<div class="admin-card"><div class="card-title">🔧 售后记录</div>';
            list.forEach(function(a) {
                html += '<div style="padding:8px 0;border-bottom:1px solid #f5f5f5;">' +
                    '<div style="display:flex;justify-content:space-between;">' +
                    '<span>订单: ' + a.order_id + '</span>' +
                    '<span class="status-badge ' + a.status + '">' + (statusMap[a.status] || a.status) + '</span>' +
                    '</div>' +
                    '<div style="font-size:13px;color:#666;">' + (typeMap[a.type] || a.type) + ' - ' + a.reason + '</div>' +
                    (a.admin_reply ? '<div style="font-size:12px;color:#666;">回复: ' + a.admin_reply + '</div>' : '') +
                    '</div>';
            });
            html += '</div>';
            container.innerHTML = html;
        }).catch(function(err) {
            Utils.toast('加载售后记录失败: ' + err.message);
        });
    },

    renderProfile: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            document.getElementById('statOrders').textContent = '0';
            document.getElementById('statCompleted').textContent = '0';
            document.getElementById('statCart').textContent = '0';
            return;
        }

        DataService.getOrders().then(function(orders) {
            if (!Array.isArray(orders)) orders = [];
            var totalOrders = orders.length;
            var completed = orders.filter(function(o) { return o && o.status === 'completed'; }).length;

            var cart = DataService.getCart();
            if (!cart) cart = {};
            var cartCount = 0;
            try {
                cartCount = Object.values(cart).reduce(function(a, b) { return a + b; }, 0);
            } catch(e) { cartCount = 0; }

            var statOrders = document.getElementById('statOrders');
            var statCompleted = document.getElementById('statCompleted');
            var statCart = document.getElementById('statCart');

            if (statOrders) statOrders.textContent = totalOrders;
            if (statCompleted) statCompleted.textContent = completed;
            if (statCart) statCart.textContent = cartCount;

            this.loadUnreadCount();
        }.bind(this));
    },

    // ================================================================
    // 地址管理（修复回填可靠性）
    // ================================================================
    showAddressManager: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            if (confirm('请先登录后再管理地址，是否现在登录？')) {
                ClientApp.showLoginModal();
            }
            return;
        }

        DataService.getAddresses(user.id).then(function(addresses) {
            if (!Array.isArray(addresses)) addresses = [];
            addresses.sort(function(a, b) {
                if (a.is_default) return -1;
                if (b.is_default) return 1;
                return (b.created_at || '').localeCompare(a.created_at || '');
            });

            var html = this._renderAddressList(addresses, user);
            this._showAddressPage(html);
        }.bind(this));
    },

    _renderAddressList: function(addresses, user) {
        var html = '<div class="address-page-header">' +
            '<button class="address-page-back" onclick="ClientPages._hideAddressPage()">‹ 返回</button>' +
            '<span class="address-page-title">收货地址管理</span>' +
            '</div>' +
            '<div class="address-list-container">';

        if (!addresses.length) {
            html += '<div class="address-empty"><div class="empty-icon">📷</div><p>暂无地址，请添加</p></div>';
        } else {
            html += '<div class="address-list">';
            addresses.forEach(function(addr, index) {
                var tagDisplay = addr.tag ? ' <span class="address-tag">' + addr.tag + '</span>' : '';
                var defaultBadge = addr.is_default ? ' <span class="address-default-badge">默认</span>' : '';
                var lastUsedBadge = addr.last_used ? ' <span class="address-lastused">上次使用</span>' : '';

                var parts = [];
                if (addr.province) parts.push(addr.province);
                if (addr.city && addr.city !== addr.province) parts.push(addr.city);
                if (addr.district && addr.district !== addr.city) parts.push(addr.district);
                if (addr.address) parts.push(addr.address);
                var fullAddress = parts.join('');

                html += '<div class="address-item-wrapper" data-id="' + addr.id + '">' +
                    '<div class="address-item">' +
                    '<div class="address-item-content">' +
                    '<div class="address-item-header">' +
                    '<span class="address-item-name">' + (addr.name || '') + '</span> ' +
                    '<span class="address-item-phone">' + (addr.phone || '') + '</span>' +
                    tagDisplay + defaultBadge + lastUsedBadge +
                    '</div>' +
                    '<div class="address-item-detail">' + fullAddress + '</div>' +
                    '</div>' +
                    '<div class="address-item-actions">' +
                    '<button class="addr-btn-set-default" onclick="ClientPages.setDefaultAddress(\'' + addr.id + '\')">设为默认</button>' +
                    '<button class="addr-btn-edit" onclick="ClientPages.openAddressForm(\'' + addr.id + '\')">编辑</button>' +
                    '<button class="addr-btn-delete" onclick="ClientPages.deleteAddress(\'' + addr.id + '\')">删除</button>' +
                    '</div>' +
                    '</div>' +
                    '<div class="address-item-swipe">' +
                    '<button class="swipe-btn-set-default" onclick="ClientPages.setDefaultAddress(\'' + addr.id + '\')">置顶</button>' +
                    '<button class="swipe-btn-delete" onclick="ClientPages.deleteAddress(\'' + addr.id + '\')">删除</button>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }

        html += '<div class="address-add-btn-container">' +
            '<button class="address-add-btn" onclick="ClientPages.openAddressForm()">+ 添加收货地址</button>' +
            '</div>' +
            '</div>';

        return html;
    },

    _showAddressPage: function(html) {
        var existing = document.getElementById('addressPageContainer');
        if (existing) {
            existing.innerHTML = html;
            existing.style.display = 'block';
            this._initSwipe();
            return;
        }
        var container = document.createElement('div');
        container.id = 'addressPageContainer';
        container.className = 'address-page-container';
        container.innerHTML = html;
        document.body.appendChild(container);
        this._initSwipe();
    },

    _hideAddressPage: function() {
        var container = document.getElementById('addressPageContainer');
        if (container) {
            container.style.display = 'none';
        }
        this.addressPageMode = 'list';
        this.editingAddressId = null;
        this.renderProfile();
    },

    _initSwipe: function() {
        var wrappers = document.querySelectorAll('.address-item-wrapper');
        var threshold = 60;

        wrappers.forEach(function(wrapper) {
            var item = wrapper.querySelector('.address-item');
            if (!item) return;

            var startX = 0;
            var currentX = 0;
            var isDragging = false;

            wrapper.addEventListener('touchstart', function(e) {
                var touch = e.touches[0];
                startX = touch.clientX;
                currentX = 0;
                isDragging = true;

                document.querySelectorAll('.address-item-wrapper.swipe-open').forEach(function(el) {
                    if (el !== wrapper) {
                        el.classList.remove('swipe-open');
                        el.querySelector('.address-item').style.transform = 'translateX(0)';
                    }
                });
            }, { passive: true });

            wrapper.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                var touch = e.touches[0];
                var diff = touch.clientX - startX;
                var offset = Math.min(0, diff);
                offset = Math.max(-150, offset);
                item.style.transform = 'translateX(' + offset + 'px)';
                currentX = offset;
            }, { passive: true });

            wrapper.addEventListener('touchend', function(e) {
                if (!isDragging) return;
                isDragging = false;
                if (currentX < -threshold) {
                    wrapper.classList.add('swipe-open');
                    item.style.transform = 'translateX(-150px)';
                } else {
                    wrapper.classList.remove('swipe-open');
                    item.style.transform = 'translateX(0)';
                }
                currentX = 0;
            }, { passive: true });

            var mouseStartX = 0;
            var mouseDragging = false;

            wrapper.addEventListener('mousedown', function(e) {
                if (e.target.closest('.address-item-actions') || e.target.closest('.address-item-swipe')) return;
                mouseStartX = e.clientX;
                mouseDragging = true;
                currentX = 0;

                document.querySelectorAll('.address-item-wrapper.swipe-open').forEach(function(el) {
                    if (el !== wrapper) {
                        el.classList.remove('swipe-open');
                        el.querySelector('.address-item').style.transform = 'translateX(0)';
                    }
                });
            });

            document.addEventListener('mousemove', function(e) {
                if (!mouseDragging) return;
                var rect = wrapper.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                    wrapper.classList.remove('swipe-open');
                    item.style.transform = 'translateX(0)';
                    mouseDragging = false;
                    return;
                }
                var diff = e.clientX - mouseStartX;
                var offset = Math.min(0, diff);
                offset = Math.max(-150, offset);
                item.style.transform = 'translateX(' + offset + 'px)';
                currentX = offset;
            });

            document.addEventListener('mouseup', function(e) {
                if (!mouseDragging) return;
                mouseDragging = false;
                if (currentX < -threshold) {
                    wrapper.classList.add('swipe-open');
                    item.style.transform = 'translateX(-150px)';
                } else {
                    wrapper.classList.remove('swipe-open');
                    item.style.transform = 'translateX(0)';
                }
                currentX = 0;
            });
        });
    },

    openAddressForm: function(addressId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            if (confirm('请先登录后再管理地址，是否现在登录？')) {
                ClientApp.showLoginModal();
            }
            return;
        }

        this.editingAddressId = addressId || null;
        this.addressPageMode = 'form';

        DataService.getAddresses(user.id).then(function(addresses) {
            if (!Array.isArray(addresses)) addresses = [];
            var addr = null;
            if (addressId) {
                addr = addresses.find(function(a) { return a && a.id === addressId; });
            }

            var isEdit = !!addr;
            var title = isEdit ? '编辑地址' : '新增地址';

            var tagOptions = ['', '家', '公司', '学校'];
            var selectedTag = addr ? addr.tag : '';

            var province = addr && addr.province ? addr.province : '';
            var city = addr && addr.city ? addr.city : '';
            var district = addr && addr.district ? addr.district : '';

            var regionHtml = '';
            if (window.RegionData) {
                regionHtml = window.RegionData.renderSelects(province, city, district);
            }

            var lng = addr && addr.lng ? addr.lng : '';
            var lat = addr && addr.lat ? addr.lat : '';
            var addressValue = addr ? addr.address : '';

            var html = '<div class="address-page-header">' +
                '<button class="address-page-back" onclick="ClientPages._hideAddressForm()">‹ 返回</button>' +
                '<span class="address-page-title">' + title + '</span>' +
                '</div>' +
                '<div class="address-form-container">' +
                '<div class="address-form">' +
                '<div class="form-group"><label>收货人 *</label><input id="addr_name" value="' + (addr ? addr.name : '') + '" placeholder="收货人姓名"></div>' +
                '<div class="form-group"><label>手机号 *</label><input id="addr_phone" value="' + (addr ? addr.phone : '') + '" placeholder="收货人手机号"></div>' +
                '<div class="form-group"><label>地区 *</label>' + regionHtml + '</div>' +
                '<div class="form-group"><label>详细地址</label>' +
                '<input id="addr_address" value="' + addressValue + '" placeholder="街道、门牌号、小区、乡镇、村等（不含省市）" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:4px;">' +
                '<button class="locate-btn-full" onclick="ClientPages.fillAddressByLocation()" style="width:100%;background:var(--primary);color:#fff;padding:8px 0;border-radius:20px;font-size:13px;border:none;cursor:pointer;margin-top:4px;">📷 定位</button>' +
                '</div>' +
                '<div class="form-group"><label>地址标签</label>' +
                '<div class="tag-selector">';

            tagOptions.forEach(function(t) {
                var active = t === selectedTag ? 'active' : '';
                html += '<button class="tag-option ' + active + '" onclick="ClientPages._selectTag(\'' + t + '\')">' + (t || '无标签') + '</button>';
            });

            html += '</div></div>' +
                '<div class="form-group" style="display:flex;align-items:center;gap:8px;">' +
                '<label style="margin:0;">设为默认</label>' +
                '<input type="checkbox" id="addr_default" ' + (addr && addr.is_default ? 'checked' : '') + '>' +
                '</div>' +
                '<button class="address-save-btn" onclick="ClientPages.saveAddress()">保存</button>' +
                '</div></div>';

            this._showAddressPage(html);
            this._selectedTag = selectedTag;
            if (window.RegionData) {
                window.RegionData.bindEvents();
                // 强化回填
                if (province) {
                    setTimeout(function() {
                        window.RegionData.setSelected(province, city, district);
                    }, 100);
                }
            }
        }.bind(this));
    },

    _selectTag: function(tag) {
        this._selectedTag = tag;
        document.querySelectorAll('.tag-option').forEach(function(el) {
            el.classList.toggle('active', el.textContent === tag || (tag === '' && el.textContent === '无标签'));
        });
    },

    _hideAddressForm: function() {
        this.addressPageMode = 'list';
        this.editingAddressId = null;
        this.showAddressManager();
    },

    fillAddressByLocation: function() {
        LocationHelper.pickAddress({
            addressInputId: 'addr_address',
            regionData: window.RegionData,
            modalTitle: '选择收货地址'
        });
    },

    saveAddress: function() {
        var nameInput = document.getElementById('addr_name');
        var phoneInput = document.getElementById('addr_phone');
        var addressInput = document.getElementById('addr_address');
        var defaultCheck = document.getElementById('addr_default');

        if (!nameInput || !phoneInput || !addressInput || !defaultCheck) {
            Utils.toast('❌ 页面错误，请刷新后重试');
            return;
        }

        var name = nameInput.value.trim();
        var phone = phoneInput.value.trim();
        var address = addressInput.value.trim();
        var isDefault = defaultCheck.checked;
        var tag = this._selectedTag || '';

        var addrInput = document.getElementById('addr_address');
        var lng = addrInput ? parseFloat(addrInput.dataset.lng) || null : null;
        var lat = addrInput ? parseFloat(addrInput.dataset.lat) || null : null;
        var province = '';
        var city = '';
        var district = '';
        var street = addrInput ? addrInput.dataset.street || '' : '';

        if (window.RegionData) {
            var selected = window.RegionData.getSelected();
            if (selected && selected.province) {
                province = selected.province;
                city = selected.city || '';
                district = selected.district || '';
            }
        }

        if (!name) {
            Utils.toast('❌ 请填写收货人姓名');
            return;
        }
        if (!phone) {
            Utils.toast('❌ 请填写手机号');
            return;
        }
        if (!/^\d{11}$/.test(phone)) {
            Utils.toast('❌ 手机号必须为11位数字');
            return;
        }
        if (!address) {
            Utils.toast('❌ 请填写详细地址');
            return;
        }
        if (!province || !city || !district) {
            Utils.toast('❌ 请选择地区（省/市/区）');
            return;
        }

        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('❌ 用户未登录');
            return;
        }

        var finalData = {
            id: this.editingAddressId || undefined,
            name: name,
            phone: phone,
            address: address,
            tag: tag,
            lng: lng,
            lat: lat,
            province: province,
            city: city,
            district: district,
            street: street,
            isDefault: isDefault,
            lastUsed: false
        };

        DataService.saveAddress(user.id, finalData)
            .then(function(response) {
                Utils.toast('✅ 地址已保存');
                window.ClientPages.addressPageMode = 'list';
                window.ClientPages.editingAddressId = null;
                window.ClientPages.showAddressManager();
            })
            .catch(function(err) {
                Utils.toast('❌ 保存失败: ' + (err.message || '未知错误'));
            });
    },

    deleteAddress: function(id) {
        if (!confirm('确定删除该地址吗？')) return;
        var user = Auth.getCurrentUser();
        if (!user) return;

        DataService.deleteAddress(id, user.id).then(function() {
            Utils.toast('已删除');
            if (window.ClientPages.addressPageMode === 'list') {
                window.ClientPages.showAddressManager();
            }
        }).catch(function(err) {
            Utils.toast('删除失败: ' + err.message);
        });
    },

    setDefaultAddress: function(id) {
        var user = Auth.getCurrentUser();
        if (!user) return;

        DataService.getAddresses(user.id).then(function(addresses) {
            if (!Array.isArray(addresses)) addresses = [];

            var updates = addresses.map(function(addr) {
                if (!addr) return Promise.resolve();
                var isDefault = (addr.id === id);
                return DataService.saveAddress(user.id, {
                    id: addr.id,
                    name: addr.name || '',
                    phone: addr.phone || '',
                    address: addr.address || '',
                    tag: addr.tag || '',
                    lng: addr.lng || null,
                    lat: addr.lat || null,
                    province: addr.province || '',
                    city: addr.city || '',
                    district: addr.district || '',
                    street: addr.street || '',
                    isDefault: isDefault,
                    lastUsed: addr.last_used || false
                });
            });

            Promise.all(updates).then(function() {
                Utils.toast('已设为默认');
                if (window.ClientPages.addressPageMode === 'list') {
                    window.ClientPages.showAddressManager();
                }
            });
        });
    }
};