/**
 * 友情链接页入口。
 * 运行时位于 src/apps/links，便于独立验证路由与 PluginLinks API 适配。
 */
import "./links.css";
import { mountLinksApp } from "../../apps/links/runtime.js";
import { notifySwupPageReady, registerPageLifecycle } from "../../common/js/page-runtime.js";

registerPageLifecycle(mountLinksApp, { entry: "links", immediate: true });

notifySwupPageReady();
