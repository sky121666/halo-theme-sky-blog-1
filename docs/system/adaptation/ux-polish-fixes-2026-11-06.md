# 2026-11-06 设计自验问题补修

本批完成上次自验确认的局部问题：手机地址输入框高度、识别反馈位置、友链内部术语与重复介绍，以及空分组、无封面、文档目录、地图和 Steam 空态的占位。保持原有字体、主题配色、网格、玻璃卡片和纯图标入口；首页打字机副标题只调整未自定义时的文字颜色，保留主题色光标与显式配置色。

本批未修改插件、数据库、业务配置或正文，没有 Git 暂存、提交、推送和发布。以下是相对本批前置快照的增量，不把全部历史 WIP 算成本次修改。

## 修改与人工查看入口

本地活动主题仍是 `theme-sky-blog-3`；查看主题 1 必须携带 `preview-theme=theme-sky-blog-1`。下列入口均已包含此参数。

| 页面与入口 | 实际修改 | 桌面 / 手机验证及人工检查 |
| --- | --- | --- |
| [申请友链](http://localhost:8090/links?view=apply&preview-theme=theme-sky-blog-1) | 地址输入框在窄屏取消错误的 flex 压缩；识别结果移到地址行下；申请方式说明前移至表单开头 | 两端输入均为 40px；空地址点“识别”，错误紧邻输入且当前视口可见；编辑后清除局部错误。识别 loading/error/success 用隔离响应验证，没有请求真实外站或提交申请 |
| [友链动态](http://localhost:8090/links?view=friends&preview-theme=theme-sky-blog-1) | 删除重复内容标题、介绍和 `groupName > linkName` 内部术语；详情提示保留，未读数移入未读按钮 | 两端截图通过；公开动态和筛选控件仍显示，访客的登录能力提示保留。受保护状态写入未执行 |
| [友链列表](http://localhost:8090/links?preview-theme=theme-sky-blog-1) | “全部”不显示空分组，但保留分组导航；全空时显示统一空态 | 两端完成全部→空分组→全部，单独选择空分组时仍有提示；全空和缺失分组由回归与模板表达式夹具覆盖 |
| [分类索引](http://localhost:8090/categories?preview-theme=theme-sky-blog-1)、[分类详情](http://localhost:8090/categories/halo?preview-theme=theme-sky-blog-1) | modern 无封面卡改紧凑文字卡；保留日期、置顶、分类/标签、摘要和统计，有封面分支不变 | 两端截图与内容检查通过。无封面卡不再保留大块空图片；桌面仍采用原来的网格行布局 |
| [标签索引](http://localhost:8090/tags?preview-theme=theme-sky-blog-1)、[标签详情](http://localhost:8090/tags/ai?preview-theme=theme-sky-blog-1) | 同样是 modern 卡片的共享消费者 | 两端当前配置回归通过，但现场标签页使用极简列表；modern 分支由真实 Thymeleaf 夹具验证，未切换站点设置冒充实站分支验收 |
| [文档目录](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings?preview-theme=theme-sky-blog-1) | 只在手机收紧卡片和间距；标题允许换行并给箭头留空间 | 桌面短卡 98px、间距 24px，保持原布局；手机短卡 66px、间距 12px。临时长标题样本高 102px，无横向溢出，之后恢复 |
| [关于页](http://localhost:8090/about?preview-theme=theme-sky-blog-1) | 无 Key／地图失败时收紧预览占位；位置名称和外链各保留一次；无 JS 时仍有外链 | 两端真实无 Key 状态通过，地图动作区域为 37px。无效坐标使用生产初始化函数和临时 DOM 样本，错误提示两端可见、不生成错误外链，样本已恢复 |
| [Steam](http://localhost:8090/steam?preview-theme=theme-sky-blog-1) | 仅把“暂无最近游玩”收为紧凑横向提示，游戏库、加载、错误及分页逻辑不变 | 两端真实空态约 58px，游戏库更早出现；原分页回归 6 项通过，本批没有把上一轮翻页交互记录算成新运行结果 |
| [首页](http://localhost:8090/?preview-theme=theme-sky-blog-1) | 未配置副标题颜色的打字机文字改为白色并加轻阴影，主题色光标保留 | 两端、明暗模式检查。当前现场没有显式副标题颜色；显式颜色仍优先，不改变标题、背景、字体或纯箭头入口 |

额外回归了[友链留言视图](http://localhost:8090/links?view=board&preview-theme=theme-sky-blog-1)与[文档正文](http://localhost:8090/docs/halo-theme-sky-blog-1/theme-settings/global?preview-theme=theme-sky-blog-1)，共享布局没有新增横向溢出。

## 环境、缓存与验证结果

- Halo Pro `2.27.1`，候选主题 `2.2.41`；Node `24.21.0`、pnpm `12.6.0`。
- 当前代码指纹：`5062ff16c919aae32867e91e49d477ac40c6eccbe7c7ad57f50486791eae59c5`。
- 完整 `pnpm run build` 通过，421 项 Node 回归通过，2 项可选 Java 检查未启用；lint、format 与 `git diff --check` 通过。打包为本地候选包，没有发布。
- 模板数据 243 项通过，使用本机 Thymeleaf `3.1.5` / Spring `6.2.9`，不冒充 Halo 随包依赖组合。Links 新表达式另有 9 个隔离场景验证；实际页面也在 Halo 中打开。
- 模板缓存刷新返回 204，Page Cache 刷新返回 200；18 份服务端 CSS/JS 与磁盘哈希一致。浏览器禁缓存，并确认新版输入尺寸、文案和组件状态。
- 13 个路由/视图 × 桌面 `1440×1000`、手机视口 `390×844`，共 26 份深色记录；5 个页面补 10 份浅色记录。没有横向溢出、导航错误，深色巡检窗口没有捕获到页面脚本错误。使用 Chromium 设备模拟，不是实体手机测试。
- 独立审查发现并修复“无 Key 且坐标无效时提示被 CSS 隐藏”的本批回归。复审与桌面/手机隔离浏览器检查均通过。

初次地图等待使用可见条件，而元素仍位于未滚动的入场动画区域，导致检查器超时；只读确认元素存在后，改为等待挂载、滚动到区域、再检查可见，重新通过。没有因此关闭动画、吞掉异常或把检查器问题写成主题故障。

## 验证边界

识别成功/失败通过浏览器临时响应驱动生产逻辑；草稿由真实页面在本地生成，没有发送申请、评论或其他业务写入。错误地址的校验不发请求，编辑地址只清理识别反馈，不覆盖草稿生成结果。远端地图有效 Key 和真实外站识别不由本轮证明；地图加载/失败、取消及缓存响应顺序保留离线生命周期覆盖。长标题、无效坐标均为明确的临时 DOM 样本。

本次是主题 UI 补修，不重新核对插件最新发行，也不宣称所有插件业务或发布门禁已通过。此前版本核对、依赖与其他未覆盖项保留原记录。

## 文件与证据

本批调整 12 个运行文件、5 个现有检查/夹具，构建更新 8 个资源文件：

- Links：`src/apps/links/runtime.js`、`src/pages/links/links.css`、`templates/modules/links/content.html`。
- 地图：`src/pages/about/about.js`、`src/pages/about/about.css`、`templates/modules/about/content.html`。
- 文档：`src/pages/doc/doc.css`、`templates/modules/doc-catalog-content.html`。
- 卡片：`templates/modules/categories/list-modern.html`。
- Steam：`src/pages/steam/steam.css`、`templates/modules/steam/content.html`。
- 副标题：`src/static/css/index-subtitle-effects.css`。
- 检查：`verify-links-identification.mjs`、`verify-links-regressions.mjs`、`verify-about-location.mjs`、`verify-plugin-contracts.mjs`、`fixtures/TemplateDataChecks.java`（均在 `scripts/`）。

[结构化证据](./evidence/2026-11-06/ux-polish-fixes.json)保存精确身份、资源哈希、路由、尺寸与测试边界。临时日志及 47 张截图位于 `/tmp/sky-ui-polish-fix-20261106/`，没有把截图放入 Git。

代表截图：[申请错误提示](/tmp/sky-ui-polish-fix-20261106/apply-error-390.png)、[友链动态](/tmp/sky-ui-polish-fix-20261106/friends-390.png)、[文档目录](/tmp/sky-ui-polish-fix-20261106/doc-directory-390.png)、[关于页地图](/tmp/sky-ui-polish-fix-20261106/about-map-390.png)、[Steam 空态](/tmp/sky-ui-polish-fix-20261106/steam-empty-390.png)。

实现沿用 [Halo 官方 Thymeleaf 模板约定](https://docs.halo.run/developer-guide/theme/thymeleaf)，局部识别反馈与整表结果分离参考 [W3C 表单通知指南](https://www.w3.org/WAI/tutorials/forms/notifications/)。浏览器 TaskSpace 143 已结束；工具提示有可选更新，本次未升级。
