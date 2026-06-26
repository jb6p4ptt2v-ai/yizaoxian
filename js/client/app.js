window.ClientApp = {
    currentUser: null,
    currentPage: 'home',
    _returnPage: null,
    _returnCallback: null,

    init: function(user) {
        this.currentUser = user;
        var isLoggedIn = !!user;

        document.getElementById('authApp').style.display = 'none';
        document.getElementById('clientApp').style.display = 'block';

        var display = document.getElementById('clientUserDisplay');
        var authBtn = document.getElementById('authBtn');
        var logoutBtn = document.getElementById('logoutBtn');

        if (isLoggedIn) {
            display.textContent = user.phone || '用户';
            if (authBtn) { authBtn.textContent = '退出'; authBtn.onclick = function() { Auth.logout(); }; }
            if (logoutBtn) logoutBtn.style.display = 'block';
            document.getElementById('profileName').textContent = '用户 ' + (user.phone ? user.phone.slice(-4) : '');
            document.getElementById('profilePhone').textContent = '新鲜 · 健康 · 农家';
        } else {
            display.textContent = '游客';
            if (authBtn) { authBtn.textContent = '登录'; authBtn.onclick = function() { ClientApp.toggleAuth(); }; }
            if (logoutBtn) logoutBtn.style.display = 'none';
            document.getElementById('profileName').textContent = '游客';
            document.getElementById('profilePhone').textContent = '登录后享受更多服务';
        }

        var adminBtn = document.getElementById('adminEntryBtn');
        if (adminBtn) {
            adminBtn.style.display = (isLoggedIn && user && user.role === 'admin') ? 'flex' : 'none';
        }

        if (window.ClientPages) {
            ClientPages.init(this);
        }

        this.navigateTo('home');

        var self = this;
        document.querySelectorAll('.bottom-nav .nav-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var page = this.dataset.page;
                if (page) self.navigateTo(page);
            });
        });

        if (window.MapService && window.MapService._loadMap) {
            window.MapService._loadMap(function() {});
        }

        if (window.RegionData && window.RegionData.init) {
            window.RegionData.init();
        }

        this.updateBadges();
    },

    toggleAuth: function() {
        var user = Auth.getCurrentUser();
        if (user) {
            Auth.logout();
        } else {
            this.showLoginModal();
        }
    },

    showLoginModal: function() {
        document.getElementById('clientApp').style.display = 'none';
        document.getElementById('authApp').style.display = 'block';
        Auth.showPage('login');
    },

    requireAuth: function(callback) {
        var user = Auth.getCurrentUser();
        if (user) {
            if (typeof callback === 'function') callback();
            return true;
        }

        if (confirm('请先登录后再进行操作，是否现在登录？')) {
            this._returnCallback = callback;
            this.showLoginModal();
        }
        return false;
    },

    navigateTo: function(page) {
        this.currentPage = page;

        document.querySelectorAll('#clientApp .page').forEach(function(el) {
            el.classList.remove('active');
        });

        var target = document.getElementById('page-' + page);
        if (target) target.classList.add('active');

        document.querySelectorAll('.bottom-nav .nav-item').forEach(function(el) {
            el.classList.toggle('active', el.dataset.page === page);
        });

        switch(page) {
            case 'home': if (ClientPages) ClientPages.renderProducts(); break;
            case 'cart': if (ClientPages) ClientPages.renderCart(); break;
            case 'orders': if (ClientPages) ClientPages.renderOrders(); break;
            case 'profile': if (ClientPages) ClientPages.renderProfile(); break;
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
    },

    isLoggedIn: function() {
        return !!Auth.getCurrentUser();
    },

    getCurrentUser: function() {
        return Auth.getCurrentUser();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var origHandleLogin = Auth.handleLogin;
    Auth.handleLogin = function() {
        origHandleLogin.call(Auth);
        var cb = ClientApp._returnCallback;
        if (cb) {
            ClientApp._returnCallback = null;
            setTimeout(function() {
                if (typeof cb === 'function') cb();
            }, 500);
        }
    };
});