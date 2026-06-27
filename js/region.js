window.RegionData = {
    _data: null,
    _initialized: false,
    _loading: false,

    init: function() {
        if (this._initialized) return;
        this._loadData();
    },

    _loadData: function() {
        if (this._loading) return;
        this._loading = true;
        // 尝试从数据库动态加载
        if (typeof DataService !== 'undefined' && DataService.getRegions) {
            DataService.getRegions('', 1).then(function(provinces) {
                if (provinces && provinces.length > 0) {
                    this._data = {};
                    provinces.forEach(function(p) {
                        this._data[p.name] = {};
                    }.bind(this));
                    // 加载城市
                    var promises = provinces.map(function(p) {
                        return DataService.getRegions(p.id, 2).then(function(cities) {
                            if (cities && cities.length > 0) {
                                this._data[p.name] = {};
                                cities.forEach(function(c) {
                                    this._data[p.name][c.name] = [];
                                }.bind(this));
                                // 加载区县
                                var districtPromises = cities.map(function(c) {
                                    return DataService.getRegions(c.id, 3).then(function(districts) {
                                        if (districts && districts.length > 0) {
                                            this._data[p.name][c.name] = districts.map(function(d) { return d.name; });
                                        }
                                    }.bind(this));
                                }.bind(this));
                                return Promise.all(districtPromises);
                            }
                            return Promise.resolve();
                        }.bind(this));
                    }.bind(this));
                    Promise.all(promises).then(function() {
                        this._initialized = true;
                        this._loading = false;
                        console.log('✅ RegionData 从数据库加载完成');
                    }.bind(this)).catch(function() {
                        this._fallbackData();
                    }.bind(this));
                } else {
                    this._fallbackData();
                }
            }.bind(this)).catch(function() {
                this._fallbackData();
            }.bind(this));
        } else {
            this._fallbackData();
        }
    },

    _fallbackData: function() {
        // 如果数据库加载失败，使用内置数据（仅常用省份）
        this._data = this._buildFallbackData();
        this._initialized = true;
        this._loading = false;
        console.log('⚠️ RegionData 使用内置数据');
    },

    _buildFallbackData: function() {
        return {
            '北京市': { '北京市': ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '大兴区', '顺义区', '昌平区', '房山区', '门头沟区', '怀柔区', '平谷区', '密云区', '延庆区'] },
            '上海市': { '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'] },
            '天津市': { '天津市': ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'] },
            '重庆市': { '重庆市': ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区', '梁平区', '武隆区'] },
            '河北省': { '石家庄市': ['长安区', '桥西区', '新华区', '井陉矿区', '裕华区', '藁城区', '鹿泉区', '栾城区'], '唐山市': ['路南区', '路北区', '古冶区', '开平区', '丰南区', '丰润区', '曹妃甸区'] },
            '山西省': { '太原市': ['小店区', '迎泽区', '杏花岭区', '尖草坪区', '万柏林区', '晋源区'] },
            '辽宁省': { '沈阳市': ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区'] },
            '吉林省': { '长春市': ['南关区', '宽城区', '朝阳区', '二道区', '绿园区', '双阳区', '九台区'] },
            '黑龙江省': { '哈尔滨市': ['道里区', '南岗区', '道外区', '平房区', '松北区', '香坊区', '呼兰区', '阿城区', '双城区'] },
            '江苏省': { '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'], '苏州市': ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '常熟市', '张家港市', '昆山市', '太仓市'] },
            '浙江省': { '杭州市': ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '富阳区', '临安区', '桐庐县', '淳安县'], '宁波市': ['海曙区', '江北区', '北仑区', '镇海区', '鄞州区', '奉化区', '余姚市', '慈溪市', '象山县', '宁海县'] },
            '安徽省': { '合肥市': ['瑶海区', '庐阳区', '蜀山区', '包河区', '长丰县', '肥东县', '肥西县', '庐江县', '巢湖市'] },
            '福建省': { '福州市': ['鼓楼区', '台江区', '仓山区', '马尾区', '晋安区', '长乐区', '闽侯县', '连江县', '罗源县', '闽清县', '永泰县', '平潭县'], '厦门市': ['思明区', '海沧区', '湖里区', '集美区', '同安区', '翔安区'] },
            '江西省': { '南昌市': ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区', '红谷滩区'] },
            '山东省': { '济南市': ['历下区', '市中区', '槐荫区', '天桥区', '历城区', '长清区', '章丘区', '济阳区', '莱芜区', '钢城区'], '青岛市': ['市南区', '市北区', '黄岛区', '崂山区', '李沧区', '城阳区', '即墨区', '胶州市', '平度市', '莱西市'] },
            '河南省': { '郑州市': ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '中牟县', '巩义市', '荥阳市', '新密市', '新郑市', '登封市'] },
            '湖北省': { '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'], '宜昌市': ['西陵区', '伍家岗区', '点军区', '猇亭区', '夷陵区', '宜都市', '枝江市', '当阳市', '远安县', '兴山县', '秭归县', '长阳土家族自治县', '五峰土家族自治县'] },
            '湖南省': { '长沙市': ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '浏阳市', '宁乡市', '长沙县'] },
            '广东省': { '广州市': ['越秀区', '海珠区', '荔湾区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'], '深圳市': ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区'], '东莞市': ['莞城区', '南城区', '万江区', '石碣镇', '石龙镇', '茶山镇', '石排镇', '企石镇', '横沥镇', '桥头镇', '谢岗镇', '东坑镇', '常平镇', '寮步镇', '大朗镇', '黄江镇', '清溪镇', '塘厦镇', '凤岗镇', '大岭山镇', '长安镇', '虎门镇', '厚街镇', '沙田镇', '道滘镇', '洪梅镇', '麻涌镇', '望牛墩镇', '中堂镇', '高埗镇', '樟木头镇', '松山湖'] },
            '海南省': { '海口市': ['秀英区', '龙华区', '琼山区', '美兰区'] },
            '四川省': { '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区', '简阳市', '都江堰市', '彭州市', '邛崃市', '崇州市'] },
            '贵州省': { '贵阳市': ['南明区', '云岩区', '花溪区', '乌当区', '白云区', '观山湖区'] },
            '云南省': { '昆明市': ['五华区', '盘龙区', '官渡区', '西山区', '东川区', '呈贡区', '晋宁区'] },
            '陕西省': { '西安市': ['新城区', '碑林区', '莲湖区', '灞桥区', '未央区', '雁塔区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区'] },
            '甘肃省': { '兰州市': ['城关区', '七里河区', '西固区', '安宁区', '红古区'] },
            '青海省': { '西宁市': ['城东区', '城中区', '城西区', '城北区', '湟中区'] },
            '台湾省': { '台北市': ['中正区', '大同区', '中山区', '松山区', '大安区', '万华区', '信义区', '士林区', '北投区', '内湖区', '南港区', '文山区'] },
            '内蒙古自治区': { '呼和浩特市': ['新城区', '回民区', '玉泉区', '赛罕区'] },
            '广西壮族自治区': { '南宁市': ['兴宁区', '青秀区', '江南区', '西乡塘区', '良庆区', '邕宁区'] },
            '西藏自治区': { '拉萨市': ['城关区', '堆龙德庆区', '达孜区'] },
            '宁夏回族自治区': { '银川市': ['兴庆区', '西夏区', '金凤区', '永宁县', '贺兰县'] },
            '新疆维吾尔自治区': { '乌鲁木齐市': ['天山区', '沙依巴克区', '新市区', '水磨沟区', '头屯河区', '达坂城区', '米东区'] },
            '香港特别行政区': { '香港岛': ['中西区', '湾仔区', '东区', '南区'] },
            '澳门特别行政区': { '澳门半岛': ['花地玛堂区', '花王堂区', '望德堂区', '风顺堂区', '大堂区'] }
        };
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

    // ★★★ 获取完整地址（省市区 + 详细地址拼接） ★★★
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