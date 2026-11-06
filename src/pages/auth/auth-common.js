/**
 * Auth Common JavaScript
 * 认证页面通用脚本
 */

// 密码确认验证
window.setupPasswordConfirmation = function (passwordId, confirmPasswordId) {
    const password = document.getElementById(passwordId);
    const confirmPassword = document.getElementById(confirmPasswordId);
    if (!password || !confirmPassword) return;

    function validate() {
        const msg = password.value !== confirmPassword.value
            ? (window.i18nResources?.passwordConfirmationFailed || "密码不一致")
            : '';
        confirmPassword.setCustomValidity(msg);
    }
    password.addEventListener('input', validate);
    confirmPassword.addEventListener('input', validate);
};

// 发送验证码
window.sendVerificationCode = function (button, sendRequest) {
    let countdown = 60;
    const originalText = button.textContent;

    button.addEventListener('click', async function () {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = '发送中...';

        try {
            await sendRequest();
            const timer = setInterval(function () {
                countdown--;
                button.textContent = countdown + 's';
                if (countdown <= 0) {
                    clearInterval(timer);
                    button.textContent = originalText;
                    button.disabled = false;
                    countdown = 60;
                }
            }, 1000);
        } catch (error) {
            button.textContent = originalText;
            button.disabled = false;
            alert(error.message || '发送失败');
        }
    });
};
