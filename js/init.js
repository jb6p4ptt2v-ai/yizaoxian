/**
 * 宜早鲜 v3.0 - 全局初始化
 * 保留原有 Utils，不覆盖，只扩展
 */
(function() {
    'use strict';

    // 保持 CONFIG 不变
    if (typeof window.CONFIG === 'undefined') {
        window.CONFIG = {
            AMAP_KEY: '{{AMAP_KEY}}',
            AMAP_SECURITY_KEY: '{{AMAP_SECURITY_KEY}}',
            API_BASE: '{{API_BASE}}'
        };
    }

    if (typeof AMAP_KEY === 'undefined') {
        window.AMAP_KEY = window.CONFIG.AMAP_KEY;
        window.AMAP_SECURITY_KEY = window.CONFIG.AMAP_SECURITY_KEY;
    }

    console.log('🌱 宜早鲜 v3.0 已加载');

    // 如果 Utils 已存在，不覆盖
    // 如果不存在，创建最小化的 Utils（但 utils.js 应该已经定义了）
    if (typeof window.Utils === 'undefined') {
        window.Utils = {
            formatPrice: function(p) {
                return '¥' + Number(p).toFixed(2);
            },
            now: function() {
                return new Date().toISOString().replace('T', ' ').slice(0, 16);
            },
            toast: function(msg, duration) {
                duration = duration || 2000;
                var old = document.querySelector('.toast-message');
                if (old) old.remove();
                var div = document.createElement('div');
                div.className = 'toast-message';
                div.textContent = msg;
                div.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 24px;border-radius:20px;z-index:10000;font-size:14px;max-width:80%;text-align:center;';
                document.body.appendChild(div);
                setTimeout(function() { div.remove(); }, duration);
            },
            getNextId: function(data, key) {
                if (!data._ids) data._ids = {};
                if (!data._ids[key]) data._ids[key] = 1;
                var id = data._ids[key];
                data._ids[key] = id + 1;
                return id;
            },
            genId: function() {
                return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            }
        };
    }

    // 如果 LocationHelper 未定义（由 location-helper.js 提供），不做任何事
    // 如果 location-helper.js 未加载，给出提示
    if (typeof window.LocationHelper === 'undefined') {
        console.warn('⚠️ LocationHelper 未加载，请确保 location-helper.js 已引入');
    }
})();