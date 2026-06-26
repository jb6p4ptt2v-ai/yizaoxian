window.ClientPages = {
    app: null,
    currentCategory: '全部',
    currentOrderStatus: '全部',
    addressPageMode: 'list',
    editingAddressId: null,
    _selectedTag: '',

    init: function(app) {
        this.app = app;
        if (window.RegionData && window.RegionData.init) {
            window.RegionData.init();
        }
    },

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
                           (p.description && p.description.toLowerCase().includes(keyword));
                });
            }

            list.sort(function(a, b) {
                return (b.created_at || '').localeCompare(a.created_at || '');
            });

            if (!list.length) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🌿</div><p>暂无商品</p></div>';
                return;
            }

            var cart = DataService.getCart();
            if (!cart) cart = {};

            grid.innerHTML = list.map(function(p) {
                var stock = p.stock || 0;
                var inCart = cart[p.id] || 0;
                return '<div class="product-card">' +
                    '<div class="product-img">' + (p.emoji || '🥬') + '</div>' +
                    '<div class="product-info">' +
                    '<div class="product-name">' + (p.name || '未命名') + '</div>' +
                    '<div style="font-size:12px;color:var(--text-secondary);">' + (p.unit || '份') + '</div>' +
                    '<div class="product-meta">' +
                    '<div><span class="product-price">' + Utils.formatPrice(p.price || 0) + '</span>' +
                    (stock < 10 ? '<span style="font-size:11px;color:#ff3b30;margin-left:4px;">仅剩' + stock + '</span>' : '') +
                    '</div>' +
                    '<button class="add-cart-btn" onclick="ClientPages.addToCart(\'' + p.id + '\')" ' + (stock <= 0 ? 'disabled style="opacity:0.4;"' : '') + '>+</button>' +
                    '</div>' +
                    (inCart > 0 ? '<div style="font-size:12px;color:var(--primary);margin-top:2px;">已选 ' + inCart + ' 份</div>' : '') +
                    '<div class="stock-tag">' + (stock > 0 ? '库存 ' + stock : '🟡 缺货') + '</div>' +
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

    addToCart: function(productId) {
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
            Utils.toast('已添加 ' + (product.name || '商品'));
        });
    },

    removeFromCart: function(productId) {
        var cart = DataService.getCart();
        if (!cart) cart = {};
        if (cart[productId]) {
            cart[productId]--;
            if (cart[productId] <= 0) delete cart[productId];
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
        var ids = Object.keys(cart);

        if (!ids.length) {
            list.innerHTML = '';
            empty.style.display = 'block';
            footer.classList.add('hidden');
            return;
        }

        DataService.getProducts().then(function(products) {
            if (!Array.isArray(products)) products = [];
            var items = [];
            var total = 0;

            ids.forEach(function(id) {
                var p = products.find(function(pr) { return pr.id === id; });
                if (p && cart[id] > 0) {
                    items.push({
                        id: p.id,
                        name: p.name || '未命名',
                        price: p.price || 0,
                        qty: cart[id],
                        emoji: p.emoji || '🥬'
                    });
                    total += p.price * cart[id];
                } else {
                    delete cart[id];
                }
            });

            DataService.saveCart(cart);

            if (!items.length) {
                list.innerHTML = '';
                empty.style.display = 'block';
                footer.classList.add('hidden');
                return;
            }

            empty.style.display = 'none';
            footer.classList.remove('hidden');

            list.innerHTML = items.map(function(item) {
                return '<div class="cart-item">' +
                    '<div style="font-size:28px;">' + item.emoji + '</div>' +
                    '<div class="item-info"><div class="item-name">' + item.name + '</div><div class="item-price">' + Utils.formatPrice(item.price) + '</div></div>' +
                    '<div class="item-qty">' +
                    '<button onclick="ClientPages.removeFromCart(\'' + item.id + '\')">−</button>' +
                    '<span class="qty-num">' + item.qty + '</span>' +
                    '<button onclick="ClientPages.addToCart(\'' + item.id + '\')">+</button>' +
                    '</div></div>';
            }).join('');

            var totalEl = document.getElementById('cartTotalPrice');
            if (totalEl) totalEl.textContent = Utils.formatPrice(total);

            var btn = document.getElementById('checkoutBtn');
            if (btn) btn.disabled = false;

            if (window.ClientApp) window.ClientApp.updateBadges();
        });
    },

    showCheckout: function() {
        var cart = DataService.getCart();
        if (!cart) cart = {};
        var ids = Object.keys(cart);
        if (!ids.length) {
            Utils.toast('购物车是空的');
            return;
        }

        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
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
            addresses.forEach(function(addr) {
                if (!addr) return;
                var tagDisplay = addr.tag ? ' [' + addr.tag + ']' : '';
                var lastUsedDisplay = addr.last_used ? ' <span style="font-size:11px;color:var(--text-secondary);">上次使用</span>' : '';
                html += '<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">' +
                    '<div><div><strong>' + (addr.name || '') + '</strong> ' + (addr.phone || '') + tagDisplay + (addr.is_default ? ' <span style="color:var(--primary);font-size:12px;">默认</span>' : '') + lastUsedDisplay + '</div>' +
                    '<div style="font-size:13px;color:var(--text-secondary);">' + (addr.address || '') + '</div></div>' +
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
            var ids = Object.keys(cart);
            if (!ids.length) {
                Utils.toast('购物车是空的');
                return;
            }

            DataService.getProducts().then(function(products) {
                if (!Array.isArray(products)) products = [];
                var items = [];
                var total = 0;
                var stockOk = true;

                ids.forEach(function(id) {
                    var p = products.find(function(pr) { return pr.id === id; });
                    if (!p || (p.stock || 0) < cart[id]) {
                        stockOk = false;
                        Utils.toast('商品 ' + (p ? p.name : id) + ' 库存不足');
                        return;
                    }
                    items.push({
                        productId: p.id,
                        name: p.name || '未命名',
                        price: p.price || 0,
                        quantity: cart[id]
                    });
                    total += p.price * cart[id];
                });

                if (!stockOk || !items.length) return;

                var updateData = {
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
                    isDefault: addr.is_default || false,
                    lastUsed: true
                };

                DataService.saveAddress(user.id, updateData).then(function() {
                    var orderData = {
                        customerName: addr.name || '用户',
                        customerPhone: addr.phone || '',
                        address: addr.address || '',
                        addressId: addr.id,
                        items: items,
                        total: total
                    };

                    DataService.saveOrder(orderData).then(function() {
                        DataService.saveCart({});
                        if (window.ClientApp) window.ClientApp.updateBadges();
                        window.ClientPages.renderCart();
                        window.ClientPages.renderProducts();
                        Utils.toast('🎉 下单成功！');
                        if (window.ClientApp) window.ClientApp.navigateTo('orders');
                    });
                });
            });
        });
    },

    renderOrders: function() {
        var list = document.getElementById('orderList');
        var empty = document.getElementById('orderEmpty');
        if (!list || !empty) return;

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

            var statusMap = { pending: '待发货', shipped: '配送中', completed: '已完成', cancelled: '已取消' };
            var statusCls = { pending: 'pending', shipped: 'shipped', completed: 'completed', cancelled: 'cancelled' };

            list.innerHTML = orders.map(function(o) {
                if (!o) return '';
                var itemsHtml = '';
                if (Array.isArray(o.items)) {
                    itemsHtml = o.items.map(function(i) { return (i.name || '') + ' × ' + (i.quantity || 0); }).join('、');
                }
                return '<div class="order-card">' +
                    '<div class="order-header"><span class="order-id">' + (o.id || '') + '</span><span class="order-status ' + (statusCls[o.status] || '') + '">' + (statusMap[o.status] || o.status || '未知') + '</span></div>' +
                    '<div class="order-items">' + itemsHtml + '</div>' +
                    '<div class="order-total">' + Utils.formatPrice(o.total || 0) + '</div>' +
                    '<div class="order-address">📍 ' + (o.address || '默认地址') + ' · ' + (o.created_at || '') + '</div>' +
                    (o.status === 'pending' ? '<button onclick="ClientPages.cancelOrder(\'' + o.id + '\')" style="margin-top:6px;font-size:12px;color:#ff3b30;background:none;border:1px solid #ff3b30;border-radius:12px;padding:2px 14px;">取消订单</button>' : '') +
                    (o.status === 'shipped' ? '<button onclick="ClientPages.confirmOrder(\'' + o.id + '\')" style="margin-top:6px;font-size:12px;color:var(--primary);background:none;border:1px solid var(--primary);border-radius:12px;padding:2px 14px;">确认收货</button>' : '') +
                    '</div>';
            }).join('');
        }).catch(function(err) {
            list.innerHTML = '<div class="empty-state"><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    filterOrders: function(status) {
        this.currentOrderStatus = status;
        document.querySelectorAll('#clientApp .order-tabs .order-tab').forEach(function(t) {
            t.classList.toggle('active', t.dataset.status === status);
        });
        this.renderOrders();
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
        }).catch(function(err) {
            Utils.toast('确认失败: ' + err.message);
        });
    },

    renderProfile: function() {
        var user = Auth.getCurrentUser();
        if (!user) return;

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
            var profileName = document.getElementById('profileName');
            var profilePhone = document.getElementById('profilePhone');

            if (statOrders) statOrders.textContent = totalOrders;
            if (statCompleted) statCompleted.textContent = completed;
            if (statCart) statCart.textContent = cartCount;
            if (profileName) profileName.textContent = '用户 ' + user.phone.slice(-4);
            if (profilePhone) profilePhone.textContent = user.phone;
        });
    },

    // ================================================================
    // ★★★ 地址管理（拼多多风格：列表+左滑+定位弹窗） ★★★
    // ================================================================

    showAddressManager: function() {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
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
            html += '<div class="address-empty"><div class="empty-icon">📍</div><p>暂无地址，请添加</p></div>';
        } else {
            html += '<div class="address-list">';
            addresses.forEach(function(addr, index) {
                var tagDisplay = addr.tag ? ' <span class="address-tag">' + addr.tag + '</span>' : '';
                var defaultBadge = addr.is_default ? ' <span class="address-default-badge">默认</span>' : '';
                var lastUsedBadge = addr.last_used ? ' <span class="address-lastused">上次使用</span>' : '';
                html += '<div class="address-item-wrapper" data-id="' + addr.id + '">' +
                    '<div class="address-item">' +
                    '<div class="address-item-content">' +
                    '<div class="address-item-header">' +
                    '<span class="address-item-name">' + (addr.name || '') + '</span> ' +
                    '<span class="address-item-phone">' + (addr.phone || '') + '</span>' +
                    tagDisplay + defaultBadge + lastUsedBadge +
                    '</div>' +
                    '<div class="address-item-detail">' + (addr.address || '') + '</div>' +
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
            // 重新绑定左滑
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

    // ================================================================
    // ★★★ 左滑交互（拼多多风格） ★★★
    // ================================================================
    _initSwipe: function() {
        var wrappers = document.querySelectorAll('.address-item-wrapper');
        var threshold = 60;

        wrappers.forEach(function(wrapper) {
            var item = wrapper.querySelector('.address-item');
            var swipe = wrapper.querySelector('.address-item-swipe');

            if (!item || !swipe) return;

            var startX = 0;
            var currentX = 0;
            var isDragging = false;

            // 触摸事件
            wrapper.addEventListener('touchstart', function(e) {
                var touch = e.touches[0];
                startX = touch.clientX;
                currentX = 0;
                isDragging = true;

                // 关闭其他已展开的
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
                // 只允许左滑（负值），右滑回弹
                var offset = Math.min(0, diff);
                // 限制最大左滑距离为150px
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

            // 鼠标事件（PC调试支持）
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
                // 检测是否在wrapper内
                var rect = wrapper.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                    // 鼠标移出wrapper，回弹
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

    // ================================================================
    // ★★★ 地址表单 ★★★
    // ================================================================
    openAddressForm: function(addressId) {
        var user = Auth.getCurrentUser();
        if (!user) {
            Utils.toast('请先登录');
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
                '<input id="addr_address" value="' + addressValue + '" placeholder="如街道、门牌号、小区、乡镇、村等" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:4px;">' +
                '<button class="locate-btn-full" onclick="ClientPages.fillAddressByLocation()" style="width:100%;background:var(--primary);color:#fff;padding:8px 0;border-radius:20px;font-size:13px;border:none;cursor:pointer;margin-top:4px;">📍 定位</button>' +
                '<button class="locate-btn-full" onclick="ClientPages.openMapPickerForAddress(\'' + lng + '\',\'' + lat + '\')" style="width:100%;background:var(--primary);color:#fff;padding:8px 0;border-radius:20px;font-size:13px;border:none;cursor:pointer;margin-top:4px;">🗺️ 地图选点</button>' +
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

    // ★★★ 定位填充（调用公共模块 LocationHelper） ★★★
    fillAddressByLocation: function() {
        LocationHelper.pickAddress({
            addressInputId: 'addr_address',
            regionData: window.RegionData,
            modalTitle: '选择收货地址'
        });
    },

    _showAddressPicker: function() {},

    openMapPickerForAddress: function(lng, lat) {
        var self = this;
        var addrInput = document.getElementById('addr_address');
        var currentAddress = addrInput ? addrInput.value : '';
        var currentLng = lng ? parseFloat(lng) : (addrInput ? parseFloat(addrInput.dataset.lng) : null);
        var currentLat = lat ? parseFloat(lat) : (addrInput ? parseFloat(addrInput.dataset.lat) : null);

        if (!MapService._isInitialized) {
            Utils.toast('⏳ 地图加载中，请稍后...');
            MapService._loadMap(function() {
                self.openMapPickerForAddress(lng, lat);
            });
            return;
        }

        MapService.openMapPicker(function(result) {
            console.log('🗺️ 地图选点结果:', result);
            if (result && result.address) {
                var addrInput2 = document.getElementById('addr_address');
                if (addrInput2) {
                    var fullAddress = result.address || '';
                    var streetPart = fullAddress;

                    var province = result.province || '';
                    var city = result.city || '';
                    var district = result.district || '';

                    var prefixToRemove = '';
                    if (province) prefixToRemove += province;
                    if (city && city !== province) prefixToRemove += city;
                    if (district && district !== city) prefixToRemove += district;

                    if (prefixToRemove) {
                        streetPart = fullAddress.replace(prefixToRemove, '').trim();
                        streetPart = streetPart.replace(/^[-,，、\s]+/, '');
                    }
                    if (!streetPart || streetPart.length < 2) {
                        streetPart = fullAddress;
                    }

                    addrInput2.value = streetPart;
                    addrInput2.dataset.lng = result.lng || '';
                    addrInput2.dataset.lat = result.lat || '';
                    addrInput2.dataset.province = result.province || '';
                    addrInput2.dataset.city = result.city || '';
                    addrInput2.dataset.district = result.district || '';
                    addrInput2.dataset.street = result.street || '';
                }
                if (window.RegionData) {
                    window.RegionData.setSelected(result.province, result.city, result.district);
                }
                Utils.toast('✅ 已选择地址');
            }
        }, currentAddress, currentLng, currentLat);
    },

    saveAddress: function() {
        console.log('💾 保存按钮被点击');

        var nameInput = document.getElementById('addr_name');
        var phoneInput = document.getElementById('addr_phone');
        var addressInput = document.getElementById('addr_address');
        var defaultCheck = document.getElementById('addr_default');

        if (!nameInput || !phoneInput || !addressInput || !defaultCheck) {
            console.error('❌ 表单元素缺失');
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

        console.log('📤 执行保存:', finalData);
        Utils.toast('⏳ 保存中...');

        DataService.saveAddress(user.id, finalData)
            .then(function(response) {
                console.log('✅ 保存成功:', response);
                Utils.toast('✅ 地址已保存');
                window.ClientPages.addressPageMode = 'list';
                window.ClientPages.editingAddressId = null;
                window.ClientPages.showAddressManager();
            })
            .catch(function(err) {
                console.error('❌ 保存失败:', err);
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