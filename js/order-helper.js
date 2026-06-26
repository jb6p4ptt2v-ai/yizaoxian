/**
 * 订单助手 - 截单时间、提货码、订单状态管理
 * 完全对齐多多买菜逻辑
 */
window.OrderHelper = (function() {
    'use strict';

    // 截单时间：每天 23:00
    var CUTOFF_HOUR = 23;
    var CUTOFF_MINUTE = 0;

    /**
     * 生成6位提货码（数字+字母混合）
     */
    function generatePickupCode() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var code = '';
        for (var i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * 获取当前截单时间（当天23:00）
     */
    function getTodayCutoffTime() {
        var now = new Date();
        var cutoff = new Date(now);
        cutoff.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
        return cutoff.toISOString();
    }

    /**
     * 判断当前是否已过截单时间
     */
    function isPastCutoff() {
        var now = new Date();
        var cutoff = new Date(now);
        cutoff.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
        return now >= cutoff;
    }

    /**
     * 计算预计提货日期（次日送达）
     * 如果当前时间在截单时间之前，预计提货日期为次日；否则为后日
     */
    function getExpectedPickupDate() {
        var now = new Date();
        var cutoff = new Date(now);
        cutoff.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
        var daysToAdd = (now >= cutoff) ? 2 : 1; // 次日或后日
        var pickup = new Date(now);
        pickup.setDate(pickup.getDate() + daysToAdd);
        return pickup.toISOString().slice(0, 10);
    }

    /**
     * 获取订单状态显示文本（对齐多多买菜）
     */
    function getStatusText(status) {
        var map = {
            'pending': '待提货',
            'shipped': '配送中',
            'completed': '已完成',
            'cancelled': '已取消',
            'ready_pickup': '待提货',
            'picked': '已提货'
        };
        return map[status] || status;
    }

    /**
     * 构建订单对象（包含提货码、截单时间、预计提货日期）
     */
    function buildOrder(orderData) {
        var now = new Date();
        var cutoffTime = getTodayCutoffTime();
        var expectedPickupDate = getExpectedPickupDate();
        var pickupCode = generatePickupCode();

        return {
            ...orderData,
            pickupCode: pickupCode,
            cutoffTime: cutoffTime,
            expectedPickupDate: expectedPickupDate,
            status: 'pending',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };
    }

    return {
        generatePickupCode: generatePickupCode,
        getTodayCutoffTime: getTodayCutoffTime,
        isPastCutoff: isPastCutoff,
        getExpectedPickupDate: getExpectedPickupDate,
        getStatusText: getStatusText,
        buildOrder: buildOrder,
        CUTOFF_HOUR: CUTOFF_HOUR,
        CUTOFF_MINUTE: CUTOFF_MINUTE
    };
})();
console.log('✅ OrderHelper 已加载（截单时间+提货码）');