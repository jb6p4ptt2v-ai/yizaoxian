window.ClientApp = {
    currentUser: null,
    currentPage: 'home',

    init: function(user) {
        this.currentUser = user;

        // 显示客户端界面
        document.getElementById('authApp').style.display = 'none';
        document.getElementById('clientApp').style.display = 'block';

        // 更新用户信息
        document.getElementById('clientUserDisplay').textContent = user.phone;
        document.getElementById('profileName').textContent = '用户 ' + user.phone.slice(-4);

        // 管理员入口
        var adminBtn = document.getElementById('adminEntryBtn');
        if (adminBtn) {
            adminBtn.style.display = (user.role === 'admin') ? 'flex' : 'none';
        }

        // 初始化页面
        ClientPages.init(this);
        this.navigateTo('home');

        // 绑定底部导航
        var self = this;
        document.querySelectorAll('.bottom-nav .nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var page = this.dataset.page;
                if (page) self.navigateTo(page);
            });
        });

        // 初始化地图
        if (window.MapService && window.MapService.init) {
            window.MapService.init();
        }

        // 初始化省市区数据
        if (window.RegionData && window.RegionData.init) {
            window.RegionData.init();
        }

        // 更新角标
        this.updateBadges();
    },

    navigateTo: function(page) {
        this.currentPage = page;

        // 隐藏所有页面
        document.querySelectorAll('#clientApp .page').forEach(function(el) {
            el.classList.remove('active');
        });

        var target = document.getElementById('page-' + page);
        if (target) target.classList.add('active');

        // 导航高亮
        document.querySelectorAll('.bottom-nav .nav-item').forEach(function(el) {
            el.classList.toggle('active', el.dataset.page === page);
        });

        // 渲染对应页面
        switch(page) {
            case 'home': ClientPages.renderProducts(); break;
            case 'cart': ClientPages.renderCart(); break;
            case 'orders': ClientPages.renderOrders(); break;
            case 'profile': ClientPages.renderProfile(); break;
            default: break;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    updateBadges: function() {
        try {
            var cart = DataService.getCart();
            var count = 0;
            if (cart && typeof cart === 'object') {
                count = Object.values(cart).reduce(function(a, b) { return a + b; }, 0);
            }
            var badge = document.getElementById('cartBadge');
            if (badge) badge.textContent = count;

            var navBadge = document.getElementById('navCartBadge');
            if (navBadge) {
                if (count > 0) {
                    navBadge.style.display = 'flex';
                    navBadge.textContent = count;
                } else {
                    navBadge.style.display = 'none';
                }
            }
        } catch(e) {
            console.warn('更新角标失败:', e.message);
        }
    }
};