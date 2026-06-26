window.Utils = {
    formatPrice: function(p) { return '¥' + Number(p).toFixed(2); },
    now: function() { return new Date().toISOString().replace('T', ' ').slice(0, 16); },
    toast: function(msg) {
        var el = document.getElementById('backupToast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(function() { el.classList.remove('show'); }, 2500);
    },
    getNextId: function(data, key) {
        if (!data._ids) data._ids = {};
        if (!data._ids[key]) data._ids[key] = 1;
        var id = data._ids[key];
        data._ids[key] = id + 1;
        return id;
    },
    genId: function() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
};