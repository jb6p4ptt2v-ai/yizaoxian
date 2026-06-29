window.Auth = {
    // ===== 管理员登录 =====
    getCurrentAdmin: function() {
        try {
            var raw = localStorage.getItem('yizaoxian_admin_session');
            if (!raw) return null;
            var data = JSON.parse(raw);
            // 检查是否过期（7天）
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem('yizaoxian_admin_session');
                return null;
            }
            return data.user || null;
        } catch(e) { return null; }
    },

    setCurrentAdmin: function(admin) {
        var data = {
            user: admin,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天
        };
        localStorage.setItem('yizaoxian_admin_session', JSON.stringify(data));
    },

    logoutAdmin: function() {
        localStorage.removeItem('yizaoxian_admin_session');
        window.location.href = 'admin.html';
    },

    handleAdminLogin: function() {
        var username = document.getElementById('loginUsername').value.trim();
        var password = document.getElementById('loginPassword').value.trim();
        var errEl = document.getElementById('loginError');
        if (!errEl) return;
        errEl.style.display = 'none';

        if (!username || !password) {
            errEl.textContent = '请输入用户名和密码';
            errEl.style.display = 'block';
            return;
        }

        DataService.adminLogin(username, password)
            .then(function(result) {
                if (result.success && result.user) {
                    Auth.setCurrentAdmin(result.user);
                    window.location.href = 'admin.html';
                } else {
                    errEl.textContent = result.error || '登录失败';
                    errEl.style.display = 'block';
                }
            })
            .catch(function(error) {
                errEl.textContent = error.message || '登录失败，请稍后重试';
                errEl.style.display = 'block';
            });
    },

    // ===== 前台用户登录 =====
    getCurrentUser: function() {
        try {
            var raw = localStorage.getItem('yizaoxian_session');
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem('yizaoxian_session');
                return null;
            }
            return data.user || null;
        } catch(e) { return null; }
    },

    setCurrentUser: function(user) {
        var data = {
            user: user,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天
        };
        localStorage.setItem('yizaoxian_session', JSON.stringify(data));
    },

    showPage: function(page) {
        var pages = document.querySelectorAll('#authApp .auth-page');
        pages.forEach(function(el) { el.classList.remove('active'); });
        var target = document.getElementById('auth-' + page);
        if (target) target.classList.add('active');

        var errs = document.querySelectorAll('#authApp .error-msg, #authApp .success-msg');
        errs.forEach(function(el) { el.style.display = 'none'; el.textContent = ''; });

        if (page === 'forgot') {
            document.getElementById('forgotQuestionGroup').style.display = 'none';
            document.getElementById('forgotNewPassGroup').style.display = 'none';
            document.getElementById('forgotBtn').textContent = '下一步';
            document.getElementById('forgotBtn').onclick = Auth.handleForgotStep;
            document.getElementById('forgotPhone').value = '';
            document.getElementById('forgotAnswer').value = '';
            document.getElementById('forgotNewPassword').value = '';
            window._forgotStep = 0;
            window._forgotUser = null;
        }
    },

    handleLogin: function() {
        var phone = document.getElementById('loginPhone').value.trim();
        var password = document.getElementById('loginPassword').value.trim();
        var errEl = document.getElementById('loginError');
        if (!errEl) return;
        errEl.style.display = 'none';

        if (!phone || !password) {
            errEl.textContent = '请输入手机号和密码';
            errEl.style.display = 'block';
            return;
        }

        DataService.login(phone, password)
            .then(function(result) {
                if (result.success && result.user) {
                    Auth.setCurrentUser(result.user);
                    if (result.user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.reload();
                        setTimeout(function() {
                            if (window.ClientApp && window.ClientApp.updateMessageBadge) {
                                window.ClientApp.updateMessageBadge();
                            }
                        }, 500);
                    }
                } else {
                    errEl.textContent = result.error || '登录失败';
                    errEl.style.display = 'block';
                }
            })
            .catch(function(error) {
                errEl.textContent = error.message || '登录失败，请稍后重试';
                errEl.style.display = 'block';
            });
    },

    handleRegister: function() {
        var phone = document.getElementById('regPhone').value.trim();
        var password = document.getElementById('regPassword').value.trim();
        var question = document.getElementById('regQuestion').value;
        var answer = document.getElementById('regAnswer').value.trim();
        var errEl = document.getElementById('registerError');
        var sucEl = document.getElementById('registerSuccess');
        if (!errEl || !sucEl) return;
        errEl.style.display = 'none';
        sucEl.style.display = 'none';

        if (!phone || !/^\d{11}$/.test(phone)) {
            errEl.textContent = '请输入有效的11位手机号';
            errEl.style.display = 'block';
            return;
        }
        if (password.length < 6) {
            errEl.textContent = '密码至少6位';
            errEl.style.display = 'block';
            return;
        }
        if (!answer) {
            errEl.textContent = '请设置密保答案';
            errEl.style.display = 'block';
            return;
        }

        DataService.register(phone, password, question, answer)
            .then(function(result) {
                if (result.success) {
                    sucEl.textContent = '注册成功！请登录';
                    sucEl.style.display = 'block';
                    document.getElementById('regPhone').value = '';
                    document.getElementById('regPassword').value = '';
                    document.getElementById('regAnswer').value = '';
                    setTimeout(function() { Auth.showPage('login'); }, 1500);
                } else {
                    errEl.textContent = result.error || '注册失败';
                    errEl.style.display = 'block';
                }
            })
            .catch(function(error) {
                errEl.textContent = error.message || '注册失败，请稍后重试';
                errEl.style.display = 'block';
            });
    },

    handleForgotStep: function() {
        var errEl = document.getElementById('forgotError');
        var sucEl = document.getElementById('forgotSuccess');
        if (!errEl || !sucEl) return;
        errEl.style.display = 'none';
        sucEl.style.display = 'none';

        if (window._forgotStep === undefined) window._forgotStep = 0;

        if (window._forgotStep === 0) {
            var phone = document.getElementById('forgotPhone').value.trim();
            if (!phone) {
                errEl.textContent = '请输入手机号';
                errEl.style.display = 'block';
                return;
            }
            DataService.login(phone, '')
                .then(function(result) {
                    if (!result.success || !result.user) {
                        errEl.textContent = '该手机号未注册';
                        errEl.style.display = 'block';
                        return;
                    }
                    window._forgotUser = result.user;
                    document.getElementById('forgotQuestionLabel').textContent = '密保问题：' + result.user.securityQuestion;
                    document.getElementById('forgotQuestionGroup').style.display = 'block';
                    document.getElementById('forgotBtn').textContent = '验证答案';
                    window._forgotStep = 1;
                })
                .catch(function() {
                    errEl.textContent = '该手机号未注册';
                    errEl.style.display = 'block';
                });
            return;
        }

        if (window._forgotStep === 1) {
            var answer = document.getElementById('forgotAnswer').value.trim();
            if (!answer) {
                errEl.textContent = '请输入密保答案';
                errEl.style.display = 'block';
                return;
            }
            var phone = window._forgotUser.phone;
            DataService.resetPassword(phone, answer, '')
                .then(function(result) {
                    if (result.success) {
                        document.getElementById('forgotNewPassGroup').style.display = 'block';
                        document.getElementById('forgotBtn').textContent = '重置密码';
                        window._forgotStep = 2;
                        sucEl.textContent = '密保验证通过，请设置新密码';
                        sucEl.style.display = 'block';
                    } else {
                        errEl.textContent = result.error || '密保答案错误';
                        errEl.style.display = 'block';
                    }
                })
                .catch(function(error) {
                    errEl.textContent = error.message || '验证失败';
                    errEl.style.display = 'block';
                });
            return;
        }

        if (window._forgotStep === 2) {
            var newPass = document.getElementById('forgotNewPassword').value.trim();
            if (newPass.length < 6) {
                errEl.textContent = '新密码至少6位';
                errEl.style.display = 'block';
                return;
            }
            var phone = window._forgotUser.phone;
            var answer = document.getElementById('forgotAnswer').value.trim();
            DataService.resetPassword(phone, answer, newPass)
                .then(function(result) {
                    if (result.success) {
                        sucEl.textContent = '密码重置成功，请登录';
                        sucEl.style.display = 'block';
                        setTimeout(function() { Auth.showPage('login'); }, 1500);
                    } else {
                        errEl.textContent = result.error || '重置失败';
                        errEl.style.display = 'block';
                    }
                })
                .catch(function(error) {
                    errEl.textContent = error.message || '操作失败';
                    errEl.style.display = 'block';
                });
        }
    },

    handleChangePassword: function(oldPassword, newPassword, confirmPassword) {
        return new Promise(function(resolve, reject) {
            var user = Auth.getCurrentUser();
            if (!user) {
                reject(new Error('请先登录'));
                return;
            }
            if (!oldPassword || !newPassword || !confirmPassword) {
                reject(new Error('请填写完整信息'));
                return;
            }
            if (newPassword.length < 6) {
                reject(new Error('新密码至少6位'));
                return;
            }
            if (newPassword !== confirmPassword) {
                reject(new Error('两次输入的密码不一致'));
                return;
            }
            DataService.changePassword(user.id, oldPassword, newPassword)
                .then(function(result) {
                    if (result.success) {
                        var currentUser = Auth.getCurrentUser();
                        if (currentUser) {
                            currentUser.password = newPassword;
                            Auth.setCurrentUser(currentUser);
                        }
                        resolve(result);
                    } else {
                        reject(new Error(result.error || '修改失败'));
                    }
                })
                .catch(function(error) {
                    reject(error);
                });
        });
    },

    logout: function() {
        localStorage.removeItem('yizaoxian_session');
        window.location.href = 'index.html';
    }
};