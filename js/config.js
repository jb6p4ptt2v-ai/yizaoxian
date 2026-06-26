window.CONFIG = {
    // 高德地图 Key（从环境变量读取）
    AMAP_KEY: (window.__ENV__ && window.__ENV__.AMAP_KEY) || '',
    // 高德地图安全密钥（从环境变量读取）
    AMAP_SECURITY_KEY: (window.__ENV__ && window.__ENV__.AMAP_SECURITY_KEY) || '',
    // API 地址
    API_BASE: (window.__ENV__ && window.__ENV__.API_BASE) || '',
    DEFAULT_LOCATION: { lng: 116.397, lat: 39.908 },
    STORAGE_PREFIX: 'yizaoxian_',
    BACKUP: {
        enabled: true,
        hour: 3,
        minute: 0
    }
};

// 如果密钥未配置，给出警告
if (!window.CONFIG.AMAP_KEY || !window.CONFIG.AMAP_SECURITY_KEY) {
    console.warn('⚠️ 高德地图 Key 或安全密钥未配置，地图功能将不可用。请在 Cloudflare Pages 环境变量中设置 AMAP_KEY 和 AMAP_SECURITY_KEY。');
}

console.log('📋 CONFIG 初始化完成', {
    AMAP_KEY: window.CONFIG.AMAP_KEY ? '已配置' : '未配置',
    AMAP_SECURITY_KEY: window.CONFIG.AMAP_SECURITY_KEY ? '已配置' : '未配置',
    API_BASE: window.CONFIG.API_BASE || '未配置'
});