# Equipment 评论来源核查（2026-10-27）

结论：**Halo v2.27.1 官方核心没有通用 `Plugin` CommentSubject provider；Equipment 1.1.1 也未实现自己的 provider。** 因此不满足“只是 ID 拼错即可修复”的前提。本次未修改装备模板、未删除评论功能、未增加把无依据契约固化下来的断言。

## 官方证据

1. Halo v2.27.1 [extension-definitions.yaml](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/resources/extensions/extension-definitions.yaml) 对 `comment-subject` 只注册 `post-comment-subject`（`PostCommentSubject`）和 `single-page-comment-subject`（`SinglePageCommentSubject`）。固定 tag 的完整 tree `truncated=false` 与当前仓库代码搜索相互印证；代码搜索找到的两个实现不是固定 tag 的替代证据。
2. [CommentServiceImpl.getCommentSubject](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/content/comment/CommentServiceImpl.java) 从 `extensionGetter.getExtensions(CommentSubject.class)` 中按 `supports(ref)` 选择实现；没有退回“所有 Plugin 都支持”的分支。
3. [CommentPermalinkService.getSubjectUrl](https://github.com/halo-dev/halo/blob/v2.27.1/application/src/main/java/run/halo/app/content/comment/CommentPermalinkService.java) 同样依赖注册 provider。缺少 provider 时不会得到评论主体固定链接。
4. Links 并非依靠通用 provider：[LinkCommentSubject](https://github.com/halo-sigs/plugin-links/blob/v2.5.0/src/main/java/run/halo/links/comment/LinkCommentSubject.java) 明确同时检查 Plugin 的 group/kind 和 `pluginContext.getName() == ref.name`，仅支持它自己的 `PluginLinks`。不能据此推断 `equipment` 可用。
5. Equipment 1.1.1 的完整 Java tree 无 `CommentSubject` 实现；[EquipmentPlugin](https://github.com/chengzhongxue/plugin-equipment/blob/1.1.1/src/main/java/com/kunkunyu/equipment/EquipmentPlugin.java) 只注册 `Equipment` 与 `EquipmentGroup`，没有 `EquipmentPage`；[EquipmentRouter](https://github.com/chengzhongxue/plugin-equipment/blob/1.1.1/src/main/java/com/kunkunyu/equipment/EquipmentRouter.java) 只提供 `groups`、`equipments`、模板 ID 和 `title`，不提供 `equipmentName`。其[默认内容模板](https://github.com/chengzhongxue/plugin-equipment/blob/1.1.1/src/main/resources/templates/modules/equipment.html) 不含评论。

## 当前主题证据

- `templates/modules/equipments/content.html:80-85` 有无依据的 `EquipmentPage` 分支和 `PluginEquipment` 回退。
- 对 `http://localhost:8090/equipments?preview-theme=theme-sky-blog-1` 进行匿名只读请求，响应只含 `theme-sky-blog-1` 主题资源，实际评论组件初始化数据为 `group: "plugin.halo.run", kind: "Plugin", name: "PluginEquipment"`；`equipment.kunkunyu.com` 分支未输出。
- 实际插件 manifest ID 是 `equipment`。但仅把 `PluginEquipment` 改成 `equipment` 不会凭空增加 provider，也可能将查询定位到另一组 subjectRef 下，导致旧评论不再显示；本轮没有读取或迁移历史评论数据。

## 不应夸大的结论

缺少 provider 能确认主体信息/固定链接没有官方支持，**不能仅据此断言评论 POST 一定失败**。官方 `CommentFinderEndpoint.createComment` 到 `CommentServiceImpl.create` 的已审路径没有通过 CommentSubject 检查主体存在性；无 provider 的评论仍可能被保存和按原 ref 查询。没有执行真实评论提交。

官方公开核心的结论不代表已枚举当前 Pro 发行包或所有第三方插件的动态扩展；若要宣称当前运行组合完整支持装备评论，仍需实际 provider 与无破坏的数据接入证据。

遵照本子任务条件，本次只报告，不删功能，不修改 ID，不触碰共享矩阵或认证代码。
