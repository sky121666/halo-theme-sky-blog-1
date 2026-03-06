/**
 * Illustration Theme Interaction Logic
 * 动态插画界面的交互逻辑 (眼球跟随，输入/偷看/错误状态)
 */

document.addEventListener('DOMContentLoaded', () => {
    const scene = document.getElementById('art-scene');
    if (!scene) return; // 如果当前不是动态插画风格，直接退出

    const trackers = document.querySelectorAll('.tracker');
    // 获取表单相关的输入体验容器
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    const pwdInputs = document.querySelectorAll('input[type="password"], input.password-field');
    // 适配现有的查看密码按钮逻辑 (由 auth-common.js 所控)
    const togglePwdBtns = document.querySelectorAll('.toggle-password-button');

    // 检查页面是否处于错误提示状态 (Spring Security 报错拦截)
    const hasErrorAlert = document.querySelector('.bg-error\\/10') !== null || new URLSearchParams(window.location.search).has('error');

    let currentState = 'idle';
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    // 初始化每个眼球的物理状态
    const eyesData = Array.from(trackers).map(el => ({
        el,
        currentX: 0, currentY: 0,
        targetX: 0, targetY: 0,
        maxDist: el.classList.contains('eye-dot-wrap') ? 6 : 4 // 小黑眼球允许移动更远
    }));

    // 监听鼠标轨迹
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // 渲染循环 (实现丝滑跟手)
    function renderLoop() {
        eyesData.forEach(data => {
            if (currentState === 'idle' || currentState === 'typing') {
                const rect = data.el.parentElement.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;

                const angle = Math.atan2(mouseY - cy, mouseX - cx);
                data.targetX = Math.cos(angle) * data.maxDist;
                data.targetY = Math.sin(angle) * data.maxDist;
            } else {
                // 如果是看明文或错误状态，眼球目标位置归零或看偏下
                data.targetX = 0;
                data.targetY = currentState === 'error' ? 4 : 0;
            }

            // Lerp 缓动公式
            data.currentX += (data.targetX - data.currentX) * 0.15;
            data.currentY += (data.targetY - data.currentY) * 0.15;

            data.el.style.transform = `translate(${data.currentX}px, ${data.currentY}px)`;
        });

        requestAnimationFrame(renderLoop);
    }
    renderLoop();

    // 状态机更新视图
    function setState(newState) {
        if (currentState === 'error' && newState !== 'idle' && newState !== 'error') return;
        scene.className = `art-scene state-${newState}`;
        currentState = newState;
    }

    // 初始错误检查
    if (hasErrorAlert) {
        setState('error');
        setTimeout(() => {
            setState('idle');
        }, 2500);
    }

    // 事件绑定
    const handleFocus = () => setState('typing');
    const handleBlur = () => { if (['typing', 'peeking'].includes(currentState)) setState('idle'); };

    textInputs.forEach(input => {
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
    });

    pwdInputs.forEach(input => {
        input.addEventListener('focus', handleFocus);
        input.addEventListener('blur', handleBlur);
    });

    // 劫持密码显示/隐藏按钮的点击交互
    togglePwdBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 原生的 auth-common.js 在点击后会切换 data-show 属性和 input.type
            // 我们延迟 10ms 确保类型已经变成 text 后做判断
            setTimeout(() => {
                const wrapper = btn.closest('.toggle-password-display-flag');
                if (!wrapper) return;

                const isShowing = wrapper.dataset.show === 'true';
                if (isShowing) {
                    setState('peeking');
                } else {
                    setState(document.activeElement.tagName === 'INPUT' ? 'typing' : 'idle');
                }
            }, 10);
        });
        btn.addEventListener('mousedown', e => e.preventDefault());
    });

});
