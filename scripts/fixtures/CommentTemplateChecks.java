import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.integration.json.JsonPropertyAccessor;
import org.thymeleaf.context.Context;
import org.thymeleaf.context.IExpressionContext;
import org.thymeleaf.linkbuilder.StandardLinkBuilder;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.spring6.expression.ThymeleafEvaluationContext;
import org.thymeleaf.templateresolver.FileTemplateResolver;

/** Renders production fragments offline; the Halo comment extension itself is not mounted. */
public class CommentTemplateChecks {
  private static final List<Boolean> SWITCHES = Arrays.asList(false, true, null);
  private static final boolean[] GLOBAL_STATES = {false, true};
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static int assertions;
  private static int scenarios;

  private enum ConfigMode { MAP, JACKSON }

  public static class Theme {
    private final Object config;

    Theme(Object config) {
      this.config = config;
    }

    public Object getConfig() {
      return config;
    }
  }

  public static class Cursor {
    public boolean hasPrevious() { return false; }
    public boolean hasNext() { return false; }
  }

  public static class PostFinder {
    public Cursor cursor(String name) {
      return new Cursor();
    }

    public Map<String, Object> archives(int page, int size) {
      return map("items", List.of());
    }
  }

  public static class MomentList {
    private final List<Map<String, Object>> items;

    MomentList(Map<String, Object> moment) {
      items = List.of(moment);
    }

    public int getTotal() { return items.size(); }
    public List<Map<String, Object>> getItems() { return items; }
    public boolean hasPrevious() { return false; }
    public boolean hasNext() { return false; }
  }

  public static class PluginFinder {
    public boolean available(String name, String version) {
      if (!name.equals("PluginLinks")) {
        throw new AssertionError("Unexpected plugin-specific comment binding: " + name);
      }
      return true;
    }
  }

  private static Map<String, Object> map(Object... pairs) {
    var result = new LinkedHashMap<String, Object>();
    for (int index = 0; index < pairs.length; index += 2) {
      result.put((String) pairs[index], pairs[index + 1]);
    }
    return result;
  }

  private static void check(boolean condition, String message) {
    assertions++;
    if (!condition) throw new AssertionError(message);
  }

  private static SpringTemplateEngine engine(String root) {
    var resolver = new FileTemplateResolver();
    resolver.setPrefix(Path.of(root, "templates").toString() + "/");
    resolver.setSuffix(".html");
    resolver.setTemplateMode("HTML");
    resolver.setCacheable(false);

    var engine = new SpringTemplateEngine();
    engine.setTemplateResolver(resolver);
    engine.setLinkBuilder(new StandardLinkBuilder() {
      @Override
      protected String computeContextPath(IExpressionContext context, String base, Map<String, Object> parameters) {
        return "";
      }
    });
    return engine;
  }

