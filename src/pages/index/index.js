/**
 * Sky Theme - 首页特定脚本
 */

import './index.css';
import { notifySwupPageReady, runPageInit } from '../../common/js/page-runtime.js';

/**
 * 天气联动背景效果 - 终极卡通真实感融合版 (V3)
 * 修复太阳旋转诡异问题，增强云朵可见性与动态感
 */
(function () {
  'use strict';

  // 天气引擎专属控制台拦截器
  const WTLogger = {
    info: (...args) => {
      if (window.SYS_WEATHER_DEBUG) {
        console.log('[BG]', ...args);
      }
    },
    warn: (...args) => console.warn('[BG]', ...args)
  };

  const CACHE_KEY = 'sky_weather_cache_v13';

  // SVG 资源库 - 纯 SVG 字符串
  const SVGS = {
    // 太阳主体 (脸部) - 不旋转
    sunBody: `<svg viewBox="0 0 200 200" class="w-full h-full fill-current text-yellow-400">
                <circle cx="100" cy="100" r="60" />
                <g class="sun-face" fill="#cc9900">
                  <circle cx="75" cy="90" r="8" />
                  <circle cx="125" cy="90" r="8" />
                  <path d="M70 120 Q100 145 130 120" stroke="#cc9900" stroke-width="6" fill="none" stroke-linecap="round" />
                  <ellipse cx="60" cy="105" rx="6" ry="3" fill="#ff7e7e" opacity="0.6" />
                  <ellipse cx="140" cy="105" rx="6" ry="3" fill="#ff7e7e" opacity="0.6" />
                </g>
              </svg>`,
    // 太阳光芒 - 独立旋转
    sunRays: `<svg viewBox="0 0 200 200" class="w-full h-full stroke-current text-yellow-400">
                <g stroke-width="12" stroke-linecap="round">
                  <path d="M100 20 L100 0 M100 180 L100 200 M20 100 L0 100 M180 100 L200 100 M43 43 L29 29 M157 157 L171 171 M43 157 L29 171 M157 43 L171 29" />
                </g>
              </svg>`,
    // 月亮
    moon: `<svg viewBox="0 0 200 200" class="w-full h-full fill-current text-yellow-100">
             <path d="M100 15 A 85 85 0 1 1 100 185 A 65 65 0 1 0 100 15 Z" />
             <circle cx="80" cy="80" r="12" fill="rgba(0,0,0,0.1)" />
             <circle cx="120" cy="120" r="8" fill="rgba(0,0,0,0.1)" />
             <circle cx="90" cy="140" r="5" fill="rgba(0,0,0,0.1)" />
           </svg>`,
    // 云朵 (卡通造型)
    cloud: `<svg viewBox="0 0 25 25" class="w-full h-full fill-current">
              <path d="M19.5,10 C19.5,6.96 17.04,4.5 14,4.5 C11.6,4.5 9.55,6.03 8.8,8.2 C8.54,8.13 8.27,8.1 8,8.1 C5.24,8.1 3,10.34 3,13.1 C3,15.86 5.24,18.1 8,18.1 L19.5,18.1 C21.98,18.1 24,16.08 24,14 C24,11.92 21.98,10 19.5,10 Z" />
            </svg>`,
    // 雨滴
    rain: `<svg viewBox="0 0 20 30" class="w-full h-full fill-current text-blue-200">
             <path d="M10 0 Q4 10 4 20 A 6 6 0 1 0 16 20 Q16 10 10 0 Z" />
           </svg>`,
    // 闪电
    lightning: `<svg viewBox="0 0 50 100" class="w-full h-full fill-current text-yellow-300">
                  <polygon points="25,0 0,60 20,60 10,100 45,35 25,35" />
                </svg>`,
    // 波浪雾
    fog: `<svg viewBox="0 0 1000 100" class="w-full h-full fill-current text-gray-200" preserveAspectRatio="none">
            <path d="M0,50 Q250,0 500,50 T1000,50 L1000,100 L0,100 Z" opacity="0.5"/>
            <path d="M0,70 Q250,20 500,70 T1000,70 L1000,100 L0,100 Z" opacity="0.3"/>
          </svg>`
  };

  let currentState = {
    type: 'sunny',
    temp: 20
  };

  let container = null;
  let effectLayer = null;

  function init() {
    WTLogger.info('init() 开始执行');
    container = document.getElementById('weather-effect-root');
    if (!container) {
      WTLogger.info('weather-effect-root 元素不存在，背景类型未启用天气联动');
      return;
    }
    WTLogger.info('✅ weather-effect-root 找到');

    effectLayer = container.querySelector('.weather-effect-layer');
    if (!effectLayer) {
      WTLogger.warn('❌ .weather-effect-layer 不存在');
      return;
    }
    WTLogger.info('✅ effectLayer 找到');

    // 第一阶段：立即渲染（使用缓存或默认晴天）
    loadWeatherData();
    WTLogger.info('初始渲染，currentState.type =', currentState.type);
    renderEffect();
    setupScrollListener();
    // 存储具名监听器引用（供 cleanup 使用）
    let _weatherHandler = null;
    let _scrollHandler = null;
    let _mousemoveHandler = null;

    // 第二阶段：监听天气数据更新事件（来自天气卡片的真实数据）
    _weatherHandler = (event) => {
      const newBg = event.detail?.weatherBg;
      const rawData = event.detail?.rawData;
      WTLogger.info('收到 sky-weather-updated 事件，weatherBg =', newBg, 'rawData =', rawData);

      if (!newBg) return;

      let normalizedBg = newBg;
      if (newBg === 'rain') normalizedBg = 'rainy';
      if (newBg === 'snow') normalizedBg = 'snowy';
      if (newBg === 'fog') normalizedBg = 'foggy';

      WTLogger.info('切换背景 →', normalizedBg);
      currentState.type = normalizedBg;

      if (rawData) applyPhysicsVariables(rawData);
      renderEffect();
    };
    window.addEventListener('sky-weather-updated', _weatherHandler);
    WTLogger.info('事件监听器已注册，init() 完成');

    // 注册 swup cleanup（离开首页时调用）
    window.__pageCleanup = () => {
      WTLogger.info('执行 index.js cleanup');
      if (_weatherHandler) window.removeEventListener('sky-weather-updated', _weatherHandler);
      if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);
      if (_mousemoveHandler) document.removeEventListener('mousemove', _mousemoveHandler);
      if (window.__indexScrollHandler) {
        window.removeEventListener('scroll', window.__indexScrollHandler);
        window.__indexScrollHandler = null;
      }
      // 清理天气场景内部 setInterval/RAF
      if (effectLayer?.lastElementChild?._cleanup) {
        effectLayer.lastElementChild._cleanup();
      }
      _weatherHandler = _scrollHandler = _mousemoveHandler = null;
    };
  }

  function loadWeatherData() {
    WTLogger.info('loadWeatherData() 开始，读取 key:', CACHE_KEY);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      WTLogger.info('localStorage 原始值:', cached ? '有数据' : '无数据（null）');

      if (cached) {
        const data = JSON.parse(cached);
        const bg = data.weatherBg;
        WTLogger.info('缓存中的 weatherBg:', bg, '| location:', data.location);

        if (bg) {
          let normalizedBg = bg;
          if (bg === 'rain') normalizedBg = 'rainy';
          if (bg === 'snow') normalizedBg = 'snowy';
          if (bg === 'fog') normalizedBg = 'foggy';

          currentState.type = normalizedBg;
          WTLogger.info('✅ 从缓存加载天气成功，type =', currentState.type);

          if (data.weather) {
            applyPhysicsVariables(data.weather);
          } else {
            // 缺失真实数据时的默认物理表现
            applyPhysicsVariables({ temp: 20, humidity: 50, wind: '0 km/h' });
          }

          return;
        }
      }
    } catch (e) {
      WTLogger.warn('localStorage 读取失败:', e);
    }

    const hour = new Date().getHours();
    currentState.type = (hour >= 18 || hour < 6) ? 'night-clear' : 'sunny';
    applyPhysicsVariables({ temp: 20, humidity: 50, wind: '0 km/h' });
    console.log('[BG] ⚠️ 无缓存，使用默认天气:', currentState.type);
  }

  /**
   * 核心物理引擎桥接：将真实气象数据解析为全局 CSS 变量挂载到容器树
   */
  function applyPhysicsVariables(rawData) {
    if (!container || !rawData) return;
    const weatherEffect = container.querySelector('.weather-effect');
    if (!weatherEffect) return;

    // 1. 获取温度 (Temp)，主要用于控制动画“生命力”表现(寒冷冻僵)
    let temp = parseFloat(rawData.temp);
    if (isNaN(temp)) temp = 20;
    currentState.temp = temp;

    // 计算生命力活跃系数 (0.1 ~ 1.0)
    // 假设 20度为正常 1.0； < 5度逐渐冻僵
    let lifeScale = 1.0;
    if (temp < 10) {
      lifeScale = Math.max(0.1, 1.0 - (10 - temp) * 0.1);
    }
    weatherEffect.style.setProperty('--life-scale', lifeScale.toFixed(2));

    // 2. 解析风 (Wind Speed & Direction) -> Vector X 漂移方向和力道
    // 通常 API 返回 "XX km/h"
    let windSpeed = 0;
    if (typeof rawData.wind === 'string') {
      const match = rawData.wind.match(/(\d+(\.\d+)?)/);
      if (match) windSpeed = parseFloat(match[1]);
    } else if (typeof rawData.wind_speed === 'number') {
      windSpeed = rawData.wind_speed;
    }

    // 提取风向 (0-360) 0 是北风向南吹，90 是东风向西吹 (X轴负方向)
    let windDir = parseFloat(rawData.wind_direction) || 0;

    // 风力映射：0是微风，20km/h是中风，50km/h是狂风
    // x = 1.0 (正常速度), x = 0.2 (几乎停止), x = 4.0 (四倍速)
    let windForce = Math.max(0.1, windSpeed / 10);
    // 限制风速在极端情况下不要把动画吹穿帮
    windForce = Math.min(windForce, 4.0);

    // 判定左右方向（X轴正方向为向右吹）。
    // 在气象学上，风向角是从北(0)经东(90)南(180)西(270)。
    // 即：角在 0~180 (偏东风)，其实是往西吹，也就是向左（X轴负）。
    // 角在 180~360 (偏西风)，是往东吹，也就是向右（X轴正）。
    let vectorDirectionX = (windDir > 180 && windDir < 360) ? 1 : -1;
    // 如果无风，默认向左慢飘（-1）
    if (windSpeed === 0) vectorDirectionX = -1;

    // x 轴向真正受到左右干预的风力
    let windForceX = windForce * vectorDirectionX;

    // 把纯风力标量和风偏移量X存入全局供后续 JS 使用
    currentState.windForce = windForce;
    currentState.windForceX = windForceX;

    // 注入 CSS
    weatherEffect.style.setProperty('--wind-force', windForce.toFixed(2));
    weatherEffect.style.setProperty('--wind-force-x', windForceX.toFixed(2));
  }


  function renderEffect() {
    if (!effectLayer) return;

    // 清理旧场景（如果有清理函数）
    if (effectLayer.lastElementChild && typeof effectLayer.lastElementChild._cleanup === 'function') {
      effectLayer.lastElementChild._cleanup();
    }

    effectLayer.innerHTML = '';

    const weatherEffect = container.querySelector('.weather-effect');
    if (weatherEffect) {
      weatherEffect.className = 'weather-effect weather-' + currentState.type;
      weatherEffect.style.setProperty('--wind-force', 1.0); // 默认微风
    }

    createAtmosphere();

    switch (currentState.type) {
      case 'sunny': renderSunny(); break;
      case 'cloudy': renderCloudy(false); break;
      case 'night-clear': renderNightClear(); break;
      case 'night-cloudy': renderCloudy(true); break;
      case 'foggy': renderFoggy(); break;
      case 'rainy': renderRainy(); break;
      case 'snowy': renderSnowy(); break;
      case 'stormy': renderStormy(); break;
    }

    const bottomFade = document.createElement('div');
    bottomFade.className = 'bottom-fade';
    effectLayer.appendChild(bottomFade);
  }

  function createAtmosphere() {
    const atmosphere = document.createElement('div');
    atmosphere.className = 'atmosphere-glow';
    effectLayer.appendChild(atmosphere);
  }

  // ☀️ 晴天：阳光草坪 (Stylized Lawn)
  function renderSunny() {
    buildDaytimeMeadow();

    // 5. 太阳 (特有)
    const sunContainer = document.createElement('div');
    sunContainer.className = 'sun-container';

    const rays = document.createElement('div');
    rays.className = 'sun-rays';
    rays.innerHTML = SVGS.sunRays;
    sunContainer.appendChild(rays);

    const body = document.createElement('div');
    body.className = 'sun-body';
    body.innerHTML = SVGS.sunBody;
    sunContainer.appendChild(body);

    const glow = document.createElement('div');
    glow.className = 'sun-glow-outer';
    sunContainer.appendChild(glow);

    effectLayer.appendChild(sunContainer);

    // 6. 漂浮光斑 (通常伴随强阳光)
    for (let i = 0; i < 15; i++) {
      createBokeh();
    }
  }

  // 构建通用的白天草坪场景 (供 Sunny 和 Cloudy 复用)
  function buildDaytimeMeadow() {
    // 1. 构建场景容器
    const sceneContainer = document.createElement('div');
    sceneContainer.className = 'sunny-scene-container';

    // 2. 草坪地基
    const lawn = document.createElement('div');
    lawn.className = 'sunny-lawn';
    sceneContainer.appendChild(lawn);

    // 3. 密集装饰性草叶 (前景)
    for (let i = 0; i < 40; i++) {
      const blade = document.createElement('div');
      blade.className = 'sunny-grass-blade';
      blade.style.left = `${Math.random() * 100}%`;
      blade.style.height = `${15 + Math.random() * 25}px`;
      blade.style.animationDelay = `${-Math.random() * 4}s`;
      lawn.appendChild(blade);
    }

    // 4. 精致花朵 (多种类混合)
    const flowerTypes = ['flower-type-tulip', 'flower-type-daisy', 'flower-type-sunflower'];
    for (let i = 0; i < 12; i++) {
      const flower = document.createElement('div');
      const typeClass = flowerTypes[Math.floor(Math.random() * flowerTypes.length)];
      flower.className = `sunny-flower-detailed ${typeClass}`;

      // 花冠
      const head = document.createElement('div');
      head.className = 'flower-head';
      flower.appendChild(head);

      // 随机位置（草坪上）
      flower.style.left = `${5 + Math.random() * 90}%`;
      flower.style.height = `${40 + Math.random() * 40}px`; // 随机茎高
      flower.style.animationDelay = `${-Math.random() * 5}s`;
      flower.style.transform = `scale(${0.7 + Math.random() * 0.5})`; // 随机大小

      lawn.appendChild(flower);
    }

    effectLayer.appendChild(sceneContainer);
  }

  function createBokeh() {
    const bokeh = document.createElement('div');
    bokeh.className = 'bokeh-particle';
    const size = 20 + Math.random() * 60;
    bokeh.style.cssText = `
      width: ${size}px; height: ${size}px;
      left: ${Math.random() * 100}%; top: ${Math.random() * 80}%;
      opacity: ${0.1 + Math.random() * 0.2};
      animation-duration: ${15 + Math.random() * 20}s;
      animation-delay: ${-Math.random() * 20}s;
    `;
    effectLayer.appendChild(bokeh);
  }

  // ☁️ 多云：使用 SVG 云朵，解决不可见问题
  function renderCloudy(isNight) {
    if (isNight) {
      // 夜晚多云：先渲染诡秘森林场景
      renderNightSceneBase();
      renderStars(30, true);
      renderMoon(true);
    } else {
      buildDaytimeMeadow(); // 白天多云：仅渲染通用的草地前景，不渲染太阳
    }

    // 生成卡通 SVG 云朵
    const cloudCount = isNight ? 5 : 8;
    for (let i = 0; i < cloudCount; i++) {
      createCartoonCloud(isNight);
    }
  }

  function createCartoonCloud(isNight) {
    const cloud = document.createElement('div');
    cloud.className = 'cloud-cartoon ' + (isNight ? 'night' : 'day');
    cloud.innerHTML = SVGS.cloud;

    // 缩放范围 (0.6x ~ 1.8x)
    const scale = 0.6 + Math.random() * 1.2;
    // 垂直分布范围
    const top = 5 + Math.random() * 50;

    // 物理映射: 风大则时间短，飘得快
    const windForce = currentState.windForce || 1.0;
    // 原本的时长：大云慢，小云快 (60~130s)
    let baseDuration = 60 + (1.8 - scale) * 40 + Math.random() * 30;
    // 受到风力影响
    const duration = baseDuration / windForce;

    // 透明度
    const opacity = isNight ? (0.3 + Math.random() * 0.2) : (0.85 + Math.random() * 0.15);
    // 随机起始偏移，让云朵交错出现
    const startOffset = Math.random() * 300;

    cloud.style.cssText = `
      top: ${top}%;
      left: 0;
      --cloud-scale: ${scale};
      --cloud-start-offset: ${startOffset}px;
      opacity: ${opacity};
      animation-duration: ${duration}s;
      animation-delay: ${-Math.random() * duration}s;
      z-index: ${20 + Math.floor(scale * 10)};
      color: ${isNight ? '#a0a4b8' : '#ffffff'};
    `;
    effectLayer.appendChild(cloud);
  }

  // 🌙 晴朗夜晚：狼堡诡秘森林 (Spooky Forest)
  function renderNightClear() {
    renderNightSceneBase();
    // 7. 星星与月亮 (保留)
    renderStars(50, true);
    renderMoon(false); // false 表示不加云遮挡
  }

  // 提取夜晚基础场景 (山、树、眼、鬼火)
  function renderNightSceneBase() {
    // 1. 场景容器
    const sceneContainer = document.createElement('div');
    sceneContainer.className = 'night-scene-container';
    sceneContainer.id = 'night-scene';

    // 2. 恐怖远山 (Wolf Castle Vibes)
    const mountains = ['sm-1', 'sm-2'];
    mountains.forEach(mClass => {
      const el = document.createElement('div');
      el.className = `spooky-mountain ${mClass}`;
      sceneContainer.appendChild(el);
    });

    // 3. 扭曲怪树
    for (let i = 0; i < 6; i++) {
      const tree = document.createElement('div');
      tree.className = 'spooky-tree';
      const height = 180 + Math.random() * 100;
      const width = height * 0.6;
      tree.style.cssText = `
            left: ${-10 + Math.random() * 110}%; // 覆盖稍宽范围
            width: ${width}px;
            height: ${height}px;
            z-index: ${2 + Math.random() * 2};
            transform: scaleX(${Math.random() > 0.5 ? 1 : -1}); // 随机翻转
        `;
      sceneContainer.appendChild(tree);
    }

    effectLayer.appendChild(sceneContainer);

    // 4. 黑暗中眨动的眼睛
    const createEyes = () => {
      if (!document.getElementById('night-scene')) return;

      const eyes = document.createElement('div');
      // 偶尔出现黄色眼睛
      const isYellow = Math.random() > 0.7;
      eyes.className = `spooky-eye-pair ${isYellow ? 'eyes-yellow' : ''}`;

      // 随机出现在树丛高度
      eyes.style.left = `${Math.random() * 100}%`;
      eyes.style.bottom = `${20 + Math.random() * 100}px`;
      eyes.style.animationDelay = `${Math.random() * 2}s`;

      sceneContainer.appendChild(eyes);

      // 眨眼几次后消失
      setTimeout(() => eyes.remove(), 4000);
    };

    const eyeInterval = setInterval(createEyes, 2000);

    // 5. 幽灵鬼火
    const createGhostFirefly = () => {
      if (!document.getElementById('night-scene')) return;

      const fly = document.createElement('div');
      fly.className = 'ghost-firefly';
      fly.style.left = `${Math.random() * 100}%`;
      fly.style.bottom = `${Math.random() * 50}%`;

      sceneContainer.appendChild(fly);

      // 动画更长一点
      setTimeout(() => fly.remove(), 8000);
    };

    const fireflyInterval = setInterval(createGhostFirefly, 1500);

    // 6. 清理函数
    sceneContainer._cleanup = () => {
      clearInterval(eyeInterval);
      clearInterval(fireflyInterval);
    };
  }
  function renderMoon(isCloudy) {
    const moonContainer = document.createElement('div');
    moonContainer.className = 'moon-container';
    if (isCloudy) moonContainer.classList.add('cloudy-moon');

    const moonIcon = document.createElement('div');
    moonIcon.className = 'moon-icon';
    moonIcon.innerHTML = SVGS.moon;
    moonContainer.appendChild(moonIcon);

    const glow = document.createElement('div');
    glow.className = 'moon-glow';
    moonContainer.appendChild(glow);

    effectLayer.appendChild(moonContainer);
  }

  function renderStars(count, isDim = false) {
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      if (isDim) star.classList.add('dim');

      const size = 1 + Math.random() * 3;
      star.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${Math.random() * 100}%; top: ${Math.random() * 60}%;
        animation-duration: ${2 + Math.random() * 3}s;
        animation-delay: ${-Math.random() * 3}s;
      `;
      effectLayer.appendChild(star);
    }
  }

  // 🌫️ 雾天：清晨迷雾场景 (Misty Morning)
  function renderFoggy() {
    const sceneContainer = document.createElement('div');
    sceneContainer.className = 'mist-scene-container';
    sceneContainer.id = 'mist-scene';

    // 1. 太阳
    const sun = document.createElement('div');
    sun.className = 'mist-sun';
    sceneContainer.appendChild(sun);

    // 2. 远景山脉
    const mountains = ['m-1', 'm-2', 'm-3'];
    mountains.forEach(mClass => {
      const el = document.createElement('div');
      el.className = `mist-mountain ${mClass}`;
      sceneContainer.appendChild(el);
    });

    // 3. 树木
    const trees = ['t-1', 't-2', 't-3', 't-4'];
    trees.forEach(tClass => {
      const el = document.createElement('div');
      el.className = `mist-tree ${tClass}`;
      sceneContainer.appendChild(el);
    });

    // 4. 流动雾气层 (SVG Background)
    const layers = ['mist-layer-2', 'mist-layer-1', 'mist-layer-3']; // 顺序决定层级
    const layerEls = [];
    layers.forEach(lClass => {
      const el = document.createElement('div');
      el.className = `mist-fog-layer ${lClass}`;
      sceneContainer.appendChild(el);
      layerEls.push(el);
    });

    effectLayer.appendChild(sceneContainer);

    // 5. 动态生成漂浮雾团 (JS)
    const createFogPuff = () => {
      if (!document.getElementById('mist-scene')) return; // 元素被移除停止生成

      const puff = document.createElement('div');
      puff.className = 'mist-fog-puff';

      const size = Math.random() * 180 + 60;
      const topPos = Math.random() * 35 + 55; // 底部区域
      const duration = Math.random() * 10 + 12;
      const moveDistance = (Math.random() - 0.5) * 400;

      puff.style.cssText = `
        width: ${size}px; height: ${size}px;
        top: ${topPos}%; left: ${Math.random() * 100}%;
      `;

      // 使用 Web Animations API
      const animation = puff.animate([
        { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
        { opacity: 0.5, offset: 0.2 },
        { opacity: 0.5, offset: 0.8 },
        { transform: `translate(${moveDistance}px, -80px) scale(1.8)`, opacity: 0 }
      ], {
        duration: duration * 1000,
        easing: 'linear',
        fill: 'forwards'
      });

      sceneContainer.appendChild(puff);

      animation.onfinish = () => puff.remove();
    };

    // 启动定时器
    const puffInterval = setInterval(createFogPuff, 600);

    // 6. 鼠标视差交互
    const handleParallax = (e) => {
      const x = e.clientX / window.innerWidth;
      // 简单视差：移动雾层
      if (layerEls[1]) layerEls[1].style.transform = `translateX(${-x * 50}px)`; // layer-1
      if (layerEls[0]) layerEls[0].style.transform = `translateX(${x * 20}px) scaleX(-1)`; // layer-2
      if (layerEls[2]) layerEls[2].style.transform = `translateX(${-x * 90}px)`; // layer-3
    };
    document.addEventListener('mousemove', handleParallax);

    // 清理函数绑定到容器上，方便清除时调用
    sceneContainer._cleanup = () => {
      clearInterval(puffInterval);
      document.removeEventListener('mousemove', handleParallax);
    };
  }

  // 🌧️ 雨天/雷暴：Canvas 系统
  function renderRainy() {
    renderRainSystem(false);
  }

  function renderStormy() {
    renderRainSystem(true);
  }

  function renderRainSystem(isStormy) {
    // 先渲染深色云层
    for (let i = 0; i < (isStormy ? 8 : 5); i++) {
      createCartoonCloud(true, i);
    }

    // --- 响应式配置 ---
    const width = window.innerWidth;
    // 大幅降低雨滴密度：每 25px 一滴 (Rainy) 或 10px 一滴 (Stormy)
    // 之前是 width/12 和 width/4
    const baseCount = isStormy ? width / 10 : width / 25;
    const count = Math.min(isStormy ? 150 : 60, Math.max(20, Math.floor(baseCount)));

    const windForce = currentState.windForce || 1.0;
    const windForceX = currentState.windForceX || -1.0; // 带有方向的X轴位移

    const config = isStormy
      ? { count: count, speedBase: 14 * Math.max(1, windForce * 0.8), wind: 6 * windForceX, thickness: 3, color: 'rgba(130, 180, 255, 0.8)' }
      : { count: count, speedBase: 8 * Math.max(1, Math.sqrt(windForce)), wind: 2 * windForceX, thickness: 2, color: 'rgba(174, 217, 255, 0.6)' };

    // 创建容器
    const rainCanvas = document.createElement('canvas');
    rainCanvas.className = 'rain-canvas';
    rainCanvas.id = 'rain-canvas';
    effectLayer.appendChild(rainCanvas);

    const lightningCanvas = document.createElement('canvas');
    lightningCanvas.className = 'lightning-canvas';
    lightningCanvas.id = 'lightning-canvas';
    effectLayer.appendChild(lightningCanvas);

    const flashOverlay = document.createElement('div');
    flashOverlay.className = 'flash-overlay';
    flashOverlay.id = 'flash-overlay';
    effectLayer.appendChild(flashOverlay);

    // --- 地面组件生成：卡通雨中草原 (Cartoon Rainy Meadow) ---
    const groundProps = document.createElement('div');
    groundProps.className = 'rain-ground-props';

    // 构建草原场景
    buildCartoonMeadowScene(groundProps);
    effectLayer.appendChild(groundProps);

    const ctxRain = rainCanvas.getContext('2d');
    const ctxLight = lightningCanvas.getContext('2d');
    let w, h;
    let drops = [];
    let splashes = [];
    let animationId = null;
    let nextLightningTime = 0;

    // 初始化 Canvas 尺寸
    function resize() {
      w = rainCanvas.width = lightningCanvas.width = effectLayer.offsetWidth || window.innerWidth;
      h = rainCanvas.height = lightningCanvas.height = effectLayer.offsetHeight || window.innerHeight;
      // Resize 后需要重新生成雨滴位置防止溢出或空缺
      drops.forEach(d => { if (d.x > w) d.x = Math.random() * w; });
    }
    resize();

    // 防抖 Resize
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resize();
        // 如果宽度变化很大，可能需要重启系统以调整雨滴数量，这里简单处理只调尺寸
      }, 200);
    };
    window.addEventListener('resize', handleResize);

    // 雨滴类
    class Drop {
      constructor(randomY = false) {
        this.x = Math.random() * w;
        this.y = randomY ? Math.random() * h : -50;
        this.z = Math.random(); // 视差层级
        this.speed = config.speedBase * (1 + this.z) + Math.random() * 2;
        this.len = 10 + this.z * 15;
        this.thick = config.thickness * (0.5 + this.z * 0.5);
        this.vx = config.wind * (1 + (1 - this.z));
      }

      update() {
        this.x += this.vx;
        this.y += this.speed;
        if (this.y > h - 40) { // 稍微抬高一点作为“地面”
          if (Math.random() > 0.85) splashes.push(new Splash(this.x, h - 40));
          this.reset();
        }
        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
      }

      reset() {
        this.x = Math.random() * w;
        this.y = -50;
        this.z = Math.random();
        this.speed = config.speedBase * (1 + this.z) + Math.random() * 2;
      }

      draw() {
        ctxRain.beginPath();
        ctxRain.moveTo(this.x, this.y);
        ctxRain.lineTo(this.x - this.vx * 2, this.y - this.len);
        ctxRain.strokeStyle = config.color;
        ctxRain.lineWidth = this.thick;
        ctxRain.lineCap = 'round';
        ctxRain.stroke();
      }
    }

    // 水花类
    class Splash {
      constructor(x, y) {
        this.x = x; this.y = y; this.life = 8;
        this.particles = [];
        for (let i = 0; i < 3; i++) {
          this.particles.push({ vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3, px: 0, py: 0 });
        }
      }
      update() {
        this.life--;
        this.particles.forEach(p => { p.px += p.vx; p.py += p.vy; p.vy += 0.3; });
      }
      draw() {
        const alpha = this.life / 8;
        ctxRain.fillStyle = `rgba(200, 230, 255, ${alpha})`;
        this.particles.forEach(p => {
          ctxRain.beginPath();
          ctxRain.arc(this.x + p.px, this.y + p.py, 2, 0, Math.PI * 2);
          ctxRain.fill();
        });
      }
    }

    // 初始化雨滴
    for (let i = 0; i < config.count; i++) drops.push(new Drop(true));

    // 绘制闪电
    function drawLightningBolt() {
      ctxLight.clearRect(0, 0, w, h);
      ctxLight.beginPath();
      const startX = w * 0.2 + Math.random() * w * 0.6;
      let x = startX, y = 0;
      ctxLight.moveTo(x, y);

      while (y < h * 0.7) {
        const dx = (Math.random() - 0.5) * 80;
        const dy = 20 + Math.random() * 40;
        x += dx; y += dy;
        ctxLight.lineTo(x, y);
      }

      ctxLight.strokeStyle = '#fff';
      ctxLight.shadowBlur = 25;
      ctxLight.shadowColor = '#f1c40f';
      ctxLight.lineWidth = 3;
      ctxLight.stroke();
      ctxLight.shadowBlur = 0;

      setTimeout(() => ctxLight.clearRect(0, 0, w, h), 120);
    }

    // 触发闪电
    function triggerLightning() {
      // 狂风暴雨（风力>2）的猛烈雷击
      const isFierce = (currentState.windForce > 2.0);

      flashOverlay.style.opacity = isFierce ? '0.9' : '0.6';
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 80);
      setTimeout(() => { flashOverlay.style.opacity = isFierce ? '0.4' : '0.2'; }, 120);
      setTimeout(() => { flashOverlay.style.opacity = '0'; }, 200);

      // 只有猛烈暴风雪才引起屏幕物理抖动
      if (isFierce) {
        container.classList.add('weather-shake');
        setTimeout(() => container.classList.remove('weather-shake'), 400);
      }

      drawLightningBolt();
    }

    // 主循环
    function loop() {
      if (!document.getElementById('rain-canvas')) return;

      ctxRain.clearRect(0, 0, w, h);
      drops.forEach(d => { d.update(); d.draw(); });

      for (let i = splashes.length - 1; i >= 0; i--) {
        splashes[i].update();
        splashes[i].draw();
        if (splashes[i].life <= 0) splashes.splice(i, 1);
      }

      if (isStormy) {
        const now = Date.now();
        if (now > nextLightningTime) {
          triggerLightning();
          // 风速越大，闪电越频繁 (2500 -> 1000 基础间隔缩短)
          const baseInterval = Math.max(800, 2000 - (currentState.windForce - 1) * 400);
          nextLightningTime = now + baseInterval + Math.random() * 3000;
        }
      }

      animationId = requestAnimationFrame(loop);
    }

    nextLightningTime = Date.now() + 1000;
    loop();

    // 清理函数
    const cleanupContainer = document.createElement('div');
    cleanupContainer.id = 'rain-system';
    cleanupContainer.style.display = 'none';
    cleanupContainer._cleanup = () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize); // 移除正确的 listener
    };
    // ... (rest of renderRainSystem)
    effectLayer.appendChild(cleanupContainer);
  }

  // 🏡 构建扁平雨中场景 (Flat Rain Scene)
  function buildCartoonMeadowScene(container) {
    // 0. 草原背景容器
    const bgContainer = document.createElement('div');
    bgContainer.className = 'rain-meadow-container';

    // 生成3层山丘
    ['rm-hill-2', 'rm-hill-1', 'rm-hill-3'].forEach(cls => {
      const hill = document.createElement('div');
      hill.className = `rain-meadow-hill ${cls}`;
      bgContainer.appendChild(hill);
    });
    container.appendChild(bgContainer);

    // 1. 积水潭 (放在草原上)
    const puddle = document.createElement('div');
    puddle.className = 'rain-puddle';
    puddle.style.cssText = 'width: 80px; height: 25px; left: 25%; bottom: 15px;';
    container.appendChild(puddle);

    // 2. 扁平小路
    const path = document.createElement('div');
    path.className = 'flat-rain-path';
    container.appendChild(path);

    // 3. 扁平小屋
    const house = document.createElement('div');
    house.className = 'flat-rain-house';
    house.innerHTML = `
          <div class="house-chimney"></div>
          <div class="house-window"></div>
      `;
    container.appendChild(house);

    // 4. 扁平路灯
    const lamp = document.createElement('div');
    lamp.className = 'flat-rain-lamp';
    lamp.innerHTML = `
          <div class="lamp-head"></div>
          <div class="lamp-light"></div> 
      `;
    container.appendChild(lamp);
  }

  // ❄️ 雪天：卡通冬日雪景 (Cartoon Winter Scene)
  function renderSnowy() {
    const sceneContainer = document.createElement('div');
    sceneContainer.className = 'snow-scene-container';

    // 1. 远景雪山
    const hills = ['sh-1', 'sh-2'];
    hills.forEach(hClass => {
      const el = document.createElement('div');
      el.className = `snow-hill ${hClass}`;
      sceneContainer.appendChild(el);
    });

    // 2. 雪地地面
    const ground = document.createElement('div');
    ground.className = 'snow-ground';
    sceneContainer.appendChild(ground);

    // 3. 雪屋 (Igloo)
    const igloo = document.createElement('div');
    igloo.className = 'snow-igloo';
    const entrance = document.createElement('div');
    entrance.className = 'snow-igloo-entrance';
    igloo.appendChild(entrance);
    sceneContainer.appendChild(igloo);

    // 4. 积雪松树
    const pines = ['sp-1', 'sp-2', 'sp-3'];
    pines.forEach(pClass => {
      const el = document.createElement('div');
      el.className = `snow-pine ${pClass}`;
      sceneContainer.appendChild(el);
    });

    effectLayer.appendChild(sceneContainer);

    // 5. 飘雪粒子
    const snowContainer = document.createElement('div');
    snowContainer.className = 'snow-container';

    for (let i = 0; i < 80; i++) {
      const flake = document.createElement('div');
      flake.className = 'snow-flake-svg';

      const isLarge = Math.random() < 0.3;
      const size = isLarge ? (12 + Math.random() * 10) : (4 + Math.random() * 8);

      const windForce = currentState.windForce || 1.0;
      const windForceX = currentState.windForceX || -1.0;
      const baseDuration = isLarge ? (6 + Math.random() * 4) : (3 + Math.random() * 5);
      // 风大雪飘得快，但不像云那么夸张，用 sqrt 平稳曲线
      const duration = baseDuration / Math.max(0.5, Math.sqrt(windForce));

      if (Math.random() > 0.4) {
        flake.innerHTML = `<svg viewBox="0 0 24 24" class="w-full h-full fill-current"><circle cx="12" cy="12" r="8"/></svg>`;
      } else {
        flake.innerHTML = `<svg viewBox="0 0 24 24" class="w-full h-full stroke-current" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>`;
      }

      // 动态风偏 (原固定为 20), 引入方向矢量 windForceX
      const windOffset = -20 * windForceX;

      flake.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${size}px; height: ${size}px;
        opacity: ${isLarge ? 0.95 : (0.6 + Math.random() * 0.3)};
        --wind-offset: ${windOffset}px;
        animation-duration: ${duration}s;
        animation-delay: ${-Math.random() * duration}s;
      `;
      snowContainer.appendChild(flake);
    }
    effectLayer.appendChild(snowContainer);
  }


  function setupScrollListener() {
    const scrollMask = container.querySelector('.scroll-mask');
    if (!scrollMask) return;
    let ticking = false;
    // 具名函数，便于 cleanup 时移除
    window.__indexScrollHandler = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          scrollMask.style.opacity = window.scrollY > 50 ? '0.3' : '0';
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', window.__indexScrollHandler, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
    });
  } else {
    init();
  }
})();

/**
 * 瞬间卡片鼠标跟随发光效果
 * 为moment-card元素添加动态光晕交互效果
 */
window.handleMomentCardGlow = function (event, card) {
  if (!event) return;
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
window.showMomentCardGlow = function (card) {
  const glow = card.querySelector('.moment-glow');
  if (glow) {
    glow.style.opacity = '1';
  }
};

/**
 * 隐藏瞬间卡片发光效果
 * @param {HTMLElement} card - 卡片元素
 */
window.hideMomentCardGlow = function (card) {
  const glow = card.querySelector('.moment-glow');
  if (glow) {
    glow.style.opacity = '0';
  }
};

/**
 * 首页标题特效控制器
 * 使用立即执行函数避免变量名冲突
 */
(function () {
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
  runPageInit(() => {
    TitleEffectsManager.init();
  });

})();

notifySwupPageReady();
