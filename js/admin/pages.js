window.AdminPages = {
    render: function(page) {
        switch(page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'suppliers': this.renderSuppliers(); break;
            case 'products': this.renderProducts(); break;
            case 'inventory': this.renderInventory(); break;
            case 'orders': this.renderOrders(); break;
            case 'finance': this.renderFinance(); break;
            case 'backup': this.renderBackup(); break;
            case 'profile': this.renderProfile(); break;
            case 'members': this.renderMembers(); break;
        }
    },

    _hasPermission: function(perm) {
        var user = Auth.getCurrentAdmin();
        if (!user) return false;
        if (user.username === 'admin') return true;
        var perms = user.permissions || [];
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch(e) { perms = []; }
        }
        if (!Array.isArray(perms)) perms = [];
        return perms.indexOf(perm) !== -1;
    },

    // ================================================================
    // 概览
    // ================================================================
    renderDashboard: function() {
        if (!this._hasPermission('dashboard')) {
            var el = document.getElementById('admin-dashboard');
            if (el) el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getAppData().then(function(appData) {
            var products = appData.products || [];
            var orders = appData.orders || [];
            var totalStock = products.reduce(function(s, p) { return s + (p.stock || 0); }, 0);
            var pendingOrders = orders.filter(function(o) { return o && o.status === 'pending'; }).length;

            var html = '<div class="dashboard-grid">' +
                '<div class="dash-item"><div class="dash-num">' + products.length + '</div><div class="dash-label">商品数</div></div>' +
                '<div class="dash-item"><div class="dash-num">' + totalStock + '</div><div class="dash-label">总库存</div></div>' +
                '<div class="dash-item"><div class="dash-num">' + orders.length + '</div><div class="dash-label">总订单</div></div>' +
                '<div class="dash-item"><div class="dash-num" style="color:' + (pendingOrders ? '#ff6b6b' : 'var(--primary)') + ';">' + pendingOrders + '</div><div class="dash-label">待处理</div></div>' +
                '</div>';

            var pending = orders.filter(function(o) { return o && (o.status === 'pending' || o.status === 'shipped'); });
            var pendingHtml = '';
            if (!pending.length) {
                pendingHtml = '<div class="text-muted" style="padding:8px 0;">🎉 暂无待处理订单</div>';
            } else {
                pendingHtml = pending.slice(0,5).map(function(o) {
                    var itemsStr = '';
                    if (Array.isArray(o.items)) {
                        itemsStr = o.items.map(function(i) { return i.name || ''; }).join('、');
                    }
                    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
                        '<span>' + (o.id || '') + ' - ' + itemsStr + '</span>' +
                        '<span style="color:' + (o.status === 'pending' ? '#856404' : '#004085') + ';">' + (o.status === 'pending' ? '待发货' : '配送中') + '</span>' +
                        '</div>';
                }).join('');
                if (pending.length > 5) {
                    pendingHtml += '<div class="text-muted" style="padding:4px 0;font-size:12px;">还有 ' + (pending.length - 5) + ' 笔待处理...</div>';
                }
            }

            var el = document.getElementById('admin-dashboard');
            if (el) el.innerHTML = html + '<div class="admin-card"><div class="card-title">📈 近期待处理</div>' + pendingHtml + '</div>';
        }).catch(function(err) {
            var el = document.getElementById('admin-dashboard');
            if (el) el.innerHTML = '<div class="admin-card"><div class="card-title">加载失败</div><p>' + err.message + '</p></div>';
        });
    },

    // ================================================================
    // 供应商管理
    // ================================================================
    renderSuppliers: function() {
        if (!this._hasPermission('suppliers')) {
            var el = document.getElementById('admin-suppliers');
            if (el) el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getSuppliers().then(function(list) {
            if (!Array.isArray(list)) list = [];

            var html = '<div class="admin-card"><div class="card-title">供应商列表 <button class="btn-sm" onclick="AdminPages.openSupplierModal()">+ 添加</button></div>';

            if (!list.length) {
                html += '<div class="empty-state"><div class="empty-icon">🏢</div><p>暂无供应商</p></div>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>名称</th><th>联系人</th><th>电话</th><th>地址</th><th>操作</th></tr></thead><tbody>';
                list.forEach(function(s) {
                    if (!s) return;
                    html += '<tr><td>' + (s.name || '') + '</td><td>' + (s.contact || '-') + '</td><td>' + (s.phone || '-') + '</td><td style="font-size:12px;">' + (s.address || '-') + '</td>' +
                        '<td><div class="actions"><button class="primary" onclick="AdminPages.openSupplierModal(\'' + s.id + '\')">编辑</button><button class="danger" onclick="AdminPages.deleteSupplier(\'' + s.id + '\')">删除</button></div></td></tr>';
                });
                html += '</tbody></table>';
            }

            html += '</div>';
            var el = document.getElementById('admin-suppliers');
            if (el) el.innerHTML = html;
        }).catch(function(err) {
            var el = document.getElementById('admin-suppliers');
            if (el) el.innerHTML = '<div class="admin-card"><div class="card-title">供应商列表</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openSupplierModal: function(id) {
        var self = this;
        var promise = id ? DataService.getSuppliers().then(function(list) {
            if (!Array.isArray(list)) list = [];
            return list.find(function(s) { return s && s.id === id; });
        }) : Promise.resolve(null);

        promise.then(function(data) {
            var isEdit = !!data;
            var lng = data && data.lng ? data.lng : '';
            var lat = data && data.lat ? data.lat : '';
            var province = data && data.province ? data.province : '';
            var city = data && data.city ? data.city : '';
            var district = data && data.district ? data.district : '';
            var address = data ? data.address : '';

            var regionHtml = '';
            if (window.RegionData) {
                regionHtml = window.RegionData.renderSelects(province, city, district);
            }

            var html = '<div class="modal-title">' + (isEdit ? '编辑供应商' : '添加供应商') + '</div>' +
                '<div class="form-group"><label>供应商名称 *</label><input id="f_sup_name" value="' + (data ? data.name : '') + '" placeholder="如：张大爷农场"></div>' +
                '<div class="form-group"><label>联系人</label><input id="f_sup_contact" value="' + (data ? data.contact : '') + '" placeholder="联系人姓名"></div>' +
                '<div class="form-group"><label>电话</label><input id="f_sup_phone" value="' + (data ? data.phone : '') + '" placeholder="手机号"></div>' +
                '<div class="form-group"><label>地区</label>' + regionHtml + '</div>' +
                '<div class="form-group"><label>详细地址</label>' +
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">' +
                '<input id="f_sup_address" value="' + address + '" placeholder="街道、门牌号等" style="flex:1;min-width:150px;padding:8px 12px;border:1px solid #ddd;border-radius:8px;">' +
                '</div>' +
                '<button class="locate-btn-full" onclick="AdminPages.fillSupplierAddress()" style="width:100%;background:var(--primary);color:#fff;padding:6px 0;border-radius:20px;font-size:13px;border:none;cursor:pointer;">📍 定位</button>' +
                '<button class="locate-btn-full" onclick="AdminPages.openMapPickerForSupplier(\'' + lng + '\',\'' + lat + '\')" style="width:100%;background:var(--primary);color:#fff;padding:6px 0;border-radius:20px;font-size:13px;border:none;cursor:pointer;margin-top:4px;">🗺️ 地图选点</button>' +
                '</div>' +
                '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button><button class="btn-submit" onclick="AdminPages.saveSupplier(\'' + (id || '') + '\')">保存</button></div>';

            var content = document.getElementById('modalContent');
            if (content) content.innerHTML = html;

            var overlay = document.getElementById('modalOverlay');
            if (overlay) overlay.classList.add('active');

            if (window.RegionData) {
                window.RegionData.bindEvents();
                if (province) {
                    window.RegionData.setSelected(province, city, district);
                }
            }
        });
    },

    fillSupplierAddress: function() {
        if (typeof LocationHelper === 'undefined') {
            Utils.toast('❌ 定位服务未加载，请刷新页面');
            return;
        }
        LocationHelper.pickAddress({
            addressInputId: 'f_sup_address',
            regionData: window.RegionData,
            modalTitle: '选择供应商地址'
        });
    },

    openMapPickerForSupplier: function(lng, lat) {
        var self = this;
        var addrInput = document.getElementById('f_sup_address');
        var currentAddress = addrInput ? addrInput.value : '';
        var currentLng = lng ? parseFloat(lng) : null;
        var currentLat = lat ? parseFloat(lat) : null;

        if (!MapService._isInitialized) {
            if (Utils && Utils.toast) Utils.toast('⏳ 地图加载中，请稍后...');
            MapService._loadMap(function() {
                self.openMapPickerForSupplier(lng, lat);
            });
            return;
        }

        MapService.openMapPicker(function(result) {
            if (result && result.address) {
                var addrInput2 = document.getElementById('f_sup_address');
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
                }
                if (window.RegionData) {
                    window.RegionData.setSelected(result.province, result.city, result.district);
                }
                if (Utils && Utils.toast) Utils.toast('✅ 已选择地址');
            }
        }, currentAddress, currentLng, currentLat);
    },

    saveSupplier: function(id) {
        console.log('💾 后台保存供应商按钮被点击');
        var nameInput = document.getElementById('f_sup_name');
        var contactInput = document.getElementById('f_sup_contact');
        var phoneInput = document.getElementById('f_sup_phone');
        var addressInput = document.getElementById('f_sup_address');

        if (!nameInput || !contactInput || !phoneInput || !addressInput) {
            console.error('❌ 供应商表单元素缺失');
            if (Utils && Utils.toast) Utils.toast('❌ 页面错误，请刷新后重试');
            return;
        }

        var name = nameInput.value.trim();
        if (!name) {
            if (Utils && Utils.toast) Utils.toast('请输入供应商名称');
            return;
        }
        var contact = contactInput.value.trim();
        var phone = phoneInput.value.trim();
        var address = addressInput.value.trim();

        var addrInput = document.getElementById('f_sup_address');
        var lng = addrInput ? parseFloat(addrInput.dataset.lng) || null : null;
        var lat = addrInput ? parseFloat(addrInput.dataset.lat) || null : null;
        var province = '';
        var city = '';
        var district = '';
        if (window.RegionData) {
            var selected = window.RegionData.getSelected();
            if (selected && selected.province) {
                province = selected.province;
                city = selected.city || '';
                district = selected.district || '';
            }
        }

        var data = {
            name: name,
            contact: contact,
            phone: phone,
            address: address,
            lng: lng,
            lat: lat,
            province: province,
            city: city,
            district: district
        };
        if (id) data.id = id;

        console.log('📦 准备保存供应商:', data);
        DataService.saveSupplier(data)
            .then(function(response) {
                console.log('✅ 供应商保存成功:', response);
                window.closeModal();
                AdminPages.render('suppliers');
                if (Utils && Utils.toast) Utils.toast('✅ 供应商已保存');
            })
            .catch(function(err) {
                console.error('❌ 保存供应商失败:', err);
                if (Utils && Utils.toast) Utils.toast('❌ 保存失败: ' + (err.message || '未知错误'));
            });
    },

    deleteSupplier: function(id) {
        if (!confirm('确定删除该供应商吗？')) return;
        DataService.deleteSupplier(id).then(function() {
            AdminPages.render('suppliers');
            if (Utils && Utils.toast) Utils.toast('已删除');
        }).catch(function(err) {
            if (Utils && Utils.toast) Utils.toast('删除失败: ' + err.message);
        });
    },

    // ================================================================
    // 商品管理
    // ================================================================
    renderProducts: function() {
        if (!this._hasPermission('products')) {
            var el = document.getElementById('admin-products');
            if (el) el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        Promise.all([DataService.getProducts(), DataService.getSuppliers()]).then(function(results) {
            var list = Array.isArray(results[0]) ? results[0] : [];
            var suppliers = Array.isArray(results[1]) ? results[1] : [];
            var supMap = {};
            suppliers.forEach(function(s) { if (s && s.id) supMap[s.id] = s.name; });

            var html = '<div class="admin-card"><div class="card-title">商品管理 <button class="btn-sm" onclick="AdminPages.openProductModal()">+ 添加</button></div>';

            if (!list.length) {
                html += '<div class="empty-state"><div class="empty-icon">📦</div><p>暂无商品</p></div>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>名称</th><th>分类</th><th>价格</th><th>库存</th><th>供应商</th><th>操作</th></tr></thead><tbody>';
                list.forEach(function(p) {
                    if (!p) return;
                    html += '<tr><td>' + (p.emoji || '🥬') + ' ' + (p.name || '') + '</td><td>' + (p.category || '-') + '</td><td>' + Utils.formatPrice(p.price || 0) + '</td><td>' + (p.stock || 0) + '</td><td>' + (supMap[p.supplier_id] || '-') + '</td>' +
                        '<td><div class="actions"><button class="primary" onclick="AdminPages.openProductModal(\'' + p.id + '\')">编辑</button><button class="danger" onclick="AdminPages.deleteProduct(\'' + p.id + '\')">删除</button></div></td></tr>';
                });
                html += '</tbody></table>';
            }

            html += '</div>';
            var el = document.getElementById('admin-products');
            if (el) el.innerHTML = html;
        }).catch(function(err) {
            var el = document.getElementById('admin-products');
            if (el) el.innerHTML = '<div class="admin-card"><div class="card-title">商品管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openProductModal: function(id) {
        if (!this._hasPermission('products')) {
            Utils.toast('您没有权限操作商品');
            return;
        }
        var name = prompt('商品名称：');
        if (!name) return;
        var price = parseFloat(prompt('价格：'));
        if (isNaN(price)) return;
        var stock = parseInt(prompt('库存：')) || 0;
        var data = {
            name: name,
            price: price,
            stock: stock,
            category: prompt('分类：') || '',
            unit: prompt('单位：') || '份',
            emoji: prompt('Emoji：') || '🥬'
        };
        if (id) data.id = id;
        DataService.saveProduct(data)
            .then(function() {
                Utils.toast('✅ 商品已保存');
                AdminPages.render('products');
            })
            .catch(function(err) {
                Utils.toast('保存失败: ' + err.message);
            });
    },
    saveProduct: function(id) { this.openProductModal(id); },
    deleteProduct: function(id) {
        if (!confirm('确定删除该商品吗？')) return;
        DataService.deleteProduct(id)
            .then(function() {
                Utils.toast('已删除');
                AdminPages.render('products');
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    },

    // ================================================================
    // 库存管理
    // ================================================================
    renderInventory: function() {
        if (!this._hasPermission('inventory')) {
            var el = document.getElementById('admin-inventory');
            if (el) el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getInventory().then(function(data) {
            var products = Array.isArray(data.products) ? data.products : [];
            var logs = Array.isArray(data.logs) ? data.logs : [];

            var prodMap = {};
            products.forEach(function(p) { if (p && p.id) prodMap[p.id] = p; });

            var totalStock = products.reduce(function(s, p) { return s + (p.stock || 0); }, 0);
            var totalIn = logs.filter(function(l) { return l && l.type === 'in'; }).reduce(function(s, l) { return s + (l.quantity || 0); }, 0);
            var totalOut = logs.filter(function(l) { return l && l.type === 'out'; }).reduce(function(s, l) { return s + (l.quantity || 0); }, 0);
            var totalWaste = logs.filter(function(l) { return l && l.type === 'waste'; }).reduce(function(s, l) { return s + (l.quantity || 0); }, 0);

            var statsHtml = '<div class="stat-grid">' +
                '<div class="stat-box"><div class="stat-num">' + totalStock + '</div><div class="stat-label">总库存</div></div>' +
                '<div class="stat-box"><div class="stat-num">' + totalIn + '</div><div class="stat-label">总入库</div></div>' +
                '<div class="stat-box"><div class="stat-num">' + totalOut + '</div><div class="stat-label">总出库</div></div>' +
                '<div class="stat-box"><div class="stat-num">' + totalWaste + '</div><div class="stat-label">总损耗</div></div>' +
                '</div>';

            var logHtml = '<div class="admin-card"><div class="card-title">库存操作 <div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-sm" onclick="AdminPages.openInventoryModal(\'in\')">📥 入库</button><button class="btn-sm" onclick="AdminPages.openInventoryModal(\'out\')">📤 出库</button><button class="btn-sm" onclick="AdminPages.openInventoryModal(\'waste\')">⚠️ 损耗</button></div></div>';

            if (!logs.length) {
                logHtml += '<div class="text-muted" style="padding:8px 0;">暂无操作记录</div>';
            } else {
                var typeMap = { in: '📥 入库', out: '📤 出库', waste: '⚠️ 损耗' };
                logHtml += logs.slice().sort(function(a, b) {
                    return (b.created_at || '').localeCompare(a.created_at || '');
                }).slice(0, 30).map(function(l) {
                    if (!l) return '';
                    var p = prodMap[l.product_id];
                    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
                        '<span>' + (typeMap[l.type] || l.type) + ' ' + (p ? p.name : '已删除商品') + ' × ' + l.quantity + '</span>' +
                        '<span style="color:var(--text-secondary);">' + (l.operator || '') + ' ' + (l.created_at || '') + '</span></div>';
                }).join('');
            }
            logHtml += '</div>';

            var listHtml = '<div class="admin-card"><div class="card-title">📋 库存清单</div>';
            if (!products.length) {
                listHtml += '<div class="text-muted" style="padding:8px 0;">暂无商品</div>';
            } else {
                listHtml += '<table class="admin-table"><thead><tr><th>商品</th><th>库存</th><th>单位</th><th>供应商</th></tr></thead><tbody>';
                products.forEach(function(p) {
                    if (!p) return;
                    listHtml += '<tr><td>' + (p.emoji || '🥬') + ' ' + p.name + '</td><td><strong>' + (p.stock || 0) + '</strong></td><td>' + (p.unit || '份') + '</td><td>' + (p.supplier_name || '-') + '</td></tr>';
                });
                listHtml += '</tbody></table>';
            }
            listHtml += '</div>';

            var el = document.getElementById('admin-inventory');
            if (el) el.innerHTML = statsHtml + logHtml + listHtml;
        }).catch(function(err) {
            var el = document.getElementById('admin-inventory');
            if (el) el.innerHTML = '<div class="admin-card"><div class="card-title">库存管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openInventoryModal: function(type) {
        var productId = prompt('商品ID（在商品列表查看）：');
        if (!productId) return;
        var quantity = parseInt(prompt('数量：'));
        if (!quantity || quantity <= 0) return;
        DataService.saveInventory({ productId: productId, type: type, quantity: quantity, operator: Auth.getCurrentAdmin()?.username || '管理员' })
            .then(function() {
                Utils.toast('✅ 操作成功');
                AdminPages.render('inventory');
            })
            .catch(function(err) {
                Utils.toast('操作失败: ' + err.message);
            });
    },
    saveInventory: function(type) { this.openInventoryModal(type); },

    // ================================================================
    // ★★★ 订单管理 ★★★
    // ================================================================
    renderOrders: function() {
        var el = document.getElementById('admin-orders');
        if (!el) return;
        if (!this._hasPermission('orders')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getOrders().then(function(orders) {
            if (!Array.isArray(orders)) orders = [];
            var statusMap = { pending: '待发货', shipped: '配送中', completed: '已完成', cancelled: '已取消' };

            var html = '<div class="admin-card"><div class="card-title">📋 订单管理 <span style="font-size:13px;color:var(--text-secondary);font-weight:400;">共 ' + orders.length + ' 笔</span></div>';
            if (orders.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无订单</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>订单号</th><th>客户</th><th>金额</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>';
                orders.slice(0, 50).forEach(function(o) {
                    html += '<tr><td style="font-size:12px;">' + (o.id || '') + '</td><td>' + (o.customer_name || '') + '</td><td>' + Utils.formatPrice(o.total || 0) + '</td>' +
                        '<td><span class="status-badge ' + (o.status || 'pending') + '">' + (statusMap[o.status] || o.status || '未知') + '</span></td>' +
                        '<td style="font-size:12px;">' + (o.created_at || '').slice(0, 16) + '</td>' +
                        '<td>' + (o.status === 'pending' ? '<button class="btn-sm" onclick="AdminPages.updateOrderStatus(\'' + o.id + '\',\'shipped\')">发货</button>' : '') +
                        (o.status === 'shipped' ? '<button class="btn-sm" onclick="AdminPages.updateOrderStatus(\'' + o.id + '\',\'completed\')">完成</button>' : '') +
                        '</td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">📋 订单管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    updateOrderStatus: function(orderId, status) {
        DataService.updateOrderStatus(orderId, status)
            .then(function() {
                Utils.toast('✅ 状态已更新');
                AdminPages.render('orders');
            })
            .catch(function(err) {
                Utils.toast('操作失败: ' + err.message);
            });
    },

    // ================================================================
    // ★★★ 财务管理 ★★★
    // ================================================================
    renderFinance: function() {
        var el = document.getElementById('admin-finance');
        if (!el) return;
        if (!this._hasPermission('finance')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getFinance().then(function(records) {
            if (!Array.isArray(records)) records = [];
            var totalIncome = records.filter(function(r) { return r.type === 'income'; }).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
            var totalExpense = records.filter(function(r) { return r.type === 'expense'; }).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
            var profit = totalIncome - totalExpense;

            var html = '<div class="admin-card"><div class="card-title">💰 财务管理</div>';
            html += '<div class="stat-grid"><div class="stat-box"><div class="stat-num" style="color:#00b04a;">' + Utils.formatPrice(totalIncome) + '</div><div class="stat-label">总收入</div></div>' +
                '<div class="stat-box"><div class="stat-num" style="color:#ff3b30;">' + Utils.formatPrice(totalExpense) + '</div><div class="stat-label">总支出</div></div>' +
                '<div class="stat-box" style="grid-column:span 2;"><div class="stat-num" style="color:' + (profit >= 0 ? '#00b04a' : '#ff3b30') + ';">' + Utils.formatPrice(profit) + '</div><div class="stat-label">净利润</div></div></div>';
            html += '<button class="btn-sm" onclick="AdminPages.openFinanceModal()" style="background:var(--primary);color:#fff;padding:4px 14px;border-radius:16px;cursor:pointer;">+ 添加记录</button>';
            if (records.length === 0) {
                html += '<p style="color:var(--text-secondary);margin-top:8px;">暂无财务记录</p>';
            } else {
                html += '<table class="admin-table" style="margin-top:8px;"><thead><tr><th>类型</th><th>分类</th><th>金额</th><th>说明</th><th>时间</th><th>操作</th></tr></thead><tbody>';
                records.slice(0, 30).forEach(function(r) {
                    html += '<tr><td>' + (r.type === 'income' ? '📈 收入' : '📉 支出') + '</td><td>' + (r.category || '') + '</td><td>' + Utils.formatPrice(r.amount || 0) + '</td>' +
                        '<td style="font-size:12px;">' + (r.description || '') + '</td><td style="font-size:12px;">' + (r.created_at || '').slice(0, 16) + '</td>' +
                        '<td><button class="danger" onclick="AdminPages.deleteFinance(\'' + r.id + '\')">删除</button></td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">💰 财务管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openFinanceModal: function() {
        var type = confirm('点击"确定"添加收入，点击"取消"添加支出') ? 'income' : 'expense';
        var category = prompt('分类（如：销售收入、采购成本）：');
        if (!category) return;
        var amount = parseFloat(prompt('金额：'));
        if (isNaN(amount) || amount <= 0) return;
        var description = prompt('备注（可选）：') || '';
        DataService.saveFinance({ type: type, category: category, amount: amount, description: description })
            .then(function() {
                Utils.toast('✅ 已添加');
                AdminPages.render('finance');
            })
            .catch(function(err) {
                Utils.toast('添加失败: ' + err.message);
            });
    },
    saveFinance: function() { this.openFinanceModal(); },
    deleteFinance: function(id) {
        if (!confirm('确定删除该记录吗？')) return;
        DataService.deleteFinance(id)
            .then(function() {
                Utils.toast('已删除');
                AdminPages.render('finance');
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    },

    // ================================================================
    // ★★★ 备份管理 ★★★
    // ================================================================
    renderBackup: function() {
        var el = document.getElementById('admin-backup');
        if (!el) return;
        if (!this._hasPermission('backup')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        el.innerHTML = '<div class="admin-card"><div class="card-title">💾 数据备份</div>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
            '<button onclick="AdminBackup.manualBackup()" style="background:var(--primary);color:#fff;padding:8px 24px;border:none;border-radius:8px;cursor:pointer;">📤 导出备份</button>' +
            '<label style="background:var(--bg);padding:8px 24px;border-radius:8px;cursor:pointer;">📥 导入备份<input type="file" accept=".json" onchange="AdminBackup.importBackup(event)" style="display:none;"></label>' +
            '</div>' +
            '<p style="color:var(--text-secondary);font-size:13px;margin-top:12px;">💡 自动备份时间：每天 ' + (CONFIG.BACKUP?.hour || 3) + ':' + (CONFIG.BACKUP?.minute || 0).toString().padStart(2, '0') + '</p>' +
            '<p style="color:#999;font-size:12px;">备份包含：用户、地址、供应商、商品、订单、库存记录、财务记录、管理员信息</p>' +
            '</div>';
    },

    // ================================================================
    // ★★★ 个人中心 ★★★
    // ================================================================
    renderProfile: function() {
        var el = document.getElementById('admin-profile');
        if (!el) return;
        var user = Auth.getCurrentAdmin();
        var html = '<div class="admin-card"><div class="card-title">👤 个人中心</div>';
        if (user) {
            html += '<p><strong>用户名：</strong>' + (user.username || '') + '</p>';
            html += '<p><strong>角色：</strong>' + (user.username === 'admin' ? '超级管理员' : '管理员') + '</p>';
            html += '<p><strong>权限：</strong>' + (user.permissions && Array.isArray(user.permissions) ? user.permissions.join(', ') : '全部') + '</p>';
        } else {
            html += '<p>请重新登录</p>';
        }
        html += '<button onclick="AdminPages.submitChangePassword()" style="background:var(--primary);color:#fff;padding:6px 20px;border:none;border-radius:16px;margin-top:12px;cursor:pointer;">修改密码</button>';
        html += '</div>';
        el.innerHTML = html;
    },

    submitChangePassword: function() {
        var oldPwd = prompt('请输入旧密码：');
        if (oldPwd === null) return;
        var newPwd = prompt('请输入新密码（至少6位）：');
        if (newPwd === null || newPwd.length < 6) {
            Utils.toast('新密码至少6位');
            return;
        }
        var confirmPwd = prompt('请再次输入新密码：');
        if (confirmPwd !== newPwd) {
            Utils.toast('两次密码输入不一致');
            return;
        }
        var user = Auth.getCurrentAdmin();
        if (!user) { Utils.toast('请先登录'); return; }
        DataService.adminChangePassword(user.id, oldPwd, newPwd)
            .then(function() {
                Utils.toast('密码修改成功，请重新登录');
                Auth.logoutAdmin();
            })
            .catch(function(err) {
                Utils.toast('修改失败: ' + err.message);
            });
    },

    // ================================================================
    // ★★★ 成员管理 ★★★
    // ================================================================
    renderMembers: function() {
        var el = document.getElementById('admin-members');
        if (!el) return;
        if (!this._hasPermission('members')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getAdminMembers().then(function(members) {
            if (!Array.isArray(members)) members = [];
            var html = '<div class="admin-card"><div class="card-title">👥 成员管理 <button class="btn-sm" onclick="AdminPages.openAddMemberModal()">+ 添加</button></div>';
            if (members.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无其他管理员</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>用户名</th><th>权限</th><th>创建时间</th><th>操作</th></tr></thead><tbody>';
                members.forEach(function(m) {
                    var perms = m.permissions ? (Array.isArray(m.permissions) ? m.permissions : JSON.parse(m.permissions || '[]')) : [];
                    html += '<tr><td>' + m.username + (m.username === 'admin' ? ' <span style="color:var(--primary);font-size:11px;">(主)</span>' : '') + '</td>' +
                        '<td>' + (perms.length ? perms.join(', ') : '全部') + '</td>' +
                        '<td style="font-size:12px;">' + (m.created_at || '').slice(0, 16) + '</td>' +
                        '<td>' + (m.username !== 'admin' ? '<button class="danger" onclick="AdminPages.deleteMember(\'' + m.id + '\')">删除</button>' : '') + '</td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">👥 成员管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    _loadMemberList: function() { this.renderMembers(); },
    openAddMemberModal: function() {
        var username = prompt('请输入用户名：');
        if (!username) return;
        var password = prompt('请输入密码（至少6位）：');
        if (!password || password.length < 6) {
            Utils.toast('密码至少6位');
            return;
        }
        var perms = prompt('权限列表（用逗号分隔，如：dashboard,suppliers,products）：') || '';
        var permArr = perms.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
        DataService.addAdminMember(username, password, permArr)
            .then(function() {
                Utils.toast('✅ 成员已添加');
                AdminPages.render('members');
            })
            .catch(function(err) {
                Utils.toast('添加失败: ' + err.message);
            });
    },
    openEditMemberModal: function(id) { alert('编辑功能开发中'); },
    _renderPermissionCheckboxes: function(selected) { console.log('_renderPermissionCheckboxes', selected); },
    saveMember: function() { alert('成员管理开发中'); },
    updateMemberPermissions: function() { alert('成员管理开发中'); },
    deleteMember: function(id) {
        if (!confirm('确定删除该成员吗？')) return;
        DataService.deleteAdminMember(id)
            .then(function() {
                Utils.toast('已删除');
                AdminPages.render('members');
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    }
};