#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Real Spring/Thymeleaf rendering plus Jsoup assertions. Supply the same library
// versions used by Halo through THYMELEAF_TEST_CLASSPATH (a directory/* is valid).
const classpath = process.env.THYMELEAF_TEST_CLASSPATH;
if (!classpath) throw new Error("Set THYMELEAF_TEST_CLASSPATH to Thymeleaf, Spring and Jsoup jars");
const root = fileURLToPath(new URL("..", import.meta.url));
const output = fs.mkdtempSync(path.join(os.tmpdir(), "sky-equipment-route-"));
const java = String.raw`
import java.nio.file.*;
import java.util.*;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.FileTemplateResolver;
import org.thymeleaf.context.Context;
import org.thymeleaf.context.IExpressionContext;
import org.thymeleaf.dialect.AbstractDialect;
import org.thymeleaf.dialect.IExpressionObjectDialect;
import org.thymeleaf.expression.IExpressionObjectFactory;
import org.thymeleaf.linkbuilder.StandardLinkBuilder;
import org.jsoup.Jsoup;

public class EquipmentRouteChecks {
  static int failures;
  static Map<String,Object> m(Object... kv) {
    var map = new LinkedHashMap<String,Object>();
    for (int i = 0; i < kv.length; i += 2) map.put((String) kv[i], kv[i + 1]);
    return map;
  }
  static void check(boolean ok, String message) {
    if (!ok) failures++;
    System.out.println((ok ? "PASS " : "FAIL ") + message);
  }
  public static class Annotations {
    public Object get(Object target, String key) { return null; }
    public Object getOrDefault(Object target, String key, Object fallback) { return fallback; }
  }
  static class AnnotationDialect extends AbstractDialect implements IExpressionObjectDialect {
    AnnotationDialect() { super("Fixture annotations"); }
    public IExpressionObjectFactory getExpressionObjectFactory() {
      return new IExpressionObjectFactory() {
        public Set<String> getAllExpressionObjectNames() { return Set.of("annotations"); }
        public Object buildObject(IExpressionContext context, String name) { return new Annotations(); }
        public boolean isCacheable(String name) { return true; }
      };
    }
  }
  static Map<String,Object> equipment(String name, String group) {
    return m("metadata", m("name", name), "spec", m("displayName", name, "groupName", group,
      "url", "/item/" + name, "cover", null, "description", "Fixture item"));
  }
  static Map<String,Object> group(String name, List<?> items) {
    return m("metadata", m("name", name), "spec", m("displayName", name, "description", "Group " + name),
      "status", m("equipmentCount", items.size()), "equipments", items);
  }
  public static void main(String[] args) throws Exception {
    var resolver = new FileTemplateResolver();
    resolver.setPrefix(args[0] + "/templates/");
    resolver.setSuffix(".html"); resolver.setTemplateMode("HTML"); resolver.setCacheable(false);
    var engine = new SpringTemplateEngine();
    engine.setTemplateResolver(resolver); engine.addDialect(new AnnotationDialect());
    engine.setLinkBuilder(new StandardLinkBuilder() {
      protected String computeContextPath(IExpressionContext context, String base, Map<String,Object> params) { return ""; }
    });
    var a1 = equipment("a-one", "group-a"); var a2 = equipment("a-two", "group-a");
    var b1 = equipment("b-one", "group-b");
    var groups = List.of(group("group-a", List.of(a1, a2)), group("group-b", List.of(b1)));
    for (String style : List.of("tech", "simple")) {
      for (String tab : List.of("pills", "chips", "underline", "glass")) {
        for (String selected : List.of("", "group-a", "missing-group", " ", " group-a ")) {
          boolean noGroup = selected.isBlank();
          boolean missingGroup = !noGroup && !selected.equals("group-a");
          var context = new Context();
          context.setVariable("param", m("group", selected.isEmpty() ? null : List.of(selected)));
          context.setVariable("theme", m("config", m("equipment_settings", m("basic_info", m("page_title", null,
            "page_subtitle", null, "page_description", null), "style_settings", m("tab_style", tab, "hero_background", null)))));
          context.setVariable("groups", groups);
          var routed = missingGroup ? List.of() : List.of(a2);
          String suffix = noGroup ? "" : "?group=" + selected.replace(" ", "%20");
          context.setVariable("equipments", m("items", routed, "total", routed.isEmpty() ? 0 : 2,
            "page", 2, "totalPages", routed.isEmpty() ? 0 : 2, "hasPrevious", !routed.isEmpty(), "hasNext", false,
            "prevUrl", "/equipments" + suffix, "nextUrl", "/equipments/page/3" + suffix));
          String html = engine.process("modules/equipments/style-" + style, Set.of("style-" + style), context);
          var doc = Jsoup.parse(html);
          String label = style + "/" + tab + "/" + (selected.isEmpty() ? "all" : selected);
          check(doc.select(".equipment-tabs-" + tab).size() == 1, label + " configured navigation style rendered once");
          check(doc.select(".equipment-tabs-" + tab + " a[href='/equipments']").size() == 1, label + " all route clears group");
          check(doc.select(".equipment-tabs-" + tab + " a[href='/equipments?group=group-a']").size() == 1, label + " group link is a route");
          check(doc.select("a[aria-current=page]").size() == (missingGroup ? 0 : 1), label + " one selected route");
          String active = noGroup ? "/equipments" : "/equipments?group=" + selected;
          check(missingGroup || doc.select("a[aria-current=page]").attr("href").equals(active), label + " selected route matches group");
          check(doc.select("a[href^='/item/']").size() == routed.size(), label + " only routed page items rendered");
          check(doc.select("a[href='/item/a-one'], a[href='/item/b-one']").isEmpty(), label + " no full-group data leaks into route");
          check(routed.isEmpty() || doc.select("a[rel=prev]").attr("href").equals("/equipments" + suffix), label + " official previous URL preserved");
          check(!routed.isEmpty() || doc.select("[role=status]").size() == 1, label + " empty route is readable");
          Files.writeString(Path.of(args[1], style + "-" + tab + "-" + (selected.isEmpty() ? "all" : selected) + ".html"), html);
          context.setVariable("equipments", m("items", List.of(a1), "total", 2, "page", 1,
            "totalPages", 2, "hasPrevious", false, "hasNext", true,
            "prevUrl", "/equipments" + suffix, "nextUrl", "/equipments/page/2" + suffix));
          var firstPage = Jsoup.parse(engine.process("modules/equipments/style-" + style, Set.of("style-" + style), context));
          check(firstPage.select("a[rel=next]").attr("href").equals("/equipments/page/2" + suffix), label + " official next URL preserved");
        }
      }
    }
    if (failures > 0) throw new AssertionError(failures + " equipment route assertions failed");
  }
}
`;
const fixture = path.join(output, "EquipmentRouteChecks.java");
fs.writeFileSync(fixture, java);
for (const [cmd, args] of [
  ["javac", ["-cp", classpath, "-d", output, fixture]],
  ["java", ["-cp", `${output}${path.delimiter}${classpath}`, "EquipmentRouteChecks", root, output]],
]) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Equipment route fixtures: ${output}`);
