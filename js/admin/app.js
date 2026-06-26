window.AdminApp = {
    currentUser: null,
    currentPage: 'dashboard',

    init: function(user) {
        this.currentUser = user;
        this.switchPage('dashboard');
        AdminBackup.startScheduler();
    },

    switchPage: function(page) {
        this.currentPage = page;
        document.querySelectorAll('#adminApp .admin-page').forEach(function(el) {
            el.classList.remove('active');
        });
        var target = document.getElementById('admin-' + page);
        if (target) target.classList.add('active');

        document.querySelectorAll('.admin-nav .admin-nav-item').forEach(function(el) {
            el.classList.toggle('active', el.dataset.admin === page);
        });

        AdminPages.render(page);
    }
};