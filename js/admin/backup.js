window.AdminBackup = {
    timerId: null,

    manualBackup: function() {
        DataService.exportBackup()
            .then(function(data) {
                var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'yizaoxian_backup_' + new Date().toISOString().slice(0, 10) + '.json';
                a.click();
                URL.revokeObjectURL(url);
                Utils.toast('💾 备份已导出');
            })
            .catch(function(err) {
                Utils.toast('备份失败: ' + err.message);
            });
    },

    importBackup: function(event) {
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data && data.users !== undefined) {
                    DataService.importBackup(data)
                        .then(function() {
                            Utils.toast('📥 备份导入成功，页面即将刷新');
                            setTimeout(function() { location.reload(); }, 1000);
                        })
                        .catch(function(err) {
                            Utils.toast('导入失败: ' + err.message);
                        });
                } else {
                    Utils.toast('❌ 无效的备份文件');
                }
            } catch(err) {
                Utils.toast('❌ 文件解析失败');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    startScheduler: function() {
        if (this.timerId) clearTimeout(this.timerId);
        var config = CONFIG.BACKUP;
        if (!config.enabled) return;

        var now = new Date();
        var target = new Date(now);
        target.setHours(config.hour, config.minute, 0, 0);
        if (now >= target) target.setDate(target.getDate() + 1);
        var delay = target.getTime() - now.getTime();

        var self = this;
        this.timerId = setTimeout(function() {
            DataService.exportBackup().catch(function() {});
            Utils.toast('🔄 自动备份完成 (' + new Date().toLocaleString() + ')');
            self.startScheduler();
        }, delay);
    },

    updateConfig: function(enabled, hour, minute) {
        CONFIG.BACKUP.enabled = enabled;
        CONFIG.BACKUP.hour = hour;
        CONFIG.BACKUP.minute = minute;
        this.startScheduler();
        Utils.toast('备份设置已更新');
    }
};