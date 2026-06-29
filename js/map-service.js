/**
 * 高德地图服务 - 定位和地理编码（优化高精度定位）
 */
window.MapService = (function() {
    'use strict';

    var _geocoder = null;
    var _isInitialized = false;
    var _initCallbacks = [];
    var _initAttempts = 0;
    var _maxInitAttempts = 10;

    function _init(callback) {
        if (_isInitialized) {
            if (typeof callback === 'function') callback();
            return;
        }

        if (typeof AMap === 'undefined') {
            _initAttempts++;
            if (_initAttempts < _maxInitAttempts) {
                console.warn('⏳ 等待 AMap 加载... (尝试 ' + _initAttempts + '/' + _maxInitAttempts + ')');
                setTimeout(function() { _init(callback); }, 500);
                return;
            }
            console.error('❌ AMap 加载超时');
            if (callback) callback(false);
            return;
        }

        try {
            AMap.plugin(['AMap.Geocoder', 'AMap.Geolocation', 'AMap.PlaceSearch'], function() {
                try {
                    _geocoder = new AMap.Geocoder({
                        city: '',
                        radius: 1000,
                        extensions: 'all'
                    });
                    _isInitialized = true;
                    console.log('✅ 高德地图服务已初始化（定位+地理编码）');
                    if (callback) callback(true);
                    _initCallbacks.forEach(function(fn) { if (typeof fn === 'function') fn(); });
                    _initCallbacks = [];
                } catch(e) {
                    console.error('❌ 初始化 Geocoder 失败:', e);
                    if (callback) callback(false);
                }
            });
        } catch(e) {
            console.error('❌ AMap.plugin 调用失败:', e);
            if (callback) callback(false);
        }
    }

    function _loadMap(callback) {
        if (_isInitialized) {
            if (typeof callback === 'function') callback();
            return;
        }
        _initCallbacks.push(callback);
        if (!_isInitialized && _initAttempts === 0) {
            _init(function(success) {
                if (success && typeof callback === 'function') callback();
            });
        }
    }

    var publicAPI = {
        _loadMap: _loadMap,
        locateCurrentPosition: locateCurrentPosition,
        searchNearby: searchNearby,
        geocodeAddress: geocodeAddress
    };

    Object.defineProperty(publicAPI, '_isInitialized', {
        get: function() { return _isInitialized; },
        enumerable: true,
        configurable: false
    });

    // ★★★ 核心优化：高精度定位 + 重试机制 ★★★
    function locateCurrentPosition(callback) {
        _loadMap(function() {
            if (!_isInitialized) {
                _fallbackLocate(callback);
                return;
            }

            // 定位重试计数器
            var retryCount = 0;
            var maxRetries = 3;
            var bestResult = null;

            function doLocate() {
                if (typeof AMap !== 'undefined' && AMap.Geolocation) {
                    var geolocation = new AMap.Geolocation({
                        enableHighAccuracy: true,  // 高精度
                        timeout: 5000,             // 5秒超时（更短，避免等待）
                        maximumAge: 0,              // 不缓存位置
                        convert: true,
                        showButton: false,
                        useNative: true             // 使用原生定位（更精确）
                    });

                    geolocation.getCurrentPosition(function(status, result) {
                        if (status === 'complete') {
                            var pos = result.position;
                            var lng = pos.getLng();
                            var lat = pos.getLat();
                            var accuracy = result.accuracy || 0;
                            console.log('📍 高德定位成功，精度 ' + accuracy + ' 米');

                            // 保存最佳结果（如果精度更好或首次）
                            if (!bestResult || accuracy < bestResult.accuracy) {
                                bestResult = {
                                    success: true,
                                    data: {
                                        lng: lng,
                                        lat: lat,
                                        address: result.formattedAddress || '',
                                        province: result.addressComponent?.province || '',
                                        city: result.addressComponent?.city || '',
                                        district: result.addressComponent?.district || '',
                                        street: result.addressComponent?.street || '',
                                        streetNumber: result.addressComponent?.streetNumber || '',
                                        accuracy: accuracy
                                    },
                                    accuracy: accuracy,
                                    accuracyText: accuracy < 50 ? '精确到约' + Math.round(accuracy) + '米' : '精度较低（' + Math.round(accuracy) + '米）'
                                };
                            }

                            // 如果精度足够好（< 50米）或已达重试上限，则返回
                            if (accuracy < 50 || retryCount >= maxRetries) {
                                callback(bestResult || { success: false, error: '定位失败' });
                                return;
                            }

                            // 否则等待1秒后重试（可能得到更精确结果）
                            retryCount++;
                            console.log('🔄 重新定位尝试 ' + retryCount + '/' + maxRetries + '，当前精度 ' + accuracy + ' 米');
                            setTimeout(doLocate, 1000);
                        } else {
                            console.warn('⚠️ 高德定位失败:', result.message || '');
                            retryCount++;
                            if (retryCount < maxRetries) {
                                console.log('🔄 定位失败，重试 ' + retryCount + '/' + maxRetries);
                                setTimeout(doLocate, 1000);
                            } else {
                                // 如果已有部分结果（精度较差），也返回
                                if (bestResult) {
                                    callback(bestResult);
                                } else {
                                    _fallbackLocate(callback);
                                }
                            }
                        }
                    });
                } else {
                    _fallbackLocate(callback);
                }
            }

            // 开始首次定位
            doLocate();
        });
    }

    // 备用定位（浏览器 Geolocation）
    function _fallbackLocate(callback) {
        if (!navigator.geolocation) {
            callback({ success: false, error: '浏览器不支持定位' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                var lng = pos.coords.longitude;
                var lat = pos.coords.latitude;
                var accuracy = pos.coords.accuracy || 0;
                if (_geocoder) {
                    _geocoder.getAddress(new AMap.LngLat(lng, lat), function(status, data) {
                        if (status === 'complete' && data.info === 'OK') {
                            var regeo = data.regeocode;
                            var addrComp = regeo.addressComponent || {};
                            callback({
                                success: true,
                                data: {
                                    lng: lng,
                                    lat: lat,
                                    address: regeo.formattedAddress || '',
                                    province: addrComp.province || '',
                                    city: addrComp.city || '',
                                    district: addrComp.district || '',
                                    street: addrComp.street || '',
                                    streetNumber: addrComp.streetNumber || '',
                                    accuracy: accuracy
                                },
                                accuracy: accuracy,
                                accuracyText: '坐标已获取（精度' + Math.round(accuracy) + '米）'
                            });
                        } else {
                            callback({
                                success: true,
                                data: { lng: lng, lat: lat, address: '', accuracy: accuracy },
                                accuracy: accuracy,
                                accuracyText: '坐标已获取（精度' + Math.round(accuracy) + '米）'
                            });
                        }
                    });
                } else {
                    callback({
                        success: true,
                        data: { lng: lng, lat: lat, address: '', accuracy: accuracy },
                        accuracy: accuracy,
                        accuracyText: '坐标已获取（精度' + Math.round(accuracy) + '米）'
                    });
                }
            },
            function(err) {
                callback({ success: false, error: err.message });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    function searchNearby(lng, lat, keyword, callback) {
        _loadMap(function() {
            if (typeof AMap === 'undefined' || !AMap.PlaceSearch) {
                console.error('AMap.PlaceSearch 未加载');
                if (callback) callback([]);
                return;
            }

            var placeSearch = new AMap.PlaceSearch({
                type: '商务住宅|地名地址|餐饮服务|生活服务',
                pageSize: 30,
                pageIndex: 1,
                city: '',
                citylimit: false
            });

            var searchKeyword = keyword && keyword.trim() ? keyword.trim() : '';
            var radius = 3000;

            placeSearch.searchNearBy(searchKeyword, [lng, lat], radius, function(status, result) {
                if (status === 'complete' && result.poiList) {
                    var pois = result.poiList.pois || [];
                    callback(pois.map(function(p) {
                        return {
                            name: p.name,
                            address: p.address || '',
                            lng: p.location.getLng(),
                            lat: p.location.getLat(),
                            province: p.pcode || '',
                            city: p.cityname || '',
                            district: p.adname || ''
                        };
                    }));
                } else {
                    if (searchKeyword) {
                        placeSearch.searchNearBy('', [lng, lat], radius, function(status2, result2) {
                            if (status2 === 'complete' && result2.poiList) {
                                var pois2 = result2.poiList.pois || [];
                                callback(pois2.map(function(p) {
                                    return {
                                        name: p.name,
                                        address: p.address || '',
                                        lng: p.location.getLng(),
                                        lat: p.location.getLat(),
                                        province: p.pcode || '',
                                        city: p.cityname || '',
                                        district: p.adname || ''
                                    };
                                }));
                            } else {
                                callback([]);
                            }
                        });
                    } else {
                        callback([]);
                    }
                }
            });
        });
    }

    function geocodeAddress(address, callback) {
        _loadMap(function() {
            if (!_geocoder) {
                if (callback) callback(null);
                return;
            }
            _geocoder.getLocation(address, function(status, result) {
                if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                    var geo = result.geocodes[0];
                    callback({
                        lng: geo.location.getLng(),
                        lat: geo.location.getLat(),
                        address: geo.formattedAddress || address,
                        province: geo.addressComponent?.province || '',
                        city: geo.addressComponent?.city || '',
                        district: geo.addressComponent?.district || ''
                    });
                } else {
                    callback(null);
                }
            });
        });
    }

    return publicAPI;
})();
console.log('✅ 地图服务已加载（高精度定位优化，支持重试）');