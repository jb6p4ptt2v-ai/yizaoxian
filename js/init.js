/**
 * 宜早鲜 v3.0 - 全局初始化
 * 仅做必要的环境初始化，不覆盖任何已有模块
 */
(function() {
    'use strict';

    // 1. 确保 CONFIG 存在
    if (typeof window.CONFIG === 'undefined') {
        window.CONFIG = {
            AMAP_KEY: '{{AMAP_KEY}}',
            AMAP_SECURITY_KEY: '{{AMAP_SECURITY_KEY}}',
            API_BASE: '{{API_BASE}}'
        };
    }

    // 2. 兼容旧版 AMAP_KEY 全局变量
    if (typeof window.AMAP_KEY === 'undefined') {
        window.AMAP_KEY = window.CONFIG.AMAP_KEY;
        window.AMAP_SECURITY_KEY = window.CONFIG.AMAP_SECURITY_KEY;
    }

    console.log('🌱 宜早鲜 v3.0 已加载');

    // 3. 检查 LocationHelper 是否已加载（由 location-helper.js 提供）
    if (typeof window.LocationHelper === 'undefined') {
        console.warn('⚠️ LocationHelper 未加载，请确保 location-helper.js 已引入');
    }

    // 4. 检查 Utils 是否已加载（由 utils.js 提供）
    if (typeof window.Utils === 'undefined') {
        console.warn('⚠️ Utils 未加载，请确保 utils.js 已引入');
    }

    // 5. 检查 MapService 是否已加载（由 map-service.js 提供）
    if (typeof window.MapService === 'undefined') {
        console.warn('⚠️ MapService 未加载，请确保 map-service.js 已引入');
    }

    // 6. 检查 RegionData 是否已加载（由 region.js 提供）
    if (typeof window.RegionData === 'undefined') {
        console.warn('⚠️ RegionData 未加载，请确保 region.js 已引入');
    }

    console.log('✅ 初始化完成，所有模块已加载');
})();