  @SuppressWarnings("removal") // Match the Spring JSON accessor used by the existing template fixtures.
  private static Context context(ConfigMode mode, boolean global, Boolean themeSwitch, Boolean contentSwitch) {
    var config = map(
      "article", map(
        "post_interaction", map("enable_comment", themeSwitch, "enable_like", false, "enable_share", false),
        "copyright_notice", null),
      "about_settings", map(
        "display", map("enable_comment", themeSwitch, "show_site_stats", false,
          "show_article_heatmap", false, "show_page_content", false),
        "profile", null,
        "social_links", null,
        "tech_stack", null,
        "location", null,
        "github", map("username", null, "stats_host", null, "locale", null, "stats_theme", null,
          "show_stats", false, "show_calendar", false),
        "hero_actions", map(
          "primary_group", map("show_primary", false, "primary_text", null, "primary_link", null),
          "secondary_group", map("show_secondary", false, "secondary_text", null, "secondary_link", null)),
        "cta", map("show_cta", true, "title", null, "button_text", null, "button_link", null)),
      "archive_settings", map(
        "basic_info", map("enable_comment", themeSwitch),
        "sidebar_settings", map("show_sidebar", false, "enable_custom_sidebar", false)),
      "links_settings", map(
        "basic_info", map("enable_comment", themeSwitch, "page_title", null, "page_description", null),
        "display_settings", map("show_link_feeds", false, "show_link_status", false),
        "sidebar_settings", map("show_sidebar", false, "enable_custom_sidebar", false),
        "apply_settings", null),
      "moments_settings", map(
        "basic_info", map("page_title", null, "enable_upvote", false, "enable_comment", themeSwitch),
        "sidebar_settings", map("show_sidebar", false, "enable_custom_sidebar", false),
        "publish_settings", map("enable_publish", false),
        "enable_share", false, "share_settings", null),
      "docsme", map("doc_settings", map("enable_share", false)),
      "photos_settings", map(
        "enable_comment", themeSwitch, "page_title", null, "page_description", null,
        "show_photo_info", true, "show_download_btn", true, "layout", null),
      "equipment_settings", map(
        "feature_settings", map("enable_comment", themeSwitch),
        "sidebar_settings", map("show_sidebar", false, "enable_custom_sidebar", false),
        "style_settings", null, "basic_info", null),
      "general", map("sidebar_settings", map("position", "right")));

    var context = new Context();
    context.setVariable("haloCommentEnabled", global);
    context.setVariable("theme", new Theme(mode == ConfigMode.JACKSON ? MAPPER.valueToTree(config) : config));
    var evaluation = new ThymeleafEvaluationContext(new StaticApplicationContext(), null);
    evaluation.addPropertyAccessor(new JsonPropertyAccessor());
    context.setVariable(ThymeleafEvaluationContext.THYMELEAF_EVALUATION_CONTEXT_CONTEXT_VARIABLE_NAME, evaluation);

    context.setVariable("site", map("title", "Fixture Site", "url", "https://fixture.invalid"));
    var moment = map(
      "metadata", map("name", "actual-moment-subject"),
      "owner", map("name", "fixture-owner", "avatar", null, "displayName", "Fixture owner"),
      "spec", map("content", map("html", "<p>Fixture moment</p>", "medium", List.of()),
        "tags", List.of(), "releaseTime", java.time.OffsetDateTime.parse("2026-10-28T08:00:00+08:00"),
        "visible", null),
      "stats", map("upvote", 0, "totalComment", 3));
    context.setVariable("moment", moment);
    context.setVariable("moments", new MomentList(moment));
    context.setVariable("tags", List.of());
    context.setVariable("singlePage", map(
      "metadata", map("name", "actual-page-subject"),
      "spec", map("title", "Fixture page", "cover", null, "allowComment", contentSwitch),
      "content", map("content", "<p>Fixture body</p>")));
    context.setVariable("post", map(
      "metadata", map("name", "actual-post-subject", "annotations", map("copyrightNoticeMode", "hide")),
      "spec", map("title", "Fixture post", "allowComment", contentSwitch),
      "stats", map("comment", 4, "upvote", 2),
      "status", map("permalink", "/archives/fixture")));
    context.setVariable("postFinder", new PostFinder());
    context.setVariable("project", map(
      "spec", map("displayName", "Docs", "authorizeRequired", false, "enableComment", contentSwitch),
      "status", map("permalink", "/docs/fixture")));
    context.setVariable("docTree", map(
      "metadata", map("name", "actual-doc-subject"),
      "spec", map("title", "Doc"),
      "status", map("permalink", "/docs/fixture/body")));
    context.setVariable("docInfo", map(
      "content", map("content", "<p>Fixture body</p>"),
      "doc", map("spec", map("owner", null, "updatedAt", null))));
    context.setVariable("docTrees", List.of());
    context.setVariable("crumbs", List.of());
    context.setVariable("versions", List.of());
    context.setVariable("languages", List.of());
    context.setVariable("archives", null);
    context.setVariable("globalArchives", null);
    context.setVariable("linksTitle", "Fixture Links");
    context.setVariable("group", "");
    context.setVariable("simpleGroups", List.of());
    context.setVariable("pluginName", "PluginLinks");
    context.setVariable("linkApplicationEnabled", false);
    context.setVariable("pluginFinder", new PluginFinder());
    context.setVariable("linkNavigation", null);
    context.setVariable("param", map("view", null, "scope", null, "groupName", null, "linkName", null));
    context.setVariable("photos", null);
    context.setVariable("groups", List.of());
    return context;
  }

  private static Document render(SpringTemplateEngine engine, String module, String fragment, Context context) {
    scenarios++;
    return Jsoup.parse(engine.process("modules/" + module, Set.of(fragment), context));
  }

  private static void subject(Document document, boolean visible, String group, String kind, String name, String label) {
    var comments = document.getElementsByTag("halo:comment");
    check(comments.size() == (visible ? 1 : 0), label + ": comment count was " + comments.size());
    if (visible) {
      var comment = comments.first();
      check(comment.attr("group").equals(group), label + ": subject group");
      check(comment.attr("kind").equals(kind), label + ": subject kind");
      check(comment.attr("name").equals(name), label + ": subject name");
    }
  }

  private static void shell(Document document, boolean visible, String group, String kind, String name, String label) {
    subject(document, visible, group, kind, name, label);
    if (!visible) {
      check(!document.text().contains("评论交流") && !document.text().contains("评论留言")
        && !document.text().contains("留言板"), label + ": no empty comment shell");
    }
  }

