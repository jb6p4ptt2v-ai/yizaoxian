window.AdminPages = {
    render: function(page) {
        switch(page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'suppliers': this.renderSuppliers(); break;
            case 'products': this.renderProducts(); break;
            case 'inventory': this.renderInventory(); break;
            case 'orders': this.renderOrders(); break;
            case 'finance': this.renderFinance(); break;
            case 'reviews': this.renderReviews(); break;
            case 'after_sales': this.renderAfterSales(); break;
            case 'coupons': this.renderCoupons(); break;
            case 'messages': this.renderMessages(); break;
            case 'backup': this.renderBackup(); break;
            case 'profile': this.renderProfile(); break;
            case 'members': this.renderMembers(); break;
            case 'regions': this.renderRegions(); break;
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
    // 概览仪表盘
    // ================================================================
    renderDashboard: function() {
        var el = document.getElementById('admin-dashboard');
        if (!el) return;
        if (!this._hasPermission('dashboard')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        var self = this;
        Promise.all([
            DataService.getProducts(),
            DataService.getOrders(),
            DataService.getFinance(),
            DataService.getReviews ? DataService.getReviews() : Promise.resolve([]),
            DataService.getAfterSales ? DataService.getAfterSales() : Promise.resolve([])
        ]).then(function(results) {
            var products = results[0] || [];
            var orders = results[1] || [];
            var finance = results[2] || [];
            var reviews = results[3] || [];
            var afterSales = results[4] || [];

            var totalStock = products.reduce(function(s, p) { return s + (p.stock || 0); }, 0);
            var pendingOrders = orders.filter(function(o) { return o && o.status === 'pending'; }).length;
            var totalIncome = finance.filter(function(r) { return r.type === 'income'; }).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
            var pendingAfterSales = afterSales.filter(function(a) { return a && a.status === 'pending'; }).length;
            var avgRating = reviews.length > 0 ? (reviews.reduce(function(s, r) { return s + (r.rating || 0); }, 0) / reviews.length) : 0;

            var html = '<div class="dashboard-grid">' +
                '<div class="dash-item"><div class="dash-num">' + products.length + '</div><div class="dash-label">商品数</div></div>' +
                '<div class="dash-item"><div class="dash-num">' + totalStock + '</div><div class="dash-label">总库存</div></div>' +
                '<div class="dash-item"><div class="dash-num">' + orders.length + '</div><div class="dash-label">总订单</div></div>' +
                '<div class="dash-item"><div class="dash-num" style="color:' + (pendingOrders ? '#ff6b6b' : 'var(--primary)') + ';">' + pendingOrders + '</div><div class="dash-label">待处理订单</div></div>' +
                '<div class="dash-item"><div class="dash-num" style="color:#00b04a;">' + Utils.formatPrice(totalIncome) + '</div><div class="dash-label">总收入</div></div>' +
                '<div class="dash-item"><div class="dash-num" style="color:' + (pendingAfterSales ? '#ff6b6b' : 'var(--primary)') + ';">' + pendingAfterSales + '</div><div class="dash-label">售后待处理</div></div>' +
                '<div class="dash-item"><div class="dash-num">' + reviews.length + '</div><div class="dash-label">评价数</div></div>' +
                '<div class="dash-item"><div class="dash-num" style="color:#ff6b00;">' + (avgRating ? avgRating.toFixed(1) : '—') + '⭐</div><div class="dash-label">平均评分</div></div>' +
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
                        '<span style="color:' + (o.status === 'pending' ? '#856404' : '#004085') + ';">' + (o.status === 'pending' ? '待提货' : '配送中') + '</span>' +
                        '</div>';
                }).join('');
                if (pending.length > 5) {
                    pendingHtml += '<div class="text-muted" style="padding:4px 0;font-size:12px;">还有 ' + (pending.length - 5) + ' 笔待处理...</div>';
                }
            }

            el.innerHTML = html + '<div class="admin-card"><div class="card-title">📈 近期待处理</div>' + pendingHtml + '</div>';
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">加载失败</div><p>' + err.message + '</p></div>';
        });
    },

    // ================================================================
    // 供应商管理
    // ================================================================
    renderSuppliers: function() {
        var el = document.getElementById('admin-suppliers');
        if (!el) return;
        if (!this._hasPermission('suppliers')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
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
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">供应商列表</div><p>加载失败: ' + err.message + '</p></div>';
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
        LocationHelper.pickAddress({
            addressInputId: 'f_sup_address',
            regionData: window.RegionData,
            modalTitle: '选择供应商地址'
        });
    },

    saveSupplier: function(id) {
        var nameInput = document.getElementById('f_sup_name');
        var contactInput = document.getElementById('f_sup_contact');
        var phoneInput = document.getElementById('f_sup_phone');
        var addressInput = document.getElementById('f_sup_address');
        if (!nameInput || !contactInput || !phoneInput || !addressInput) {
            Utils.toast('❌ 页面错误，请刷新后重试');
            return;
        }
        var name = nameInput.value.trim();
        if (!name) { Utils.toast('请输入供应商名称'); return; }
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
        var data = { name: name, contact: contact, phone: phone, address: address, lng: lng, lat: lat, province: province, city: city, district: district };
        if (id) data.id = id;
        DataService.saveSupplier(data).then(function() {
            Utils.toast('✅ 供应商已保存');
            window.closeModal();
            AdminPages.render('suppliers');
        }).catch(function(err) {
            Utils.toast('保存失败: ' + err.message);
        });
    },

    deleteSupplier: function(id) {
        if (!confirm('确定删除该供应商吗？')) return;
        DataService.deleteSupplier(id).then(function() {
            AdminPages.render('suppliers');
            Utils.toast('已删除');
        }).catch(function(err) {
            Utils.toast('删除失败: ' + err.message);
        });
    },

    // ================================================================
    // ★★★ 商品管理（含规格管理、图片管理） ★★★
    // ================================================================
    renderProducts: function() {
        var el = document.getElementById('admin-products');
        if (!el) return;
        if (!this._hasPermission('products')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
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
                html += '<table class="admin-table"><thead><tr><th>名称</th><th>分类</th><th>价格</th><th>库存</th><th>已售</th><th>产地</th><th>供应商</th><th>🔥</th><th>今日可提</th><th>规格</th><th>操作</th></tr></thead><tbody>';
                list.forEach(function(p) {
                    if (!p) return;
                    var specCount = p._specCount || 0;
                    html += '<tr><td>' + (p.emoji || '🥬') + ' ' + (p.name || '') + '</td><td>' + (p.category || '-') + '</td><td>' + Utils.formatPrice(p.price || 0) + '</td><td>' + (p.stock || 0) + '</td><td>' + (p.sales_count || 0) + '</td><td>' + (p.origin || '-') + '</td><td>' + (supMap[p.supplier_id] || '-') + '</td>' +
                        '<td>' + (p.is_hot ? '🔥' : '') + '</td>' +
                        '<td>' + (p.today_pickup ? '✅' : '') + '</td>' +
                        '<td>' + (specCount > 0 ? specCount + '种' : '—') + '</td>' +
                        '<td><div class="actions"><button class="primary" onclick="AdminPages.openProductModal(\'' + p.id + '\')">编辑</button><button class="danger" onclick="AdminPages.deleteProduct(\'' + p.id + '\')">删除</button></div></td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;

            // 加载规格数量
            list.forEach(function(p) {
                DataService.getProductSpecs(p.id).then(function(specs) {
                    p._specCount = specs ? specs.length : 0;
                }).catch(function() {});
            });
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">商品管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openProductModal: function(id) {
        if (!this._hasPermission('products')) {
            Utils.toast('您没有权限操作商品');
            return;
        }
        var self = this;
        var promise = id ? DataService.getProducts().then(function(list) {
            if (!Array.isArray(list)) list = [];
            return list.find(function(p) { return p && p.id === id; });
        }) : Promise.resolve(null);

        promise.then(function(data) {
            var isEdit = !!data;
            var html = '<div class="modal-title">' + (isEdit ? '编辑商品' : '添加商品') + '</div>';

            // 基本信息
            html += '<div style="border-bottom:2px solid var(--primary);padding-bottom:8px;margin-bottom:12px;font-weight:500;">📦 基本信息</div>';

            html += '<div class="form-group"><label>商品名称 *</label><input id="f_prod_name" value="' + (data ? data.name : '') + '" placeholder="如：有机小白菜"></div>';

            var categories = ['蔬菜', '水果', '肉禽', '水产', '粮油', '干货'];
            var catOptions = categories.map(function(c) {
                var selected = (data && data.category === c) ? 'selected' : '';
                return '<option value="' + c + '" ' + selected + '>' + c + '</option>';
            }).join('');
            html += '<div class="form-group"><label>分类</label><select id="f_prod_category"><option value="">请选择分类</option>' + catOptions + '</select></div>';

            html += '<div class="form-group"><label>价格 *（元）</label><input id="f_prod_price" type="number" step="0.01" value="' + (data ? data.price : '') + '" placeholder="0.00"></div>';

            var units = ['份', '斤', '个', '盒', '袋', '箱'];
            var unitOptions = units.map(function(u) {
                var selected = (data && data.unit === u) ? 'selected' : '';
                return '<option value="' + u + '" ' + selected + '>' + u + '</option>';
            }).join('');
            html += '<div class="form-group"><label>单位</label><select id="f_prod_unit"><option value="份">份</option>' + unitOptions + '</select></div>';

            html += '<div class="form-group"><label>库存</label><input id="f_prod_stock" type="number" value="' + (data ? data.stock : '0') + '" placeholder="0"></div>';

            html += '<div class="form-group"><label>供应商</label><select id="f_prod_supplier"><option value="">请选择供应商</option></select></div>';

            html += '<div class="form-group"><label>Emoji（商品图标）</label><input id="f_prod_emoji" value="' + (data ? data.emoji || '🥬' : '🥬') + '" placeholder="🥬"></div>';

            html += '<div class="form-group"><label>描述</label><textarea id="f_prod_desc" placeholder="商品简短描述">' + (data ? data.description || '' : '') + '</textarea></div>';

            html += '<div class="form-group"><label>产地</label><input id="f_prod_origin" value="' + (data ? data.origin || '' : '') + '" placeholder="如：湖北省宜昌市"></div>';

            html += '<div class="form-group"><label>热卖</label><input type="checkbox" id="f_prod_hot" ' + (data && data.is_hot ? 'checked' : '') + '> 🔥 标记为热卖商品</div>';

            html += '<div class="form-group"><label>今日可提</label><input type="checkbox" id="f_prod_today" ' + (data && data.today_pickup !== 0 ? 'checked' : '') + '> ✅ 今日可提</div>';

            // ★★★ 图片管理 ★★★
            html += '<div style="border-bottom:2px solid var(--primary);padding-bottom:8px;margin:16px 0 12px;font-weight:500;">🖼️ 商品图片</div>';
            html += '<div id="productImageList" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">';
            if (data && data.images) {
                try {
                    var images = JSON.parse(data.images);
                    if (Array.isArray(images) && images.length > 0) {
                        images.forEach(function(img) {
                            html += '<div style="position:relative;width:72px;height:72px;border-radius:6px;overflow:hidden;border:1px solid #ddd;">' +
                                '<img src="' + img + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">' +
                                '</div>';
                        });
                    } else {
                        html += '<span style="color:#999;font-size:13px;">暂无图片</span>';
                    }
                } catch(e) {
                    html += '<span style="color:#999;font-size:13px;">暂无图片</span>';
                }
            } else {
                html += '<span style="color:#999;font-size:13px;">暂无图片</span>';
            }
            html += '</div>';
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<label style="background:var(--primary);color:#fff;padding:4px 16px;border-radius:6px;cursor:pointer;font-size:12px;">📷 上传图片<input type="file" accept="image/*" multiple onchange="AdminPages._handleProductImages(event, \'' + (data ? data.id : '') + '\')" style="display:none;"></label>' +
                '<span style="font-size:11px;color:#999;">支持多张，每张不超过5MB</span>' +
                '</div>';

            // ★★★ 规格管理 ★★★
            html += '<div style="border-bottom:2px solid var(--primary);padding-bottom:8px;margin:16px 0 12px;font-weight:500;">📐 规格管理</div>';
            html += '<div id="specList" style="margin-bottom:8px;">';
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:13px;color:#666;">';
            if (id) {
                // 异步加载规格
                html += '<span id="specLoading">加载规格中...</span>';
            } else {
                html += '<span style="color:#999;">请先保存商品后再添加规格</span>';
            }
            html += '</div></div>';
            html += '<div id="specAddArea" style="display:' + (id ? 'flex' : 'none') + ';gap:6px;flex-wrap:wrap;align-items:center;">' +
                '<input id="f_spec_name" placeholder="规格名(如:大份)" style="width:120px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">' +
                '<input id="f_spec_price" placeholder="价格" type="number" step="0.01" style="width:80px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">' +
                '<input id="f_spec_stock" placeholder="库存" type="number" style="width:60px;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">' +
                '<button class="btn-sm" onclick="AdminPages.addSpec(\'' + (data ? data.id : '') + '\')" style="background:var(--primary);color:#fff;padding:4px 12px;border-radius:4px;">添加</button>' +
                '</div>';

            html += '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button><button class="btn-submit" onclick="AdminPages.saveProduct(\'' + (id || '') + '\')">保存</button></div>';

            var content = document.getElementById('modalContent');
            if (content) content.innerHTML = html;
            var overlay = document.getElementById('modalOverlay');
            if (overlay) overlay.classList.add('active');

            // 加载供应商列表
            DataService.getSuppliers().then(function(suppliers) {
                var sel = document.getElementById('f_prod_supplier');
                if (!sel) return;
                if (!Array.isArray(suppliers)) suppliers = [];
                suppliers.forEach(function(s) {
                    var opt = document.createElement('option');
                    opt.value = s.id || '';
                    opt.textContent = s.name || '';
                    if (data && data.supplier_id === s.id) {
                        opt.selected = true;
                    }
                    sel.appendChild(opt);
                });
            });

            // 加载规格列表
            if (id) {
                DataService.getProductSpecs(id).then(function(specs) {
                    self._renderSpecList(specs, id);
                }).catch(function() {
                    document.getElementById('specLoading').textContent = '加载失败';
                });
            }
        });
    },

    _renderSpecList: function(specs, productId) {
        var container = document.getElementById('specList');
        if (!container) return;
        if (!specs || specs.length === 0) {
            container.innerHTML = '<span style="color:#999;font-size:13px;">暂无规格</span>';
            document.getElementById('specAddArea').style.display = 'flex';
            return;
        }
        var html = '<div style="display:flex;flex-direction:column;gap:4px;">';
        specs.forEach(function(s) {
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:#f8f9fa;border-radius:4px;font-size:13px;">' +
                '<span><strong>' + s.spec_name + '</strong> ¥' + s.price.toFixed(2) + ' 库存' + s.stock + '</span>' +
                '<button class="danger" onclick="AdminPages.deleteSpec(\'' + s.id + '\', \'' + productId + '\')" style="font-size:11px;padding:2px 10px;border-radius:10px;background:#ff3b30;color:#fff;border:none;cursor:pointer;">删除</button>' +
                '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('specAddArea').style.display = 'flex';
    },

    addSpec: function(productId) {
        var name = document.getElementById('f_spec_name').value.trim();
        var price = parseFloat(document.getElementById('f_spec_price').value);
        var stock = parseInt(document.getElementById('f_spec_stock').value) || 0;
        if (!name) { Utils.toast('请输入规格名称'); return; }
        if (isNaN(price) || price < 0) { Utils.toast('请输入有效价格'); return; }
        DataService.saveProductSpec(productId, { specName: name, price: price, stock: stock })
            .then(function(result) {
                Utils.toast('✅ 规格已添加');
                document.getElementById('f_spec_name').value = '';
                document.getElementById('f_spec_price').value = '';
                document.getElementById('f_spec_stock').value = '';
                DataService.getProductSpecs(productId).then(function(specs) {
                    AdminPages._renderSpecList(specs, productId);
                });
            })
            .catch(function(err) {
                Utils.toast('添加失败: ' + err.message);
            });
    },

    deleteSpec: function(specId, productId) {
        if (!confirm('确定删除该规格吗？')) return;
        DataService.deleteProductSpec(specId)
            .then(function() {
                Utils.toast('已删除');
                DataService.getProductSpecs(productId).then(function(specs) {
                    AdminPages._renderSpecList(specs, productId);
                });
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    },

    _handleProductImages: function(event, productId) {
        Utils.toast('图片上传功能开发中，请使用R2存储');
        event.target.value = '';
    },

    saveProduct: function(id) {
        if (!this._hasPermission('products')) {
            Utils.toast('您没有权限操作商品');
            return;
        }
        var nameInput = document.getElementById('f_prod_name');
        var priceInput = document.getElementById('f_prod_price');
        var stockInput = document.getElementById('f_prod_stock');
        var categoryInput = document.getElementById('f_prod_category');
        var unitInput = document.getElementById('f_prod_unit');
        var supplierInput = document.getElementById('f_prod_supplier');
        var emojiInput = document.getElementById('f_prod_emoji');
        var descInput = document.getElementById('f_prod_desc');
        var originInput = document.getElementById('f_prod_origin');
        var hotInput = document.getElementById('f_prod_hot');
        var todayInput = document.getElementById('f_prod_today');

        if (!nameInput) { Utils.toast('表单加载异常，请刷新重试'); return; }
        var name = nameInput.value.trim();
        var price = parseFloat(priceInput.value);
        var stock = parseInt(stockInput.value) || 0;
        var category = categoryInput ? categoryInput.value : '';
        var unit = unitInput ? unitInput.value : '份';
        var supplierId = supplierInput ? supplierInput.value : null;
        var emoji = emojiInput ? emojiInput.value.trim() || '🥬' : '🥬';
        var description = descInput ? descInput.value.trim() : '';
        var origin = originInput ? originInput.value.trim() : '';
        var isHot = hotInput ? hotInput.checked ? 1 : 0 : 0;
        var todayPickup = todayInput ? todayInput.checked ? 1 : 0 : 1;

        if (!name) { Utils.toast('请输入商品名称'); return; }
        if (isNaN(price) || price < 0) { Utils.toast('请输入有效的价格'); return; }

        var data = {
            name: name,
            price: price,
            stock: stock,
            category: category,
            unit: unit,
            supplierId: supplierId,
            emoji: emoji,
            description: description,
            origin: origin,
            is_hot: isHot,
            today_pickup: todayPickup
        };
        if (id) data.id = id;
        DataService.saveProduct(data).then(function() {
            Utils.toast('✅ 商品已保存');
            window.closeModal();
            AdminPages.render('products');
        }).catch(function(err) {
            Utils.toast('保存失败: ' + err.message);
        });
    },

    deleteProduct: function(id) {
        if (!confirm('确定删除该商品吗？')) return;
        DataService.deleteProduct(id).then(function() {
            AdminPages.render('products');
            Utils.toast('已删除');
        }).catch(function(err) {
            Utils.toast('删除失败: ' + err.message);
        });
    },

    // ================================================================
    // 库存管理
    // ================================================================
    renderInventory: function() {
        var el = document.getElementById('admin-inventory');
        if (!el) return;
        if (!this._hasPermission('inventory')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
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

            el.innerHTML = statsHtml + logHtml + listHtml;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">库存管理</div><p>加载失败: ' + err.message + '</p></div>';
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
    // 订单管理
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
            var statusMap = { pending: '待提货', shipped: '配送中', completed: '已完成', cancelled: '已取消', ready_pickup: '待提货', picked: '已提货' };

            var html = '<div class="admin-card"><div class="card-title">📋 订单管理 <span style="font-size:13px;color:var(--text-secondary);font-weight:400;">共 ' + orders.length + ' 笔</span></div>';
            if (orders.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无订单</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>订单号</th><th>客户</th><th>金额</th><th>状态</th><th>提货码</th><th>预计提货</th><th>操作</th></tr></thead><tbody>';
                orders.slice(0, 50).forEach(function(o) {
                    var pickupCode = o.pickup_code || '—';
                    var expectedDate = o.expected_pickup_date || '—';
                    html += '<tr><td style="font-size:12px;">' + (o.id || '') + '</td><td>' + (o.customer_name || '') + '</td><td>' + Utils.formatPrice(o.total || 0) + '</td>' +
                        '<td><span class="status-badge ' + (o.status || 'pending') + '">' + (statusMap[o.status] || o.status || '未知') + '</span></td>' +
                        '<td><strong>' + pickupCode + '</strong></td>' +
                        '<td style="font-size:12px;">' + expectedDate + '</td>' +
                        '<td><div class="actions">' +
                        (o.status === 'pending' ? '<button class="primary" onclick="AdminPages.updateOrderStatus(\'' + o.id + '\',\'shipped\')">发货</button>' : '') +
                        (o.status === 'shipped' ? '<button class="primary" onclick="AdminPages.updateOrderStatus(\'' + o.id + '\',\'completed\')">完成</button>' : '') +
                        (o.status === 'pending' ? '<button class="danger" onclick="AdminPages.updateOrderStatus(\'' + o.id + '\',\'cancelled\')">取消</button>' : '') +
                        '<button onclick="AdminPages.openLogisticsModal(\'' + o.id + '\')">📦物流</button>' +
                        '</div></td></tr>';
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

    openLogisticsModal: function(orderId) {
        var html = '<div class="modal-title">📦 物流信息</div>' +
            '<div class="form-group"><label>运单号</label><input id="log_tracking" placeholder="输入运单号"></div>' +
            '<div class="form-group"><label>承运商</label><input id="log_carrier" placeholder="如：顺丰、邮政"></div>' +
            '<div class="form-group"><label>物流状态</label><select id="log_status">' +
            '<option value="pending">待发货</option>' +
            '<option value="shipping">运输中</option>' +
            '<option value="delivered">已签收</option>' +
            '</select></div>' +
            '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button>' +
            '<button class="btn-submit" onclick="AdminPages.saveLogistics(\'' + orderId + '\')">保存</button></div>';
        var content = document.getElementById('modalContent');
        if (content) content.innerHTML = html;
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('active');
    },

    saveLogistics: function(orderId) {
        var tracking = document.getElementById('log_tracking').value.trim();
        var carrier = document.getElementById('log_carrier').value.trim();
        var status = document.getElementById('log_status').value;
        var logisticsInfo = JSON.stringify([{ time: new Date().toLocaleString(), status: '物流信息已更新' }]);
        DataService.updateLogistics(orderId, tracking, carrier, logisticsInfo)
            .then(function() {
                Utils.toast('✅ 物流信息已更新');
                window.closeModal();
                AdminPages.render('orders');
            })
            .catch(function(err) {
                Utils.toast('更新失败: ' + err.message);
            });
    },

    // ================================================================
    // 财务管理
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
                AdminPages.render('finance');
                Utils.toast('已删除');
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    },

    // ================================================================
    // 评价管理
    // ================================================================
    renderReviews: function() {
        var el = document.getElementById('admin-reviews');
        if (!el) return;
        if (!this._hasPermission('reviews')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getReviews().then(function(reviews) {
            if (!Array.isArray(reviews)) reviews = [];
            var html = '<div class="admin-card"><div class="card-title">⭐ 评价管理 <span style="font-size:13px;color:var(--text-secondary);font-weight:400;">共 ' + reviews.length + ' 条</span></div>';
            if (reviews.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无评价</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>商品</th><th>用户</th><th>评分</th><th>评价内容</th><th>图片</th><th>标签</th><th>时间</th><th>操作</th></tr></thead><tbody>';
                reviews.slice(0, 50).forEach(function(r) {
                    var stars = '';
                    for (var i = 0; i < 5; i++) { stars += i < r.rating ? '★' : '☆'; }
                    var tags = r.tags ? (Array.isArray(r.tags) ? r.tags : JSON.parse(r.tags || '[]')) : [];
                    var tagsHtml = tags.length > 0 ? tags.map(function(t) { return '<span style="font-size:11px;background:#f0f0f0;padding:1px 8px;border-radius:10px;margin:2px;">' + t + '</span>'; }).join('') : '—';
                    var imgHtml = (r.images && r.images.length > 0) ? '📷' : '—';
                    html += '<tr><td>' + (r.product_emoji || '🥬') + ' ' + (r.product_name || '') + '</td><td>' + (r.user_phone || '用户') + '</td><td style="color:#ff6b00;">' + stars + '</td>' +
                        '<td style="font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (r.content || '') + '</td>' +
                        '<td>' + imgHtml + '</td>' +
                        '<td>' + tagsHtml + '</td>' +
                        '<td style="font-size:12px;">' + (r.created_at || '').slice(0, 16) + '</td>' +
                        '<td><div class="actions">' +
                        (r.reply ? '<span style="font-size:11px;color:#666;">已回复</span>' : '<button class="primary" onclick="AdminPages.replyReview(\'' + r.id + '\')">回复</button>') +
                        '</div></td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">⭐ 评价管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    replyReview: function(reviewId) {
        var reply = prompt('请输入回复内容：');
        if (reply === null) return;
        if (!reply.trim()) { Utils.toast('回复内容不能为空'); return; }
        DataService.replyReview(reviewId, reply.trim())
            .then(function() {
                Utils.toast('✅ 回复已发送');
                AdminPages.render('reviews');
            })
            .catch(function(err) {
                Utils.toast('回复失败: ' + err.message);
            });
    },

    // ================================================================
    // 售后管理
    // ================================================================
    renderAfterSales: function() {
        var el = document.getElementById('admin-after-sales');
        if (!el) return;
        if (!this._hasPermission('after_sales')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getAfterSales().then(function(list) {
            if (!Array.isArray(list)) list = [];
            var statusMap = { pending: '待审核', approved: '已通过', rejected: '已拒绝', completed: '已完成' };
            var typeMap = { refund: '仅退款', return: '退货退款' };

            var html = '<div class="admin-card"><div class="card-title">🔄 售后管理 <span style="font-size:13px;color:var(--text-secondary);font-weight:400;">共 ' + list.length + ' 笔</span></div>';
            if (list.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无售后申请</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>订单号</th><th>类型</th><th>原因</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>';
                list.slice(0, 30).forEach(function(a) {
                    html += '<tr><td style="font-size:12px;">' + (a.order_id || '') + '</td><td>' + (typeMap[a.type] || a.type) + '</td><td>' + (a.reason || '') + '</td>' +
                        '<td><span class="status-badge ' + (a.status || 'pending') + '">' + (statusMap[a.status] || a.status || '未知') + '</span></td>' +
                        '<td style="font-size:12px;">' + (a.created_at || '').slice(0, 16) + '</td>' +
                        '<td><div class="actions">' +
                        (a.status === 'pending' ? '<button class="primary" onclick="AdminPages.auditAfterSale(\'' + a.id + '\',\'approved\')">通过</button><button class="danger" onclick="AdminPages.auditAfterSale(\'' + a.id + '\',\'rejected\')">拒绝</button>' : '') +
                        '</div></td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">🔄 售后管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    auditAfterSale: function(afterSaleId, status) {
        var reply = prompt('审核意见（可选）：');
        if (reply === null) return;
        DataService.auditAfterSale(afterSaleId, status, reply || '')
            .then(function() {
                Utils.toast('✅ 审核完成');
                AdminPages.render('after_sales');
            })
            .catch(function(err) {
                Utils.toast('审核失败: ' + err.message);
            });
    },

    // ================================================================
    // 优惠券管理
    // ================================================================
    renderCoupons: function() {
        var el = document.getElementById('admin-coupons');
        if (!el) return;
        if (!this._hasPermission('coupons')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        DataService.getCoupons().then(function(result) {
            var coupons = result.available || [];
            var html = '<div class="admin-card"><div class="card-title">🎫 优惠券管理 <button class="btn-sm" onclick="AdminPages.openCouponModal()">+ 添加</button></div>';
            if (coupons.length === 0) {
                html += '<p style="color:var(--text-secondary);">暂无优惠券</p>';
            } else {
                html += '<table class="admin-table"><thead><tr><th>名称</th><th>类型</th><th>面值</th><th>门槛</th><th>过期时间</th><th>库存</th><th>操作</th></tr></thead><tbody>';
                coupons.forEach(function(c) {
                    html += '<tr><td>' + c.name + '</td><td>' + (c.type === 'discount' ? '折扣' : '满减') + '</td><td>' + (c.type === 'discount' ? c.value + '折' : '¥' + c.value) + '</td>' +
                        '<td>' + (c.min_amount ? '满¥' + c.min_amount : '无门槛') + '</td>' +
                        '<td style="font-size:12px;">' + (c.expire_at || '').slice(0, 10) + '</td>' +
                        '<td>' + (c.stock || 0) + '</td>' +
                        '<td><button class="danger" onclick="AdminPages.deleteCoupon(\'' + c.id + '\')">删除</button></td></tr>';
                });
                html += '</tbody></table>';
            }
            html += '</div>';
            el.innerHTML = html;
        }).catch(function(err) {
            el.innerHTML = '<div class="admin-card"><div class="card-title">🎫 优惠券管理</div><p>加载失败: ' + err.message + '</p></div>';
        });
    },

    openCouponModal: function() {
        var html = '<div class="modal-title">添加优惠券</div>' +
            '<div class="form-group"><label>名称 *</label><input id="c_name" placeholder="如：新用户优惠券"></div>' +
            '<div class="form-group"><label>类型</label><select id="c_type"><option value="discount">折扣</option><option value="full_reduction">满减</option></select></div>' +
            '<div class="form-group"><label>面值</label><input id="c_value" type="number" step="0.01" placeholder="折扣填0-9.9，满减填金额"></div>' +
            '<div class="form-group"><label>满减门槛（元）</label><input id="c_min_amount" type="number" step="0.01" placeholder="0表示无门槛"></div>' +
            '<div class="form-group"><label>过期时间</label><input id="c_expire" type="date"></div>' +
            '<div class="form-group"><label>库存</label><input id="c_stock" type="number" value="999"></div>' +
            '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button><button class="btn-submit" onclick="AdminPages.saveCoupon()">保存</button></div>';
        var content = document.getElementById('modalContent');
        if (content) content.innerHTML = html;
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('active');
    },

    saveCoupon: function() {
        var name = document.getElementById('c_name').value.trim();
        var type = document.getElementById('c_type').value;
        var value = parseFloat(document.getElementById('c_value').value);
        var minAmount = parseFloat(document.getElementById('c_min_amount').value) || 0;
        var expireAt = document.getElementById('c_expire').value;
        var stock = parseInt(document.getElementById('c_stock').value) || 999;

        if (!name) { Utils.toast('请输入优惠券名称'); return; }
        if (isNaN(value) || value <= 0) { Utils.toast('请输入有效面值'); return; }
        if (type === 'discount' && value >= 10) { Utils.toast('折扣值应为0-9.9'); return; }
        if (!expireAt) { Utils.toast('请选择过期时间'); return; }

        var data = { name: name, type: type, value: value, minAmount: minAmount, expireAt: expireAt + 'T23:59:59', stock: stock };
        DataService.saveCoupon(data)
            .then(function() {
                Utils.toast('✅ 优惠券已添加');
                window.closeModal();
                AdminPages.render('coupons');
            })
            .catch(function(err) {
                Utils.toast('添加失败: ' + err.message);
            });
    },

    deleteCoupon: function(id) {
        if (!confirm('确定删除该优惠券吗？')) return;
        DataService.deleteCoupon(id)
            .then(function() {
                Utils.toast('已删除');
                AdminPages.render('coupons');
            })
            .catch(function(err) {
                Utils.toast('删除失败: ' + err.message);
            });
    },

    // ================================================================
    // 消息管理
    // ================================================================
    renderMessages: function() {
        var el = document.getElementById('admin-messages');
        if (!el) return;
        if (!this._hasPermission('messages')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        el.innerHTML = '<div class="admin-card"><div class="card-title">📬 消息推送 <button class="btn-sm" onclick="AdminPages.openSendMessageModal()">+ 发送消息</button></div>' +
            '<p style="color:var(--text-secondary);font-size:13px;">向指定用户发送系统通知或促销消息</p>' +
            '<div style="margin-top:12px;background:#f8f9fa;padding:12px;border-radius:6px;">' +
            '<div style="font-size:13px;font-weight:500;">📌 使用说明</div>' +
            '<ul style="font-size:12px;color:#666;padding-left:20px;margin-top:4px;">' +
            '<li>输入用户手机号发送给特定用户</li>' +
            '<li>留空手机号则发送给所有用户</li>' +
            '<li>消息会在前台消息中心显示</li>' +
            '</ul></div></div>';
    },

    openSendMessageModal: function() {
        var html = '<div class="modal-title">发送消息</div>' +
            '<div class="form-group"><label>用户手机号（留空则发送全部）</label><input id="msg_user_phone" placeholder="输入用户手机号，多个用逗号分隔"></div>' +
            '<div class="form-group"><label>消息类型</label><select id="msg_type"><option value="system">系统通知</option><option value="promotion">促销活动</option></select></div>' +
            '<div class="form-group"><label>标题 *</label><input id="msg_title" placeholder="消息标题"></div>' +
            '<div class="form-group"><label>内容 *</label><textarea id="msg_content" rows="4" placeholder="消息内容"></textarea></div>' +
            '<div class="form-actions"><button class="btn-cancel" onclick="window.closeModal()">取消</button><button class="btn-submit" onclick="AdminPages.sendMessage()">发送</button></div>';
        var content = document.getElementById('modalContent');
        if (content) content.innerHTML = html;
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.add('active');
    },

    sendMessage: function() {
        var phones = document.getElementById('msg_user_phone').value.trim();
        var type = document.getElementById('msg_type').value;
        var title = document.getElementById('msg_title').value.trim();
        var content = document.getElementById('msg_content').value.trim();

        if (!title) { Utils.toast('请输入标题'); return; }
        if (!content) { Utils.toast('请输入内容'); return; }

        DataService.getUsers().then(function(users) {
            if (!Array.isArray(users)) users = [];
            var targetUsers = users;
            if (phones) {
                var phoneList = phones.split(',').map(function(p) { return p.trim(); });
                targetUsers = users.filter(function(u) { return phoneList.indexOf(u.phone) !== -1; });
                if (targetUsers.length === 0) { Utils.toast('未找到匹配的用户'); return; }
            }

            var promises = targetUsers.map(function(u) {
                return DataService.sendMessage(u.id, type, title, content, '');
            });

            Promise.all(promises).then(function() {
                Utils.toast('✅ 消息已发送给 ' + targetUsers.length + ' 位用户');
                window.closeModal();
            }).catch(function(err) {
                Utils.toast('发送失败: ' + err.message);
            });
        }).catch(function(err) {
            Utils.toast('获取用户列表失败: ' + err.message);
        });
    },

    // ================================================================
    // ★★★ 地区数据管理（动态同步） ★★★
    // ================================================================
    renderRegions: function() {
        var el = document.getElementById('admin-regions');
        if (!el) return;
        if (!this._hasPermission('regions')) {
            el.innerHTML = '<div class="admin-card"><p>您没有权限访问此页面</p></div>';
            return;
        }

        el.innerHTML = '<div class="admin-card"><div class="card-title">🗺️ 地区数据管理</div>' +
            '<p style="color:var(--text-secondary);font-size:13px;">从高德地图同步全国行政区划数据，确保地区下拉框完整。</p>' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;">' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
            '<input id="regionSyncKeyword" placeholder="输入省份/城市名称" style="width:200px;padding:6px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;">' +
            '<button onclick="AdminPages.syncRegions()" style="background:var(--primary);color:#fff;padding:6px 20px;border:none;border-radius:6px;cursor:pointer;">📥 同步</button>' +
            '</div>' +
            '</div>' +
            '<div id="syncResult" style="margin-top:8px;font-size:13px;"></div>' +
            '<div style="margin-top:12px;font-size:12px;color:#999;">💡 提示：输入"湖北省"可同步全省数据，输入"宜昌市"可同步全市数据</div>' +
            '</div>';
    },

    syncRegions: function() {
        var keyword = document.getElementById('regionSyncKeyword').value.trim();
        if (!keyword) { Utils.toast('请输入关键词'); return; }
        var resultEl = document.getElementById('syncResult');
        resultEl.innerHTML = '⏳ 同步中...';
        DataService.syncRegions(keyword)
            .then(function(result) {
                if (result.success) {
                    resultEl.innerHTML = '✅ 同步完成！新增 ' + result.inserted + ' 条，跳过 ' + result.skipped + ' 条';
                    Utils.toast('✅ 地区数据同步成功');
                } else {
                    resultEl.innerHTML = '❌ 同步失败: ' + (result.error || '未知错误');
                    Utils.toast('同步失败: ' + (result.error || '未知错误'));
                }
            })
            .catch(function(err) {
                resultEl.innerHTML = '❌ 同步失败: ' + err.message;
                Utils.toast('同步失败: ' + err.message);
            });
    },

    // ================================================================
    // 备份管理
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
            '<p style="color:#999;font-size:12px;">备份包含：用户、地址、供应商、商品、规格、订单、物流、评价、收藏、优惠券、消息、售后、库存记录、财务记录、地区数据</p>' +
            '</div>';
    },

    // ================================================================
    // 个人中心
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
    // 成员管理
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

    openAddMemberModal: function() {
        var username = prompt('请输入用户名：');
        if (!username) return;
        var password = prompt('请输入密码（至少6位）：');
        if (!password || password.length < 6) {
            Utils.toast('密码至少6位');
            return;
        }
        var perms = prompt('权限列表（用逗号分隔，如：dashboard,suppliers,products,reviews,after_sales,coupons,messages,regions）：') || '';
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