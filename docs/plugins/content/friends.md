# 朋友圈功能退役记录

截至 2026-09-23，主题不再适配独立 `plugin-friends`。它与 PluginLinks 的友链动态功能重叠；当前唯一的主题入口是 [友情链接](/links?view=friends) 中的“友链动态”视图。

| 项目         | 当前状态                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| 本地安装     | 最新 Console 清单中不存在；9 月 22 日快照为 `1.4.6 / DISABLED`，本轮未执行卸载                                 |
| 官方稳定版   | [1.4.6](https://www.halo.run/store/apps/app-yISsV/releases/app-release-nc8mxddx)，2026-05-22；最低 Halo 2.22.0 |
| 主题计划支持 | 不适用；从当前契约矩阵移除                                                                                     |
| 替代功能     | `PluginLinks 2.3.0` 的 `/links?view=friends`；当前本地 Halo Pro 2.26.1                                         |
| 独立路由     | `/friends` 不再由主题提供模板；旧菜单项在主题中改指向 Links                                                    |

本站保存的首页 Tab 顺序仍留有 `friends` 值，主题现在会过滤该项；主题设置中的 Tab 顺序已允许删除旧行，本轮没有改写配置数据。Friends 首页 Tab、Finder、单页模板和设置组已从当前主题代码移除。站点菜单数据库及插件状态均未由本轮修改；若其他地方保存了绝对 `/friends` 链接，请在对应内容或菜单中改为 `/links?view=friends`。

旧版 `plugin-friends 1.4.6 + PluginLinks 2.0.0` 的运行结果和后来启用失败的类加载日志，仍保留在[主运行审计](../../system/adaptation/main-halo-runtime-audit.md)与[补充验收](../../system/adaptation/plugin-runtime-followup.md)中，仅作为历史证据。它们不代表当前主题继续支持 Friends。
