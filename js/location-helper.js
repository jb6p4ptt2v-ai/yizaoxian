/**
 * 定位地址选择助手（拼多多风格）
 * 统一前后台定位逻辑：获取坐标 → 逆地理 → 弹窗选择 → 填充表单
 */
window.LocationHelper = (function() {
    'use strict';

    // 单例 Geocoder（避免重复初始化）
    var _geocoder = null;

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
     * @param {Object} options
     * @param {string} options.addressInputId - 详细地址输入框的 ID（必填）
     * @param {Object} options.regionData - RegionData 实例（用于省市区联动）
     * @param {Function} options.onBeforeLocate - 定位开始前的回调（可选）
     * @param {Function} options.onAddressPicked - 地址选中后的额外回调（可选）
     * @param {string} options.modalTitle - 弹窗标题（默认"选择收货地址"）
     */
    function pickAddress(options) {
        if (!options || !options.addressInputId) {
            console.error('LocationHelper.pickAddress: 缺少 addressInputId');
            return;
        }

        var addressInputId = options.addressInputId;
        var regionData = options.regionData || null;
        var onBeforeLocate = options.onBeforeLocate || null;
        var onAddressPicked = options.onAddressPicked || null;
        var modalTitle = options.modalTitle || '选择收货地址';

        if (typeof Utils !== 'undefined' && Utils.toast) {
            Utils.toast('⏳ 正在获取位置...');
        }

        if (typeof MapService === 'undefined' || !MapService.locateCurrentPosition) {
            console.error('❌ MapService 未加载');
            if (Utils && Utils.toast) Utils.toast('❌ 地图服务未就绪');
            return;
        }

        if (typeof onBeforeLocate === 'function') {
            try { onBeforeLocate(); } catch(e) {}
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
            console.log('🌐 经纬度:', lng, lat);

            // 第一步：逆地理编码获取格式化地址和周边POI
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
                            label: formatted,
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
                            var poiLabel = poi.name;
                            if (poi.address) {
                                poiLabel = poi.name + '（' + poi.address + '）';
                            }
                            candidates.push({
                                label: poiLabel,
                                province: addrComp.province || '',
                                city: addrComp.city || '',
                                district: addrComp.district || '',
                                street: poi.address || '',
                                number: '',
                                detail: poi.name + (poi.address ? ' ' + poi.address : '')
                            });
                        });
                    }

                    // 如果候选列表为空，至少放一个格式化地址
                    if (candidates.length === 0 && formatted) {
                        candidates.push({
                            label: formatted,
                            province: addrComp.province || '',
                            city: addrComp.city || '',
                            district: addrComp.district || '',
                            street: addrComp.street || '',
                            number: addrComp.streetNumber || '',
                            detail: formatted
                        });
                    }

                    console.log('📋 候选地址数量:', candidates.length);

                    // 第二步：弹窗展示备选地址列表
                    if (candidates.length > 0) {
                        _showAddressPicker({
                            candidates: candidates,
                            lng: lng,
                            lat: lat,
                            addressInputId: addressInputId,
                            regionData: regionData,
                            modalTitle: modalTitle,
                            onAddressPicked: onAddressPicked
                        });
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

    // ================================================================
    // ★★★ 拼多多风格弹窗 - 展示备选地址列表 ★★★
    // ================================================================
    function _showAddressPicker(params) {
        var candidates = params.candidates;
        var lng = params.lng;
        var lat = params.lat;
        var addressInputId = params.addressInputId;
        var regionData = params.regionData;
        var modalTitle = params.modalTitle || '选择收货地址';
        var onAddressPicked = params.onAddressPicked || null;

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
            background: #fff; border-radius: 12px; width: 90%; max-width: 400px;
            max-height: 75%; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex; flex-direction: column;
        `;

        var header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px; border-bottom: 1px solid #eee;
            font-size: 16px; font-weight: bold; color: #333;
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        `;
        header.innerHTML = '<span>' + modalTitle + '</span><span style="font-size:14px;color:#999;cursor:pointer;" id="closePickerBtn">✕</span>';

        var listWrap = document.createElement('div');
        listWrap.style.cssText = `
            overflow-y: auto; padding: 4px 0; flex:1;
        `;

        if (candidates.length === 0) {
            listWrap.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">附近未找到备选地址，请手动输入</div>';
        } else {
            candidates.forEach(function(item) {
                var div = document.createElement('div');
                div.style.cssText = `
                    padding: 12px 20px;
                    border-bottom: 1px solid #f5f5f5;
                    cursor: pointer;
                    transition: background 0.15s;
                    font-size: 14px;
                    color: #333;
                `;
                // 显示地址名称（突出显示）
                var displayText = item.label;
                // 如果label包含地址信息，可能太长，截取前30个字符
                if (displayText.length > 40) {
                    displayText = displayText.slice(0, 40) + '...';
                }
                div.textContent = displayText;
                div.title = item.label; // 完整地址作为tooltip

                div.onmouseenter = function() { div.style.background = '#f0f0f0'; };
                div.onmouseleave = function() { div.style.background = 'transparent'; };
                div.onclick = function() {
                    console.log('✅ 用户选择了地址:', item.label);
                    // 填充省市区联动
                    if (regionData && typeof regionData.setSelected === 'function') {
                        try {
                            regionData.setSelected(item.province, item.city, item.district);
                        } catch(e) {
                            console.warn('regionData.setSelected 调用失败:', e);
                        }
                    }
                    // 填充详细地址
                    var addrInput = document.getElementById(addressInputId);
                    if (addrInput) {
                        var fullAddr = item.detail || item.label;
                        // 去掉省市区前缀（因为省市区已单独填充）
                        var prefix = '';
                        if (item.province) prefix += item.province;
                        if (item.city && item.city !== item.province) prefix += item.city;
                        if (item.district && item.district !== item.city) prefix += item.district;
                        if (prefix) {
                            fullAddr = fullAddr.replace(prefix, '').trim();
                            fullAddr = fullAddr.replace(/^[-,，、\s]+/, '');
                        }
                        if (!fullAddr || fullAddr.length < 2) {
                            fullAddr = item.detail || item.label;
                        }
                        addrInput.value = fullAddr;
                        addrInput.dataset.lng = lng || '';
                        addrInput.dataset.lat = lat || '';
                        addrInput.dataset.province = item.province || '';
                        addrInput.dataset.city = item.city || '';
                        addrInput.dataset.district = item.district || '';
                        addrInput.dataset.street = item.street || '';
                        console.log('📝 已填充详细地址:', fullAddr);
                    } else {
                        console.error('❌ 未找到输入框 #' + addressInputId);
                    }
                    if (typeof onAddressPicked === 'function') {
                        try {
                            onAddressPicked(item, lng, lat);
                        } catch(e) {
                            console.warn('onAddressPicked 回调异常:', e);
                        }
                    }
                    overlay.remove();
                    if (Utils && Utils.toast) Utils.toast('✅ 已选择地址');
                };
                listWrap.appendChild(div);
            });
        }

        card.appendChild(header);
        card.appendChild(listWrap);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        document.getElementById('closePickerBtn').onclick = function() { overlay.remove(); };
        overlay.onclick = function(e) {
            if (e.target === overlay) overlay.remove();
        };

        if (!document.getElementById('pickerStyle')) {
            var style = document.createElement('style');
            style.id = 'pickerStyle';
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `;
            document.head.appendChild(style);
        }
    }

    return {
        pickAddress: pickAddress,
        _showAddressPicker: _showAddressPicker
    };
})();
console.log('✅ LocationHelper 已加载（拼多多风格弹窗选地址）');