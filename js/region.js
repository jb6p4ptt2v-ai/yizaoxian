window.RegionData = {
    _data: null,
    _initialized: false,
    _loading: false,

    init: function() {
        if (this._initialized) return;
        this._loadData();
    },

    // ================================================================
    // 核心修改：使用 ID 逐级查询，正确组装省市区数据
    // ================================================================
    _loadData: function() {
        if (this._loading) return;
        this._loading = true;
        var self = this;

        // 初始化数据容器
        self._data = {};

        // 1. 获取所有省份（level=1）
        DataService.getRegions('', 1).then(function(provinces) {
            if (!provinces || provinces.length === 0) {
                self._fallbackData();
                return;
            }

            var provincePromises = provinces.map(function(prov) {
                // 2. 对每个省份，用其 ID 获取城市（level=2）
                return DataService.getRegions(prov.id, 2).then(function(cities) {
                    if (!cities || cities.length === 0) {
                        self._data[prov.name] = {};
                        return;
                    }

                    var cityPromises = cities.map(function(city) {
                        // 3. 对每个城市，用其 ID 获取区县（level=3）
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

    // ================================================================
    // 备用数据（仅保留常用省份，确保 UI 不报错，但强烈建议同步）
    // ================================================================
    _fallbackData: function() {
        this._data = this._buildFallbackData();
        this._initialized = true;
        this._loading = false;
        console.warn('⚠️ RegionData 使用内置备用数据（仅少量省份）');
    },

    _buildFallbackData: function() {
        // 保留原备用数据，但只包含省份名称，城市区县为空（提示同步）
        var provinces = ['北京市','上海市','天津市','重庆市','河北省','山西省','辽宁省','吉林省','黑龙江省',
                         '江苏省','浙江省','安徽省','福建省','江西省','山东省','河南省','湖北省','湖南省',
                         '广东省','海南省','四川省','贵州省','云南省','陕西省','甘肃省','青海省','台湾省',
                         '内蒙古自治区','广西壮族自治区','西藏自治区','宁夏回族自治区','新疆维吾尔自治区',
                         '香港特别行政区','澳门特别行政区'];
        var data = {};
        provinces.forEach(function(p) { data[p] = {}; });
        return data;
    },

    // ================================================================
    // 以下方法保持不变（操作均基于 name 字符串，与数据结构无关）
    // ================================================================
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

    bindEvents: function() {
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return;

        pSel.onchange = function() {
            var province = this.value;
            var cities = window.RegionData.getCities(province);
            cSel.innerHTML = '<option value="">请选择城市</option>' +
                cities.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
            dSel.innerHTML = '<option value="">请选择区县</option>';
        };

        cSel.onchange = function() {
            var province = pSel.value;
            var city = this.value;
            var districts = window.RegionData.getDistricts(province, city);
            dSel.innerHTML = '<option value="">请选择区县</option>' +
                districts.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
        };

        if (pSel.value) {
            pSel.onchange();
            setTimeout(function() {
                if (cSel.value) {
                    cSel.onchange();
                }
            }, 50);
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
        var pSel = document.getElementById('region_province');
        var cSel = document.getElementById('region_city');
        var dSel = document.getElementById('region_district');
        if (!pSel || !cSel || !dSel) return;

        if (province) {
            pSel.value = province;
            if (typeof pSel.onchange === 'function') pSel.onchange();
        }
        if (city) {
            setTimeout(function() {
                if (cSel.querySelector('option[value="' + city + '"]')) {
                    cSel.value = city;
                    if (typeof cSel.onchange === 'function') cSel.onchange();
                }
            }, 100);
        }
        if (district) {
            setTimeout(function() {
                if (dSel.querySelector('option[value="' + district + '"]')) {
                    dSel.value = district;
                }
            }, 200);
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
        return parts.join('');
    }
};