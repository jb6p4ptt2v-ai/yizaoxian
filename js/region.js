window.RegionData = {
    _data: null,
    _initialized: false,
    _loading: false,

    init: function() {
        if (this._initialized) return;
        this._loadData();
    },

    reloadData: function() {
        this._data = null;
        this._initialized = false;
        this._loading = false;
        this._loadData();
    },

    _loadData: function() {
        if (this._loading) return;
        this._loading = true;
        var self = this;
        self._data = {};

        DataService.getRegions('', 1).then(function(provinces) {
            if (!provinces || provinces.length === 0) {
                self._fallbackData();
                return;
            }

            var provincePromises = provinces.map(function(prov) {
                return DataService.getRegions(prov.id, 2).then(function(cities) {
                    if (!cities || cities.length === 0) {
                        self._data[prov.name] = {};
                        return;
                    }
                    var cityPromises = cities.map(function(city) {
                        return DataService.getRegions(city.id, 3).then(function(districts) {
                            return {
                                cityName: city.name,
                                districts: districts && districts.length > 0
                                    ? districts.map(function(d) { return d.name; })
                                    : []
                            };
                        });
                    });
                    return Promise.all(cityPromises).then(function(cityResults) {
                        self._data[prov.name] = {};
                        cityResults.forEach(function(cr) {
                            self._data[prov.name][cr.cityName] = cr.districts;
                        });
                    });
                });
            });

            return Promise.all(provincePromises);
        }).then(function() {
            self._initialized = true;
            self._loading = false;
            console.log('✅ RegionData 从数据库加载完成（共 ' + Object.keys(self._data).length + ' 个省份）');
        }).catch(function(err) {
            console.warn('⚠️ RegionData 数据库加载失败，使用内置备用数据:', err.message);
            self._fallbackData();
        });
    },

    _fallbackData: function() {
        var provinces = ['北京市','上海市','天津市','重庆市','河北省','山西省','辽宁省','吉林省','黑龙江省',
                         '江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省',
                         '广东省','海南省','四川省','贵州省','云南省','陕西省','甘肃省','青海省','台湾省',
                         '内蒙古自治区','广西壮族自治区','西藏自治区','宁夏回族自治区','新疆维吾尔自治区',
                         '香港特别行政区','澳门特别行政区'];
        var data = {};
        provinces.forEach(function(p) { data[p] = {}; });
        this._data = data;
        this._initialized = true;
        this._loading = false;
        console.warn('⚠️ RegionData 使用内置备用数据（仅少量省份）');
    },

    getProvinces: function() {
        this.init();
        return Object.keys(this._data);
    },

    getCities: function(province) {
        this.init();
        if (!province || !this._data[province]) return [];
        return Object.keys(this._data[province]);
    },

    getDistricts: function(province, city) {
        this.init();
        if (!province || !this._data[province]) return [];
        if (!city || !this._data[province][city]) return [];
        return this._data[province][city];
    },

    // 渲染下拉框（保留原有方法，供初始化使用）
    renderSelects: function(defaultProvince, defaultCity, defaultDistrict) {
        this.init();
        var provinces = this.getProvinces();
        var cities = this.getCities(defaultProvince);
        var districts = this.getDistricts(defaultProvince, defaultCity);

        var provinceOpts = provinces.map(function(p) {
            return '<option value="' + p + '" ' + (p === defaultProvince ? 'selected' : '') + '>' + p + '</option>';
        }).join('');

        var cityOpts = cities.map(function(c) {
            return '<option value="' + c + '" ' + (c === defaultCity ? 'selected' : '') + '>' + c + '</option>';
        }).join('');

        var districtOpts = districts.map(function(d) {
            return '<option value="' + d + '" ' + (d === defaultDistrict ? 'selected' : '') + '>' + d + '</option>';
        }).join('');

        return '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<select id="region_province" style="flex:1;min-width:80px;padding:6px;border:1px solid #ddd;border-radius:6px;">' +
            '<option value="">请选择省份</option>' + provinceOpts +
            '</select>' +
            '<select id="region_city" style="flex:1;min-width:80px;padding:6px;border:1px solid #ddd;border-radius:6px;">' +
            '<option value="">请选择城市</option>' + cityOpts +
            '</select>' +
            '<select id="region_district" style="flex:1;min-width:80px;padding:6px;border:1px solid #ddd;border-radius:6px;">' +
            '<option value="">请选择区县</option>' + districtOpts +
            '</select>' +
            '</div>';
    },

    // ★★★ 核心修复：强制刷新下拉框数据并触发联动 ★★★
    refreshSelects: function(province, city, district) {
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return;

        // 1. 重新填充省份列表
        var provinces = this.getProvinces();
        pSel.innerHTML = '<option value="">请选择省份</option>';
        provinces.forEach(function(p) {
            var selected = (p === province) ? 'selected' : '';
            pSel.innerHTML += '<option value="' + p + '" ' + selected + '>' + p + '</option>';
        });

        // 2. 触发省份 change 事件以加载城市
        var evt = document.createEvent('HTMLEvents');
        evt.initEvent('change', false, true);
        pSel.dispatchEvent(evt);

        // 3. 如果提供了城市，则填充城市并选中
        if (city) {
            // 获取该省份下的城市列表（此时 cSel 已被 onchange 填充）
            // 但为了确保，我们手动填充城市列表
            var cities = this.getCities(province);
            cSel.innerHTML = '<option value="">请选择城市</option>';
            cities.forEach(function(c) {
                var selected = (c === city) ? 'selected' : '';
                cSel.innerHTML += '<option value="' + c + '" ' + selected + '>' + c + '</option>';
            });
            // 触发城市 change 事件
            var evt2 = document.createEvent('HTMLEvents');
            evt2.initEvent('change', false, true);
            cSel.dispatchEvent(evt2);
        }

        // 4. 如果提供了区县，则填充并选中
        if (district) {
            var districts = this.getDistricts(province, city);
            dSel.innerHTML = '<option value="">请选择区县</option>';
            districts.forEach(function(d) {
                var selected = (d === district) ? 'selected' : '';
                dSel.innerHTML += '<option value="' + d + '" ' + selected + '>' + d + '</option>';
            });
        }
    },

    bindEvents: function() {
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return;

        // 移除旧事件避免重复绑定（使用新事件）
        pSel.onchange = function() {
            var province = this.value;
            var cities = window.RegionData.getCities(province);
            cSel.innerHTML = '<option value="">请选择城市</option>';
            cities.forEach(function(c) {
                cSel.innerHTML += '<option value="' + c + '">' + c + '</option>';
            });
            dSel.innerHTML = '<option value="">请选择区县</option>';
        };

        cSel.onchange = function() {
            var province = pSel.value;
            var city = this.value;
            var districts = window.RegionData.getDistricts(province, city);
            dSel.innerHTML = '<option value="">请选择区县</option>';
            districts.forEach(function(d) {
                dSel.innerHTML += '<option value="' + d + '">' + d + '</option>';
            });
        };

        // 如果已经预选了省份，触发加载
        if (pSel.value) {
            pSel.onchange();
            if (cSel.value) {
                cSel.onchange();
            }
        }
    },

    getSelected: function() {
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return null;

        return {
            province: pSel.value || '',
            city: cSel.value || '',
            district: dSel.value || ''
        };
    },

    setSelected: function(province, city, district) {
        // 此方法保留用于简单设置，但推荐使用 refreshSelects
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return;

        if (province) {
            pSel.value = province;
            if (typeof pSel.onchange === 'function') pSel.onchange();
        }
        if (city) {
            var cityOption = cSel.querySelector('option[value="' + city + '"]');
            if (cityOption) {
                cSel.value = city;
                if (typeof cSel.onchange === 'function') cSel.onchange();
            }
        }
        if (district) {
            var districtOption = dSel.querySelector('option[value="' + district + '"]');
            if (districtOption) {
                dSel.value = district;
            }
        }
    },

    getFullAddress: function(detail) {
        var selected = this.getSelected();
        if (!selected) return detail || '';
        var parts = [];
        if (selected.province) parts.push(selected.province);
        if (selected.city && selected.city !== selected.province) parts.push(selected.city);
        if (selected.district && selected.district !== selected.city) parts.push(selected.district);
        if (detail) parts.push(detail);
        return parts.join(' ');
    }
};