/**
 * 定位地址选择助手（拼多多风格 - 完整版）
 * 统一前后台定位逻辑：获取坐标 → 逆地理 → 弹窗选择 → 填充表单
 * 功能：备选地址列表 + 灰色小字详细地址 + 搜索框 + 刷新按钮
 */
window.LocationHelper = (function() {
    'use strict';

    var _geocoder = null;
    var _currentLng = null;
    var _currentLat = null;
    var _currentCandidates = [];
    var _currentAddressInputId = null;
    var _currentRegionData = null;
    var _currentOnAddressPicked = null;
    var _currentModalTitle = '选择收货地址';

    function _getGeocoder() {
        if (!_geocoder) {
            if (typeof AMap === 'undefined' || !AMap.Geocoder) {
                console.error('AMap.Geocoder 未加载');
                return null;
            }
            _geocoder = new AMap.Geocoder({
                city: '',
                radius: 1000,
                extensions: 'all'
            });
        }
        return _geocoder;
    }

    /**
     * 主入口：定位并选择地址
     */
    function pickAddress(options) {
        if (!options || !options.addressInputId) {
            console.error('LocationHelper.pickAddress: 缺少 addressInputId');
            return;
        }

        _currentAddressInputId = options.addressInputId;
        _currentRegionData = options.regionData || null;
        _currentOnAddressPicked = options.onAddressPicked || null;
        _currentModalTitle = options.modalTitle || '选择收货地址';

        if (typeof Utils !== 'undefined' && Utils.toast) {
            Utils.toast('⏳ 正在获取位置...');
        }

        if (typeof MapService === 'undefined' || !MapService.locateCurrentPosition) {
            console.error('❌ MapService 未加载');
            if (Utils && Utils.toast) Utils.toast('❌ 地图服务未就绪');
            return;
        }

        MapService.locateCurrentPosition(function(result) {
            console.log('📍 定位回调:', result);
            if (!result || !result.success || !result.data) {
                console.warn('⚠️ 定位失败:', result ? result.error : '未知');
                if (Utils && Utils.toast) Utils.toast('❌ 定位失败，请手动输入');
                return;
            }

            var lng = result.data.lng;
            var lat = result.data.lat;
            if (!lng || !lat) {
                if (Utils && Utils.toast) Utils.toast('❌ 未获取到坐标');
                return;
            }
            _currentLng = lng;
            _currentLat = lat;
            console.log('🌐 经纬度:', lng, lat);

            var geocoder = _getGeocoder();
            if (!geocoder) {
                if (Utils && Utils.toast) Utils.toast('❌ 地图组件未就绪');
                return;
            }

            geocoder.getAddress(new AMap.LngLat(lng, lat), function(status, data) {
                console.log('📡 Geocoder 返回:', status, data);
                if (status === 'complete' && data.info === 'OK') {
                    var regeo = data.regeocode;
                    var formatted = regeo.formattedAddress || '';
                    var addrComp = regeo.addressComponent || {};

                    var candidates = [];

                    // 主地址（格式化地址）
                    if (formatted) {
                        candidates.push({
                            name: formatted,
                            address: formatted,
                            province: addrComp.province || '',
                            city: addrComp.city || '',
                            district: addrComp.district || '',
                            street: addrComp.street || '',
                            number: addrComp.streetNumber || '',
                            detail: formatted
                        });
                    }

                    // 周边 POI（最多15个）
                    if (regeo.pois && regeo.pois.length > 0) {
                        regeo.pois.slice(0, 15).forEach(function(poi) {
                            var poiAddress = poi.address || '';
                            var fullAddress = poi.name + (poiAddress ? ' ' + poiAddress : '');
                            candidates.push({
                                name: poi.name,
                                address: poiAddress,
                                province: addrComp.province || '',
                                city: addrComp.city || '',
                                district: addrComp.district || '',
                                street: poiAddress,
                                number: '',
                                detail: fullAddress
                            });
                        });
                    }

                    // 如果候选列表为空，至少放一个格式化地址
                    if (candidates.length === 0 && formatted) {
                        candidates.push({
                            name: formatted,
                            address: formatted,
                            province: addrComp.province || '',
                            city: addrComp.city || '',
                            district: addrComp.district || '',
                            street: addrComp.street || '',
                            number: addrComp.streetNumber || '',
                            detail: formatted
                        });
                    }

                    _currentCandidates = candidates;
                    console.log('📋 候选地址数量:', candidates.length);

                    if (candidates.length > 0) {
                        _showAddressPicker(candidates, lng, lat);
                    } else {
                        if (Utils && Utils.toast) Utils.toast('❌ 未找到附近地址，请手动输入');
                    }
                } else {
                    console.error('❌ 逆地理失败:', data);
                    if (Utils && Utils.toast) Utils.toast('❌ 获取地址失败，请手动输入');
                }
            });
        });
    }

    /**
     * ★★★ 拼多多风格弹窗 - 展示备选地址列表 + 搜索 + 刷新 ★★★
     */
    function _showAddressPicker(candidates, lng, lat) {
        console.log('🖥️ 显示地址选择弹窗，候选数:', candidates.length);

        var oldModal = document.getElementById('pddAddressModal');
        if (oldModal) oldModal.remove();

        var overlay = document.createElement('div');
        overlay.id = 'pddAddressModal';
        overlay.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.5); z-index:9999;
            display: flex; justify-content: center; align-items: center;
            animation: fadeIn 0.2s;
        `;

        var card = document.createElement('div');
        card.style.cssText = `
            background: #fff; border-radius: 12px; width: 92%; max-width: 420px;
            max-height: 80%; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex; flex-direction: column;
        `;

        // ---------- 标题 ----------
        var header = document.createElement('div');
        header.style.cssText = `
            padding: 14px 18px;
            border-bottom: 1px solid #eee;
            font-size: 16px;
            font-weight: bold;
            color: #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        `;
        header.innerHTML = '<span>' + _currentModalTitle + '</span><span style="font-size:14px;color:#999;cursor:pointer;" id="closePickerBtn">✕</span>';

        // ---------- 搜索栏（拼多多风格：搜索框 + 刷新按钮） ----------
        var searchBar = document.createElement('div');
        searchBar.style.cssText = `
            padding: 10px 16px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            gap: 8px;
            flex-shrink: 0;
            background: #fafafa;
        `;
        searchBar.innerHTML = `
            <input id="pickerSearchInput" placeholder="搜索地址" style="flex:1;padding:6px 12px;border:1px solid #ddd;border-radius:18px;font-size:13px;outline:none;">
            <button id="pickerSearchBtn" style="background:var(--primary,#00b04a);color:#fff;border:none;border-radius:18px;padding:6px 16px;font-size:13px;cursor:pointer;">搜索</button>
            <button id="pickerRefreshBtn" style="background:#f0f0f0;border:none;border-radius:18px;padding:6px 12px;font-size:13px;cursor:pointer;color:#555;" title="重新定位">🔄</button>
        `;

        // ---------- 地址列表 ----------
        var listWrap = document.createElement('div');
        listWrap.id = 'pickerListWrap';
        listWrap.style.cssText = `
            overflow-y: auto; padding: 4px 0; flex:1;
        `;

        _renderListItems(listWrap, candidates);

        card.appendChild(header);
        card.appendChild(searchBar);
        card.appendChild(listWrap);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // ---------- 事件绑定 ----------

        // 关闭按钮
        document.getElementById('closePickerBtn').onclick = function() { overlay.remove(); };
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.remove();
        };

        // 搜索功能
        document.getElementById('pickerSearchBtn').onclick = function() {
            var keyword = document.getElementById('pickerSearchInput').value.trim();
            _filterAddressList(keyword);
        };

        // 回车搜索
        document.getElementById('pickerSearchInput').onkeydown = function(e) {
            if (e.key === 'Enter') {
                var keyword = document.getElementById('pickerSearchInput').value.trim();
                _filterAddressList(keyword);
            }
        };

        // 刷新功能
        document.getElementById('pickerRefreshBtn').onclick = function() {
            if (Utils && Utils.toast) Utils.toast('⏳ 重新定位...');
            MapService.locateCurrentPosition(function(result) {
                if (!result || !result.success || !result.data) {
                    if (Utils && Utils.toast) Utils.toast('❌ 定位失败');
                    return;
                }
                var lng = result.data.lng;
                var lat = result.data.lat;
                _currentLng = lng;
                _currentLat = lat;

                var geocoder = _getGeocoder();
                if (!geocoder) {
                    if (Utils && Utils.toast) Utils.toast('❌ 地图组件未就绪');
                    return;
                }

                geocoder.getAddress(new AMap.LngLat(lng, lat), function(status, data) {
                    if (status === 'complete' && data.info === 'OK') {
                        var regeo = data.regeocode;
                        var formatted = regeo.formattedAddress || '';
                        var addrComp = regeo.addressComponent || {};
                        var candidates = [];

                        if (formatted) {
                            candidates.push({
                                name: formatted,
                                address: formatted,
                                province: addrComp.province || '',
                                city: addrComp.city || '',
                                district: addrComp.district || '',
                                street: addrComp.street || '',
                                number: addrComp.streetNumber || '',
                                detail: formatted
                            });
                        }

                        if (regeo.pois && regeo.pois.length > 0) {
                            regeo.pois.slice(0, 15).forEach(function(poi) {
                                var poiAddress = poi.address || '';
                                candidates.push({
                                    name: poi.name,
                                    address: poiAddress,
                                    province: addrComp.province || '',
                                    city: addrComp.city || '',
                                    district: addrComp.district || '',
                                    street: poiAddress,
                                    number: '',
                                    detail: poi.name + (poiAddress ? ' ' + poiAddress : '')
                                });
                            });
                        }

                        if (candidates.length === 0 && formatted) {
                            candidates.push({
                                name: formatted,
                                address: formatted,
                                province: addrComp.province || '',
                                city: addrComp.city || '',
                                district: addrComp.district || '',
                                street: addrComp.street || '',
                                number: addrComp.streetNumber || '',
                                detail: formatted
                            });
                        }

                        _currentCandidates = candidates;
                        var listWrap2 = document.getElementById('pickerListWrap');
                        if (listWrap2) {
                            _renderListItems(listWrap2, candidates);
                        }
                        // 清空搜索框
                        var searchInput = document.getElementById('pickerSearchInput');
                        if (searchInput) searchInput.value = '';
                        if (Utils && Utils.toast) Utils.toast('✅ 已刷新');
                    } else {
                        if (Utils && Utils.toast) Utils.toast('❌ 刷新失败');
                    }
                });
            });
        };

        // 注入动画样式
        if (!document.getElementById('pickerStyle')) {
            var style = document.createElement('style');
            style.id = 'pickerStyle';
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * ★★★ 渲染地址列表项（含灰色小字详细地址） ★★★
     */
    function _renderListItems(container, candidates) {
        if (!container) return;

        if (!candidates || candidates.length === 0) {
            container.innerHTML = '<div style="padding:30px 20px;text-align:center;color:#999;font-size:14px;">未找到匹配地址</div>';
            return;
        }

        var html = '';
        candidates.forEach(function(item) {
            // 拼多多风格：名称（突出显示）+ 灰色小字详细地址
            var displayName = item.name || '未命名';
            var displayAddress = item.address || '';

            // 如果地址和名称相同，不重复显示
            if (displayAddress === displayName) {
                displayAddress = '';
            }

            // 如果详细地址为空，尝试用 province+city+district 拼接
            if (!displayAddress) {
                var parts = [];
                if (item.province) parts.push(item.province);
                if (item.city && item.city !== item.province) parts.push(item.city);
                if (item.district && item.district !== item.city) parts.push(item.district);
                if (parts.length > 0) {
                    displayAddress = parts.join('');
                }
            }

            // 转义单引号和特殊字符
            var safeName = displayName.replace(/'/g, "\\'");
            var safeAddress = displayAddress.replace(/'/g, "\\'");
            var safeProvince = (item.province || '').replace(/'/g, "\\'");
            var safeCity = (item.city || '').replace(/'/g, "\\'");
            var safeDistrict = (item.district || '').replace(/'/g, "\\'");
            var safeStreet = (item.street || '').replace(/'/g, "\\'");
            var safeDetail = (item.detail || item.name || '').replace(/'/g, "\\'");

            html += `
                <div class="picker-address-item" onclick="LocationHelper._selectAddress('${safeName}', '${safeAddress}', '${safeProvince}', '${safeCity}', '${safeDistrict}', '${safeStreet}', '${safeDetail}')" style="padding:12px 18px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.15s;">
                    <div style="font-size:15px;font-weight:500;color:#333;">${displayName}</div>
                    ${displayAddress ? '<div style="font-size:12px;color:#999;margin-top:2px;">' + displayAddress + '</div>' : ''}
                </div>
            `;
        });

        container.innerHTML = html;

        // 绑定悬停效果
        container.querySelectorAll('.picker-address-item').forEach(function(el) {
            el.onmouseenter = function() { this.style.background = '#f5f5f5'; };
            el.onmouseleave = function() { this.style.background = 'transparent'; };
        });
    }

    /**
     * ★★★ 搜索过滤地址列表 ★★★
     */
    function _filterAddressList(keyword) {
        var listWrap = document.getElementById('pickerListWrap');
        if (!listWrap) return;

        if (!keyword) {
            _renderListItems(listWrap, _currentCandidates);
            return;
        }

        var filtered = _currentCandidates.filter(function(item) {
            var searchText = (item.name + ' ' + item.address + ' ' + item.detail).toLowerCase();
            return searchText.indexOf(keyword.toLowerCase()) !== -1;
        });

        _renderListItems(listWrap, filtered);
    }

    /**
     * ★★★ 选择地址（由列表项 onclick 调用） ★★★
     */
    function _selectAddress(name, address, province, city, district, street, detail) {
        console.log('✅ 用户选择了地址:', name);

        var addressInputId = _currentAddressInputId;
        var regionData = _currentRegionData;
        var onAddressPicked = _currentOnAddressPicked;

        // 填充省市区联动
        if (regionData && typeof regionData.setSelected === 'function') {
            try {
                regionData.setSelected(province, city, district);
            } catch(e) {
                console.warn('regionData.setSelected 调用失败:', e);
            }
        }

        // 填充详细地址
        var addrInput = document.getElementById(addressInputId);
        if (addrInput) {
            var fullAddr = detail || name;
            // 去掉省市区前缀（因为省市区已单独填充）
            var prefix = '';
            if (province) prefix += province;
            if (city && city !== province) prefix += city;
            if (district && district !== city) prefix += district;
            if (prefix) {
                fullAddr = fullAddr.replace(prefix, '').trim();
                fullAddr = fullAddr.replace(/^[-,，、\s]+/, '');
            }
            if (!fullAddr || fullAddr.length < 2) {
                fullAddr = detail || name;
            }
            addrInput.value = fullAddr;
            addrInput.dataset.lng = _currentLng || '';
            addrInput.dataset.lat = _currentLat || '';
            addrInput.dataset.province = province || '';
            addrInput.dataset.city = city || '';
            addrInput.dataset.district = district || '';
            addrInput.dataset.street = street || '';
            console.log('📝 已填充详细地址:', fullAddr);
        } else {
            console.error('❌ 未找到输入框 #' + addressInputId);
        }

        if (typeof onAddressPicked === 'function') {
            try {
                onAddressPicked({ name: name, address: address, province: province, city: city, district: district, street: street, detail: detail });
            } catch(e) {
                console.warn('onAddressPicked 回调异常:', e);
            }
        }

        // 关闭弹窗
        var overlay = document.getElementById('pddAddressModal');
        if (overlay) overlay.remove();

        if (Utils && Utils.toast) Utils.toast('✅ 已选择地址');
    }

    // 暴露公共API（含内部方法供 onclick 调用）
    return {
        pickAddress: pickAddress,
        _selectAddress: _selectAddress,
        _filterAddressList: _filterAddressList,
        _renderListItems: _renderListItems,
        _showAddressPicker: _showAddressPicker
    };
})();
console.log('✅ LocationHelper 已加载（拼多多风格：弹窗 + 搜索 + 刷新）');