  private static void postsAndAbout(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean theme : SWITCHES) {
        for (Boolean content : SWITCHES) {
          var context = context(mode, global, theme, content);
          boolean visible = global && !Boolean.FALSE.equals(theme) && !Boolean.FALSE.equals(content);
          String label = mode + " global=" + global + ",theme=" + theme + ",content=" + content;
          shell(render(engine, "post/article-footer", "footer", context), visible,
            "content.halo.run", "Post", "actual-post-subject", "post " + label);
          var about = render(engine, "about/content", "content", context);
          shell(about, visible, "content.halo.run", "SinglePage", "actual-page-subject", "about " + label);
          check(about.select("a[href='#sf-comments']").size() == (visible ? 1 : 0),
            "about CTA follows comment shell " + label);
        }
      }
    }
  }

  private static void pagesAndDocs(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean content : SWITCHES) {
        var context = context(mode, global, true, content);
        String label = mode + " global=" + global + ",content=" + content;
        shell(render(engine, "page/content", "content", context), global && !Boolean.FALSE.equals(content),
          "content.halo.run", "SinglePage", "actual-page-subject", "page " + label);
        shell(render(engine, "doc-content", "content", context), global && Boolean.TRUE.equals(content),
          "doc.halo.run", "DocTree", "actual-doc-subject", "doc " + label);
      }
    }
  }

  private static void archives(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean theme : SWITCHES) {
        for (Boolean content : SWITCHES) {
          for (boolean pageExists : GLOBAL_STATES) {
            var context = context(mode, global, theme, content);
            if (!pageExists) context.setVariable("singlePage", null);
            boolean visible = global && Boolean.TRUE.equals(theme) && pageExists && !Boolean.FALSE.equals(content);
            String label = mode + " global=" + global + ",theme=" + theme
              + ",content=" + content + ",page=" + pageExists;
            shell(render(engine, "archives/content", "archive-content", context), visible,
              "content.halo.run", "SinglePage", "actual-page-subject", "archives " + label);
          }
        }
      }
    }
  }

  private static void links(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean theme : SWITCHES) {
        var links = render(engine, "links/content", "links-content", context(mode, global, theme, true));
        boolean visible = global && !Boolean.FALSE.equals(theme);
        String label = mode + " links global=" + global + ",theme=" + theme;
        subject(links, visible, "plugin.halo.run", "Plugin", "PluginLinks", label);
        check(links.select("#links-comments").size() == 1, label + ": one comment/fallback board anchor");
        check(!links.text().contains("PluginCommentWidget"), label + ": provider-independent fallback");
        check(links.select("#links-comments [role=status]").text().contains("留言已关闭") == !visible,
          label + ": closed comments use an accurate fallback");
        check(links.select("[data-links-page]").attr("data-links-comments-enabled").equals(Boolean.toString(visible)),
          label + ": application guidance shares the comment capability");
      }
    }
  }

  private static void withdrawnLists(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean legacySetting : SWITCHES) {
        var context = context(mode, global, legacySetting, true);
        var photos = render(engine, "photos/content", "content", context);
        shell(photos, false, "", "", "", mode + " photos legacy=" + legacySetting + ",global=" + global);
        check(photos.text().contains("暂无照片"), "photos list still renders");
        context.setVariable("singlePage", null);
        var equipment = render(engine, "equipments/content", "equipment-content", context);
        shell(equipment, false, "", "", "", mode + " equipment router-only fixture");
        check(equipment.text().contains("暂无装备分组"), "equipment list still renders");
      }
    }
  }

  private static void moments(SpringTemplateEngine engine, ConfigMode mode) {
    for (boolean global : GLOBAL_STATES) {
      for (Boolean theme : SWITCHES) {
        var context = context(mode, global, theme, true);
        var list = render(engine, "moments/content", "content", context);
        var detail = render(engine, "moments/detail", "content", context);
        boolean visible = global && !Boolean.FALSE.equals(theme);
        int expected = visible ? 1 : 0;
        int listComments = list.getElementsByTag("halo:comment").size();
        long listButtons = list.getElementsByTag("button").stream()
          .filter(button -> button.attr("@click").contains("showComment")).count();
        int detailComments = detail.getElementsByTag("halo:comment").size();
        int detailCounts = detail.getElementsByClass("icon-[heroicons--chat-bubble-left]").size();
        String label = mode + " moments global=" + global + ",theme=" + theme;
        check(listComments == expected && listButtons == expected && detailComments == expected
          && detailCounts == expected,
          label + ": expected " + expected + " comment controls; listComments=" + listComments
            + ",listButtons=" + listButtons + ",detailComments=" + detailComments
            + ",detailCounts=" + detailCounts);
        subject(list, visible, "moment.halo.run", "Moment", "actual-moment-subject", label + " list");
        subject(detail, visible, "moment.halo.run", "Moment", "actual-moment-subject", label + " detail");
        check(list.select("[x-show=showComment]").size() == expected, label + ": list comment shell follows switch");
        check(detail.select(".mt-3.pt-3.border-t.border-base-200").size() == expected,
          label + ": detail comment shell follows switch");
        check(list.text().contains("Fixture moment") && detail.text().contains("Fixture moment"),
          label + ": moment content stays visible");
      }
    }
  }

  public static void main(String[] args) {
    if (args.length != 1) throw new IllegalArgumentException("Expected the theme repository root");
    var engine = engine(args[0]);
    for (ConfigMode mode : ConfigMode.values()) {
      postsAndAbout(engine, mode);
      pagesAndDocs(engine, mode);
      archives(engine, mode);
      links(engine, mode);
      withdrawnLists(engine, mode);
      moments(engine, mode);
    }
    System.out.println("PASS " + scenarios + " real Thymeleaf render scenarios with Map/Jackson config, "
      + assertions + " assertions; no comment POST, plugin state or database mutation.");
  }
}
