/**
 * Sky Theme - 首页特定脚本
 * 仅在首页加载的JavaScript功能
 */

// 导入首页特定样式
import './index.css';

// 注意：特效CSS (index-effects.css) 在模板中条件加载
// 参见 templates/modules/index/layout.html



/**
 * 瞬间卡片鼠标跟随发光效果
 * 为moment-card元素添加动态光晕交互效果
 */
window.handleMomentCardGlow = function(event, card) {
    // 获取卡片内的光效元素
    const glowElement = card.querySelector('.moment-glow');
    if (!glowElement) return;
    
    // 获取卡片的边界矩形信息
    const rect = card.getBoundingClientRect();
    
    // 计算鼠标在卡片内的相对位置
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 更新光效位置，使其跟随鼠标移动
    glowElement.style.left = x + 'px';
    glowElement.style.top = y + 'px';
};

/**
 * 显示瞬间卡片发光效果
 * @param {HTMLElement} card - 卡片元素
 */
window.showMomentCardGlow = function(card) {
    const glow = card.querySelector('.moment-glow');
    if (glow) {
        glow.style.opacity = '1';
    }
};

/**
 * 隐藏瞬间卡片发光效果
 * @param {HTMLElement} card - 卡片元素
 */
window.hideMomentCardGlow = function(card) {
    const glow = card.querySelector('.moment-glow');
    if (glow) {
        glow.style.opacity = '0';
    }
};



/**
 * 首页标题特效控制器
 * 使用立即执行函数避免变量名冲突
 */
(function() {
    'use strict';
    
    /**
     * 标题特效管理器
     */
    const TitleEffectsManager = {
        titleElement: null,
        decorationEffect: 'none',
        styleEffect: 'none',
        originalText: '',

        /**
         * 初始化标题特效
         */
        init() {
            // 查找标题元素
            this.titleElement = document.getElementById('main-title');
            if (!this.titleElement) {
                // console.warn('未找到标题元素 #main-title');
                return;
            }

            // 获取配置的特效类型
            this.decorationEffect = this.titleElement.dataset.decorationEffect || 'none';
            this.styleEffect = this.titleElement.dataset.styleEffect || 'none';
            this.originalText = this.titleElement.dataset.originalText || this.titleElement.textContent.trim();

         
            // 应用特效
            this.applyEffects();
        },

        /**
         * 应用所有特效
         */
        applyEffects() {
            // 应用装饰特效
            this.applyDecorationEffect();
            
            // 应用样式特效
            this.applyStyleEffect();
        },

        /**
         * 应用装饰特效
         */
        applyDecorationEffect() {
            if (this.decorationEffect === 'none') return;

            // 为粒子和星光特效准备嵌套结构
            if (this.decorationEffect === 'effect-particles' || this.decorationEffect === 'effect-starlight') {
                this.titleElement.innerHTML = `<span><span><span>${this.originalText}</span></span></span>`;
            }

            // 添加装饰特效类
            this.titleElement.classList.add(this.decorationEffect);

            // 为霓虹边缘特效设置data-text属性
            if (this.decorationEffect === 'effect-neon-edge') {
                this.titleElement.setAttribute('data-text', this.originalText);
            }
        },

        /**
         * 应用样式特效
         */
        applyStyleEffect() {
            if (this.styleEffect === 'none') return;

            // 添加样式特效类
            this.titleElement.classList.add(this.styleEffect);

            // 为特定特效设置数据属性
            if (this.styleEffect === 'effect-marker-pop' || this.styleEffect === 'effect-diagonal-split') {
                this.titleElement.setAttribute('data-text', this.originalText);
            }
        }
    };

    /**
     * 页面加载完成后初始化
     */
    document.addEventListener('DOMContentLoaded', () => {
        TitleEffectsManager.init();
    });

})();

/**
 * 文档卡片 3D 倾斜 + 光斑跟随效果
 */
window.handleDocTilt = function(event, card) {
  const inner = card.querySelector('.doc-tilt-inner');
  const glow = card.querySelector('.doc-glow-spot');
  if (!inner) return;
  
  const rect = card.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  // 计算倾斜角度（最大 15 度）
  const rotateX = ((y - centerY) / centerY) * -10;
  const rotateY = ((x - centerX) / centerX) * 10;
  
  inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
  
  // 光斑跟随
  if (glow) {
    glow.style.left = x + 'px';
    glow.style.top = y + 'px';
  }
};

window.resetDocTilt = function(card) {
  const inner = card.querySelector('.doc-tilt-inner');
  if (inner) {
    inner.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
  }
};
