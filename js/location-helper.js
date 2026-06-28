/**
 * 定位地址选择助手（拼多多风格 - 底部滑出弹窗）
 * 完全对齐拼多多收货地址定位交互：
 * 1. 点击"定位"后弹窗列表显示：黑色大字地点名称 + 灰色小字完整地址
 * 2. 详细地址填充不含省市前缀，也不含区县名（去重）
 * 3. 最终地址显示：省市区 + 详细地址完整拼接
 * 4. 使用高德定位插件提高精度
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
    var _currentModalTitle = '选择地址';

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

    function pickAddress(options) {
        if (!options || !options.addressInputId) {
            console.error('LocationHelper.pickAddress: 缺少 addressInputId');
            return;
        }

        _currentAddressInputId = options.addressInputId;
        _currentRegionData = options.regionData || null;
        _currentOnAddressPicked = options.onAddressPicked || null;
        _currentModalTitle = options.modalTitle || '选择地址';

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
            console.log('📍 定位精度:', result.accuracyText || '');

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

                    if (formatted) {
                        var displayName = formatted;
                        var parts = formatted.split(' ');
                        if (parts.length > 1) {
                            var lastPart = parts[parts.length - 1];
                            if (lastPart.length < 20) {
                                displayName = lastPart;
                            }
                        }
                        candidates.push({
                            name: displayName,
                            fullAddress: formatted,
                            province: addrComp.province || '',
                            city: addrComp.city || '',
                            district: addrComp.district || '',
                            street: addrComp.street || '',
                            number: addrComp.streetNumber || '',
                            detail: formatted
                        });
                    }

                    if (regeo.pois && regeo.pois.length > 0) {
                        regeo.pois.slice(0, 20).forEach(function(poi) {
                            var poiAddress = poi.address || '';
                            var fullAddr = poi.name + (poiAddress ? ' ' + poiAddress : '');
                            candidates.push({
                                name: poi.name,
                                fullAddress: fullAddr,
                                province: addrComp.province || '',
                                city: addrComp.city || '',
                                district: addrComp.district || '',
                                street: poiAddress,
                                number: '',
                                detail: fullAddr
                            });
                        });
                    }

                    if (candidates.length === 0 && formatted) {
                        var parts2 = formatted.split(' ');
                        var displayName2 = parts2.length > 1 ? parts2[parts2.length - 1] : formatted;
                        candidates.push({
                            name: displayName2,
                            fullAddress: formatted,
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

    function _showAddressPicker(candidates, lng, lat) {
        console.log('🖥️ 显示地址选择弹窗，候选数:', candidates.length);

        var oldModal = document.getElementById('pddAddressModal');
        if (oldModal) oldModal.remove();

        var overlay = document.createElement('div');
        overlay.id = 'pddAddressModal';
        overlay.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.4); z-index:9999;
            display: flex; justify-content: center; align-items: flex-end;
            animation: pddFadeIn 0.25s ease;
        `;

        var card = document.createElement('div');
        card.style.cssText = `
            background: #ffffff;
            border-radius: 16px 16px 0 0;
            width: 100%;
            max-width: 480px;
            max-height: 78vh;
            display: flex;
            flex-direction: column;
            animation: pddSlideUp 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
            overflow: hidden;
        `;

        var dragHandle = document.createElement('div');
        dragHandle.style.cssText = `padding: 10px 0 4px 0; display: flex; justify-content: center; flex-shrink: 0;`;
        var dragBar = document.createElement('div');
        dragBar.style.cssText = `width: 36px; height: 4px; background: #ccc; border-radius: 4px;`;
        dragHandle.appendChild(dragBar);

        var header = document.createElement('div');
        header.style.cssText = `padding: 4px 18px 12px 18px; font-size: 17px; font-weight: 600; color: #1a1a1a; text-align: center; flex-shrink: 0; border-bottom: 1px solid #f0f0f0;`;
        header.textContent = _currentModalTitle;

        var searchBar = document.createElement('div');
        searchBar.style.cssText = `padding: 10px 16px; display: flex; gap: 8px; flex-shrink: 0; background: #ffffff;`;
        searchBar.innerHTML = `
            <div style="flex:1;position:relative;display:flex;align-items:center;background:#f5f5f5;border-radius:20px;padding:0 14px;border:1px solid #e8e8e8;">
                <span style="color:#999;font-size:14px;margin-right:6px;">🔍</span>
                <input id="pickerSearchInput" placeholder="搜索地址" style="flex:1;padding:8px 0;border:none;background:transparent;font-size:14px;outline:none;color:#333;">
            </div>
            <button id="pickerRefreshBtn" style="background:#f5f5f5;border:1px solid #e8e8e8;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#555;flex-shrink:0;" title="重新定位">🔄</button>
        `;

        var listWrap = document.createElement('div');
        listWrap.id = 'pickerListWrap';
        listWrap.style.cssText = `overflow-y: auto; padding: 4px 0 12px 0; flex: 1; -webkit-overflow-scrolling: touch;`;

        _renderListItems(listWrap, candidates);

        card.appendChild(dragHandle);
        card.appendChild(header);
        card.appendChild(searchBar);
        card.appendChild(listWrap);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        if (!document.getElementById('pickerStyle')) {
            var style = document.createElement('style');
            style.id = 'pickerStyle';
            style.textContent = `
                @keyframes pddFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pddSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .picker-address-item { padding: 12px 18px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.12s; }
                .picker-address-item:active { background: #f0f0f0; }
                .picker-address-item .name { font-size: 15px; font-weight: 500; color: #1a1a1a; line-height: 1.4; }
                .picker-address-item .address { font-size: 12px; color: #999; margin-top: 2px; line-height: 1.3; }
                .picker-empty { padding: 40px 20px; text-align: center; color: #999; font-size: 14px; }
            `;
            document.head.appendChild(style);
        }

        overlay.onclick = function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        };

        var searchInput = document.getElementById('pickerSearchInput');
        if (searchInput) {
            searchInput.oninput = function() {
                var keyword = this.value.trim();
                _filterAddressList(keyword);
            };
            searchInput.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    var keyword = this.value.trim();
                    _filterAddressList(keyword);
                }
            };
        }

        var refreshBtn = document.getElementById('pickerRefreshBtn');
        if (refreshBtn) {
            refreshBtn.onclick = function() {
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
                                var parts = formatted.split(' ');
                                var displayName = parts.length > 1 ? parts[parts.length - 1] : formatted;
                                candidates.push({
                                    name: displayName,
                                    fullAddress: formatted,
                                    province: addrComp.province || '',
                                    city: addrComp.city || '',
                                    district: addrComp.district || '',
                                    street: addrComp.street || '',
                                    number: addrComp.streetNumber || '',
                                    detail: formatted
                                });
                            }

                            if (regeo.pois && regeo.pois.length > 0) {
                                regeo.pois.slice(0, 20).forEach(function(poi) {
                                    var poiAddress = poi.address || '';
                                    var fullAddr = poi.name + (poiAddress ? ' ' + poiAddress : '');
                                    candidates.push({
                                        name: poi.name,
                                        fullAddress: fullAddr,
                                        province: addrComp.province || '',
                                        city: addrComp.city || '',
                                        district: addrComp.district || '',
                                        street: poiAddress,
                                        number: '',
                                        detail: fullAddr
                                    });
                                });
                            }

                            if (candidates.length === 0 && formatted) {
                                var parts2 = formatted.split(' ');
                                var displayName2 = parts2.length > 1 ? parts2[parts2.length - 1] : formatted;
                                candidates.push({
                                    name: displayName2,
                                    fullAddress: formatted,
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
                            var searchInput2 = document.getElementById('pickerSearchInput');
                            if (searchInput2) searchInput2.value = '';
                            if (Utils && Utils.toast) Utils.toast('✅ 已刷新');
                        } else {
                            if (Utils && Utils.toast) Utils.toast('❌ 刷新失败');
                        }
                    });
                });
            };
        }
    }

    function _renderListItems(container, candidates) {
        if (!container) return;

        if (!candidates || candidates.length === 0) {
            container.innerHTML = '<div class="picker-empty">未找到匹配地址</div>';
            return;
        }

        var html = '';
        candidates.forEach(function(item) {
            var displayName = item.name || '未命名';
            var displayFullAddress = item.fullAddress || item.detail || '';

            if (displayFullAddress === displayName) {
                displayFullAddress = '';
            }

            var safeName = displayName.replace(/'/g, "\\'");
            var safeFullAddress = displayFullAddress.replace(/'/g, "\\'");
            var safeProvince = (item.province || '').replace(/'/g, "\\'");
            var safeCity = (item.city || '').replace(/'/g, "\\'");
            var safeDistrict = (item.district || '').replace(/'/g, "\\'");
            var safeStreet = (item.street || '').replace(/'/g, "\\'");
            var safeDetail = (item.detail || '').replace(/'/g, "\\'");
            var safeNumber = (item.number || '').replace(/'/g, "\\'");

            html += `
                <div class="picker-address-item" onclick="LocationHelper._selectAddress('${safeName}', '${safeFullAddress}', '${safeProvince}', '${safeCity}', '${safeDistrict}', '${safeStreet}', '${safeDetail}', '${safeNumber}')">
                    <div class="name">${displayName}</div>
                    ${displayFullAddress ? '<div class="address">' + displayFullAddress + '</div>' : ''}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function _filterAddressList(keyword) {
        var listWrap = document.getElementById('pickerListWrap');
        if (!listWrap) return;

        if (!keyword) {
            _renderListItems(listWrap, _currentCandidates);
            return;
        }

        var filtered = _currentCandidates.filter(function(item) {
            var searchText = (item.name + ' ' + item.fullAddress + ' ' + item.detail).toLowerCase();
            return searchText.indexOf(keyword.toLowerCase()) !== -1;
        });

        _renderListItems(listWrap, filtered);
    }

    function _selectAddress(name, fullAddress, province, city, district, street, detail, number) {
        console.log('✅ 用户选择了地址:', name);
        console.log('📍 完整地址:', fullAddress);

        var addressInputId = _currentAddressInputId;
        var regionData = _currentRegionData;
        var onAddressPicked = _currentOnAddressPicked;

        // 1. 填充省市联动
        if (regionData && typeof regionData.setSelected === 'function') {
            try {
                regionData.setSelected(province, city, district);
            } catch(e) {
                console.warn('regionData.setSelected 调用失败:', e);
            }
        }

        // 2. 提取详细地址（不含省市区，也不含区县名）
        var sourceAddress = fullAddress || detail || name || '';

        var prefixParts = [];
        if (province) prefixParts.push(province);
        if (city && city !== province) prefixParts.push(city);
        if (district && district !== city) prefixParts.push(district);
        var prefix = prefixParts.join('');

        var cleanedDetail = sourceAddress;
        if (prefix && cleanedDetail.indexOf(prefix) === 0) {
            cleanedDetail = cleanedDetail.substring(prefix.length).trim();
            cleanedDetail = cleanedDetail.replace(/^[-,，、\s]+/, '');
        }

        // 如果清理后开头仍是区县名，再次移除
        if (district && cleanedDetail.indexOf(district) === 0) {
            cleanedDetail = cleanedDetail.substring(district.length).trim();
            cleanedDetail = cleanedDetail.replace(/^[-,，、\s]+/, '');
        }

        if (!cleanedDetail || cleanedDetail.length < 2) {
            var streetParts = [];
            if (street) streetParts.push(street);
            if (number) streetParts.push(number);
            cleanedDetail = streetParts.join('') || sourceAddress;
        }

        if (!cleanedDetail || cleanedDetail.length < 2) {
            cleanedDetail = name || sourceAddress;
        }

        console.log('📝 详细地址（不含省市区）:', cleanedDetail);

        // 3. 填充详细地址到输入框
        var addrInput = document.getElementById(addressInputId);
        if (addrInput) {
            addrInput.value = cleanedDetail;
            addrInput.dataset.lng = _currentLng || '';
            addrInput.dataset.lat = _currentLat || '';
            addrInput.dataset.province = province || '';
            addrInput.dataset.city = city || '';
            addrInput.dataset.district = district || '';
            addrInput.dataset.street = street || '';
            addrInput.dataset.fullAddress = sourceAddress;
            console.log('📝 已填充详细地址:', cleanedDetail);
        } else {
            console.error('❌ 未找到输入框 #' + addressInputId);
        }

        // 4. 获取完整地址（省市区+详细地址）
        var fullAddressResult = '';
        var parts2 = [];
        if (province) parts2.push(province);
        if (city && city !== province) parts2.push(city);
        if (district && district !== city) parts2.push(district);
        if (cleanedDetail) parts2.push(cleanedDetail);
        fullAddressResult = parts2.join('');

        console.log('📝 完整地址（省市区+详细地址）:', fullAddressResult);

        // 5. 执行回调
        if (typeof onAddressPicked === 'function') {
            try {
                onAddressPicked({
                    name: name,
                    detail: cleanedDetail,
                    fullAddress: fullAddressResult,
                    sourceFullAddress: sourceAddress,
                    province: province,
                    city: city,
                    district: district,
                    street: street,
                    number: number
                });
            } catch(e) {
                console.warn('onAddressPicked 回调异常:', e);
            }
        }

        // 6. 关闭弹窗
        var overlay = document.getElementById('pddAddressModal');
        if (overlay) overlay.remove();

        if (Utils && Utils.toast) Utils.toast('✅ 已选择地址');
    }

    return {
        pickAddress: pickAddress,
        _selectAddress: _selectAddress,
        _filterAddressList: _filterAddressList,
        _renderListItems: _renderListItems,
        _showAddressPicker: _showAddressPicker
    };
})();
console.log('✅ LocationHelper 已加载（拼多多完全对齐：黑色大字+灰色小字，省市区分离，区县去重）');