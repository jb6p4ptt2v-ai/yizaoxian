/**
 * 支付助手 - 银联支付预留
 * 测试阶段默认支付成功，后续替换为真实银联SDK
 */
window.PaymentHelper = (function() {
    'use strict';

    var TEST_MODE = true;

    var UNIONPAY_CONFIG = {
        merId: '{{MER_ID}}',
        appId: '{{APP_ID}}',
        env: 'test',
        notifyUrl: '{{NOTIFY_URL}}'
    };

    function pay(orderData, callback) {
        console.log('💳 发起支付:', orderData);

        if (TEST_MODE) {
            console.log('🧪 测试模式：模拟支付成功');
            var result = {
                success: true,
                orderId: orderData.orderId,
                transactionId: 'TEST_' + Date.now().toString(36),
                message: '支付成功（测试模式）',
                data: orderData
            };
            if (typeof callback === 'function') {
                setTimeout(function() {
                    callback(result);
                }, 500);
            }
            return result;
        }

        console.warn('⚠️ 银联支付未接入，当前为测试模式');
        return {
            success: false,
            message: '支付功能接入中，请使用测试模式'
        };
    }

    function setTestMode(enabled) {
        TEST_MODE = enabled;
        console.log('🧪 支付模式:', enabled ? '测试模式（默认成功）' : '正式模式（需接入银联）');
    }

    function setConfig(config) {
        Object.assign(UNIONPAY_CONFIG, config);
        console.log('✅ 银联配置已更新');
    }

    function getConfig() {
        return {
            mode: TEST_MODE ? 'test' : 'production',
            unionpay: UNIONPAY_CONFIG
        };
    }

    return {
        pay: pay,
        setTestMode: setTestMode,
        setConfig: setConfig,
        getConfig: getConfig,
        TEST_MODE: TEST_MODE
    };
})();
console.log('✅ PaymentHelper 已加载（测试模式：默认支付成功）');