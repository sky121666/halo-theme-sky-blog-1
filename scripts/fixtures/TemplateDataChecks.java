import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.springframework.context.support.StaticApplicationContext;
import org.thymeleaf.context.Context;
import org.thymeleaf.context.IExpressionContext;
import org.thymeleaf.linkbuilder.StandardLinkBuilder;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.spring6.expression.ThymeleafEvaluationContext;
import org.thymeleaf.templateresolver.FileTemplateResolver;

/** Render production data-dependent elements offline, without a Halo service or business writes. */
public class TemplateDataChecks {
  public enum MediaType { PHOTO, VIDEO, AUDIO, POST }
  private static final SpringTemplateEngine ENGINE = engine();
  private static int checks;
  private static int failures;

  private static Map<String, Object> map(Object... values) {
    var result = new LinkedHashMap<String, Object>();
    for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
    return result;
  }

  private static SpringTemplateEngine engine() {
    var result = new SpringTemplateEngine();
    result.setLinkBuilder(new StandardLinkBuilder() {
      @Override
      protected String computeContextPath(IExpressionContext context, String base, Map<String, Object> parameters) {
        return "";
      }
    });
    return result;
  }

  private static String render(String html, Map<String, Object> variables) {
    var context = new Context();
    context.setVariables(variables);
    context.setVariable(ThymeleafEvaluationContext.THYMELEAF_EVALUATION_CONTEXT_CONTEXT_VARIABLE_NAME,
      new ThymeleafEvaluationContext(new StaticApplicationContext(), null));
    return ENGINE.process(html, context);
  }

  private static void check(boolean condition, String label) {
    checks++;
    if (!condition) {
      failures++;
      System.err.println("FAIL " + label);
    }
  }

  private static Element parse(Path root, String name) throws Exception {
    return Jsoup.parse(Files.readString(root.resolve("templates/" + name)));
  }

  private static void counts(Path root) throws Exception {
    int nodes = 0;
    for (String file : List.of("modules/categories/category-switch.html", "modules/tags/tag-switch.html",
      "modules/widgets/categories.html", "modules/widgets/tags.html")) {
      for (Element node : parse(root, file).getAllElements()) {
        if (!node.attr("th:text").contains("postCount")) continue;
        nodes++;
        // Keep the production element's local count scope, including th:if/with ordering.
        Element scoped = node.clone();
        for (Element parent = node.parent(); parent != null; parent = parent.parent()) {
          if (parent.attr("th:with").startsWith("postCount=")) {
            scoped = new Element("th:block").attr("th:with", parent.attr("th:with")).appendChild(scoped);
            break;
          }
        }
        for (Integer visible : new Integer[] {2, 0, null}) {
          // The official VO's public count deliberately differs from the raw extension status.
          var category = map("postCount", visible, "status", map("postCount", 5, "visiblePostCount", 3));
          String result = Jsoup.parse(render(scoped.outerHtml(), map("c", category, "t", category,
            "category", category, "child", category, "tag", category))).text().replace("(", "").replace(")", "");
          check(visible != null && visible == 2 ? result.equals("2") : result.isEmpty() || result.equals("0"),
            file + " count=" + visible + " rendered=" + result);
        }
      }
    }
    check(nodes > 0, "production count elements were exercised");
  }

  private static void excerpts(Path root) throws Exception {
    Element source = parse(root, "modules/categories/list-minimal.html");
    Element paragraph = source.getElementsByAttributeValue("th:text", "${excerptText}").first().parent();
    Element scoped = paragraph;
    if (paragraph.parent().attr("th:with").contains("excerptText")) scoped = paragraph.parent();
    for (String[] sample : new String[][] {
      {"Manual excerpt", "Automatic excerpt", "Manual excerpt"},
      {"", "Automatic excerpt", "Automatic excerpt"},
      {null, "Automatic excerpt", "Automatic excerpt"},
      {"", "", ""},
      {null, null, ""}
    }) {
      var post = map("spec", map("excerpt", sample[0] == null ? null : map("raw", sample[0])),
        "status", map("excerpt", sample[1], "permalink", "/archives/fixture"));
      var document = Jsoup.parse(render(scoped.outerHtml(), map("post", post)));
      check(document.text().equals(sample[2]), "excerpt rendered=" + document.text() + " expected=" + sample[2]);
      check(!sample[2].isEmpty() || document.select("p").isEmpty(), "empty excerpt has no paragraph");
    }
  }

  private static void docs(Path root) throws Exception {
    String banner = parse(root, "modules/doc-content.html").selectFirst(".doc-restricted-banner").outerHtml();
    for (Boolean restricted : new Boolean[] {true, false, null}) {
      var project = map("spec", map("authorizeRequired", restricted));
      var result = Jsoup.parse(render(banner, map("project", project)));
      check(result.select(".doc-restricted-banner").size() == (Boolean.TRUE.equals(restricted) ? 1 : 0),
        "Docsme authorized banner=" + restricted);
    }
    check(Jsoup.parse(render(banner, map("project", null))).select(".doc-restricted-banner").isEmpty(),
      "missing project has no authorization banner");
  }

  private static void modernCards(Path root) throws Exception {
    Element source = parse(root, "modules/categories/list-modern.html")
      .getElementsByAttributeValue("th:fragment", "modern(posts, settings)").first().clone();
    source.removeAttr("th:fragment");
    // Missing/empty covers, real (including unreachable) URLs, and both fallback policies.
    for (String[] sample : new String[][] {
      {null, "false", "missing_only", null, null, "", "", ""},
      {"", "false", "missing_only", null, null, "Manual excerpt", "Auto excerpt", "Manual excerpt"},
      {null, "false", "missing_only", null, null, "", "Auto excerpt", "Auto excerpt"},
      {"/cover.jpg", "false", "missing_only", null, "/cover.jpg", "", "Auto excerpt", "Auto excerpt"},
      {"/unreachable-cover.jpg", "false", "missing_only", null, "/unreachable-cover.jpg", "", "", ""},
      {null, "true", "missing_only", "/fallback.jpg", "/fallback.jpg", "", "", ""},
      {"/cover.jpg", "true", "missing_only", "/fallback.jpg", "/cover.jpg", "", "", ""},
      {"/cover.jpg", "true", "always", "/fallback.jpg", "/fallback.jpg", "", "", ""}
    }) {
      boolean noCover = sample[4] == null;
      var post = map("metadata", map("name", "fixture", "annotations", map()),
        "spec", map("title", "Fixture title", "cover", sample[0], "pinned", true, "visible", null,
          "excerpt", map("raw", sample[5]), "publishTime", java.util.Date.from(java.time.Instant.parse("2025-02-03T12:00:00Z"))),
        "status", map("permalink", "/archives/fixture", "excerpt", sample[6]),
        "categories", List.of(), "tags", List.of(), "stats", map("visit", 12, "upvote", 0, "comment", 0));
      var settings = map("cover_fallback", map("enable", Boolean.valueOf(sample[1]), "mode", sample[2], "default_image", sample[3]),
        "cover_fallback_enable", false, "cover_fallback_mode", "missing_only", "cover_fallback_url", null);
      var result = Jsoup.parse(render(source.outerHtml(), map("posts", map("items", List.of(post)),
        "settings", settings, "currentUser", null)));
      String label = "modern cover=" + sample[0] + " fallback=" + sample[1] + "/" + sample[2];
      check(result.select("article").size() == 1, label + " renders exactly one card");
      check(result.select("figure").size() == (noCover ? 0 : 1), label + " reserves media only with a URL");
      check(result.select("img").size() == (noCover ? 0 : 1), label + " preserves the image branch");
      if (!noCover) check(result.selectFirst("img").attr("src").startsWith(sample[4]), label + " uses configured cover");
      check(result.selectFirst("h3 a").attr("href").equals("/archives/fixture"), label + " preserves article navigation");
      check(result.selectFirst("h3").text().equals("Fixture title"), label + " preserves title");
      check(result.text().contains("02-03") && result.text().contains("置顶") && result.text().contains("12"),
        label + " preserves date, pin, and visits");
      check(result.select("p").text().equals(sample[7]), label + " preserves excerpt precedence");
      if (noCover && sample[7].isEmpty()) check(result.select("p").isEmpty(), label + " omits the empty excerpt");
    }
  }

  private static void moments(Path root) throws Exception {
    for (String name : List.of("content", "detail")) {
      // XML parsing preserves self-closing th:block fragments before Thymeleaf sees them.
      var document = Jsoup.parse(Files.readString(root.resolve("templates/modules/moments/" + name + ".html")),
        "", Parser.xmlParser());
      String fragment = document.selectFirst(".moment-media").outerHtml();
      for (int count : new int[] {0, 1, 9, 10}) {
        var media = new java.util.ArrayList<Map<String, Object>>();
        for (int i = 0; i < count; i++) media.add(map("type", MediaType.PHOTO, "url", "/photo-" + i + ".png"));
        var result = Jsoup.parse(render(fragment, map("content", map("medium", media))));
        check(result.select("img").size() == count, "moments " + name + " preserves " + count + " photos");
        check(count < 10 || result.select("a[href='/photo-9.png']").size() == 1,
          "moments " + name + " historic overflow retains an original-image link");
      }
      var media = List.of(map("type", MediaType.VIDEO, "url", "/video.mp4"),
        map("type", MediaType.PHOTO, "url", "/photo.png"), map("type", MediaType.AUDIO, "url", "/audio.mp3"));
      var result = Jsoup.parse(render(fragment, map("content", map("medium", media))));
      check(result.select("img").size() == 1 && result.select("video").size() == 1 && result.select("audio").size() == 1,
        "moments " + name + " retains mixed media");
    }
  }


  private static void photoDimensions(Path root) throws Exception {
    String image = parse(root, "modules/photos/content.html").selectFirst("#photo-grid img").outerHtml();
    for (Integer[] size : new Integer[][] {{600, 300}, {300, 600}, {0, 400}, {-1, 400}, {400, null}, {null, null}}) {
      var exif = size[0] == null ? null : map("imageWidth", size[0], "imageHeight", size[1]);
      var photo = map("spec", map("displayName", "Photo", "url", "/original.jpg"), "exif", exif);
      Element result = Jsoup.parse(render(image, map("photo", photo))).selectFirst("img");
      boolean valid = size[0] != null && size[0] > 0 && size[1] != null && size[1] > 0;
      check(valid ? result.attr("width").equals(size[0].toString()) : !result.hasAttr("width"),
        "photo width uses only a complete positive EXIF pair: " + java.util.Arrays.toString(size));
      check(valid ? result.attr("height").equals(size[1].toString()) : !result.hasAttr("height"),
        "photo height uses only a complete positive EXIF pair: " + java.util.Arrays.toString(size));
    }
  }

  private static void equipmentSpecs(Path root) throws Exception {
    for (String file : List.of("card.html", "card-simple.html")) {
      var document = Jsoup.parse(Files.readString(root.resolve("templates/modules/equipments/" + file)),
        "", Parser.xmlParser());
      var fragment = document.selectFirst(file.equals("card.html") ? ".data-grid" : ".ec-specs-tech").clone();
      // Supply the annotation value directly while retaining the production line parser and output.
      fragment.removeAttr("th:if").removeAttr("th:with");
      for (String[] sample : new String[][] {
        {"CPU: Intel", "CPU Intel"},
        {"内存：32 GB | 80", "内存 32 GB"},
        {"URL: https://example.com/path?a=b", "URL https://example.com/path?a=b"},
        {"比例: 16:9", "比例 16:9"},
        {"说明: 中文：英文", "说明 中文：英文"},
        {"", ""}, {"CPU:", ""}, {"CPU：", ""}, {":", ""}, {"：", ""}, {"|", ""},
        {" | 80", ""}, {": 未命名", ""},
        {"CPU: Intel\n:\n|\n内存：32 GB | 80", "CPU Intel 内存 32 GB"}
      }) {
        try {
          var result = Jsoup.parse(render(fragment.outerHtml(), map("specsText", sample[0])));
          check(result.text().equals(sample[1]), "equipment " + file + " input=" + sample[0].replace("\n", "\\n")
            + " rendered=" + result.text() + " expected=" + sample[1]);
          if (sample[0].equals("内存：32 GB | 80") && file.equals("card-simple.html")) {
            check(result.selectFirst(".ec-data-fill").attr("style").equals("--w:80%"),
              "equipment simple card preserves the progress display");
          }
        } catch (RuntimeException error) {
          check(false, "equipment " + file + " cannot render input=" + sample[0].replace("\n", "\\n")
            + " error=" + error.getMessage());
        }
      }
    }
  }

  private static void authorMedia(Path root) throws Exception {
    var document = Jsoup.parse(Files.readString(root.resolve("templates/modules/author/content.html")),
      "", Parser.xmlParser());
    String fragment = document.getElementsByAttributeValue("th:if", "${not #lists.isEmpty(content.medium)}")
      .first().outerHtml();
    for (int count : new int[] {0, 1, 9, 10}) {
      var media = new java.util.ArrayList<Map<String, Object>>();
      for (int i = 0; i < count; i++) media.add(map("type", MediaType.PHOTO, "url", "/photo-" + i + ".png"));
      var result = Jsoup.parse(render(fragment,
        map("content", map("medium", media), "author", map("spec", map("displayName", "Fixture")))));
      check(result.select("img").size() == count, "author moment preserves " + count + " photos");
      check(result.select("a[href][data-no-swup] > img").size() == count,
        "author moment retains accessible original-image links for " + count + " photos");
      if (count == 10) {
        check(result.select("a[href='/photo-9.png'] > img[src='/photo-9.png']").size() == 1,
          "author historic tenth photo can be reached through its original-image link");
        check(!result.text().contains("+1"), "author moment has no nonfunctional overflow overlay");
      }
    }
    var media = new java.util.ArrayList<Map<String, Object>>();
    media.add(map("type", MediaType.VIDEO, "url", "/video.mp4"));
    media.add(map("type", MediaType.AUDIO, "url", "/audio.mp3"));
    for (int i = 0; i < 8; i++) media.add(map("type", MediaType.PHOTO, "url", "/mixed-" + i + ".png"));
    var result = Jsoup.parse(render(fragment,
      map("content", map("medium", media), "author", map("spec", map("displayName", "Fixture")))));
    check(result.select("img").size() == 8 && result.select("video").size() == 1 && result.select("audio").size() == 1,
      "author mixed media retains photos following video and audio");
  }

  private static void authBrandAssets(Path root) throws Exception {
    var document = Jsoup.parse(Files.readString(root.resolve("templates/gateway_fragments/layout.html")),
      "", Parser.xmlParser());
    var featureList = new Element("th:block").attr("th:with", document.selectFirst("html").attr("th:with"))
      .appendChild(document.selectFirst(".features-list").clone());
    for (String mode : List.of("custom", "empty", "missing")) {
      var settings = map("auth_layout", "split", "brand_style", "features");
      for (String key : List.of("card_effect", "brand_slogan", "features_welcome", "feature_1_title", "feature_1_desc",
        "feature_2_title", "feature_2_desc", "feature_3_title", "feature_3_desc", "auth_side_image", "auth_logo",
        "auth_site_title", "auth_site_title_simple")) settings.put(key, null);
      for (int i = 1; i <= 3; i++) settings.put("feature_" + i + "_icon", mode.equals("custom")
        ? "<svg data-fixture-icon='" + i + "' viewBox='0 0 24 24'><path d='M0 0h1v1'/></svg>"
        : mode.equals("empty") ? "" : null);
      var result = Jsoup.parse(render(featureList.outerHtml(),
        map("theme", map("config", map("auth", map("auth_settings", settings))))));
      for (int i = 1; i <= 3; i++) {
        Element icon = result.select(".feature-icon").get(i - 1);
        check(mode.equals("custom") ? icon.select("svg[data-fixture-icon='" + i + "']").size() == 1
          : icon.getAllElements().stream().anyMatch(element -> element.className().contains("icon-[heroicons--")),
          "auth feature icon " + i + " renders " + mode + " configuration");
      }
    }
    for (String[] sample : new String[][] {
      {null, null, null}, {"", "", null}, {null, "/site-logo.png", "/site-logo.png"},
      {"/auth-logo.png", "/site-logo.png", "/auth-logo.png"}
    }) {
      var result = Jsoup.parse(render(document.selectFirst(".features-logo").outerHtml(),
        map("authLogo", sample[0], "authSiteTitle", null, "site", map("title", "Fixture", "logo", sample[1]))));
      Element image = result.selectFirst("img");
      check(sample[2] == null ? image == null : image != null && image.attr("src").equals(sample[2]),
        "auth feature logo uses a nonempty custom or site image: " + java.util.Arrays.toString(sample));
    }
  }

  private static void aboutGithubColorScope(Path root) throws Exception {
    var document = Jsoup.parse(Files.readString(root.resolve("templates/modules/about/content.html")),
      "", Parser.xmlParser());
    String fragment = document.selectFirst(".sf-projects-grid").outerHtml();
    for (boolean calendar : new boolean[] {true, false}) {
      for (boolean stats : new boolean[] {true, false}) {
        var result = Jsoup.parse(render(fragment, map("githubUsername", "fixture", "showGithubCalendar", calendar,
          "showGithubStats", stats, "showArticleHeatmap", false)));
        check(result.select("#github-stats-img").size() == (stats ? 1 : 0), "about GitHub stats setting=" + stats);
        check(result.select("#about-color-probe").size() == (calendar || stats ? 1 : 0),
          "about theme colors available with calendar=" + calendar + " stats=" + stats);
      }
    }
  }

  private static void categorySidebarWidth(Path root) throws Exception {
    var document = Jsoup.parse(Files.readString(root.resolve("templates/modules/categories/content.html")),
      "", Parser.xmlParser());
    var section = document.getElementsByAttributeValue("th:fragment", "category-collection").first()
      .selectFirst("section").clone().empty();
    for (boolean sidebar : new boolean[] {true, false}) {
      var result = Jsoup.parse(render(section.outerHtml(),
        map("cfg", map("show_sidebar", null), "sidebarCfg", map("show_sidebar", sidebar)))).selectFirst("section");
      check(result.hasClass("max-w-6xl") == !sidebar && result.hasClass("mx-auto") == !sidebar,
        "category collection width follows sidebar setting=" + sidebar);
    }
  }

  private static Map<String, Object> categoryNode(String name, List<Map<String, Object>> children) {
    return map("metadata", map("name", name), "spec", map("displayName", name),
      "status", map("permalink", "/categories/" + name), "postCount", 2, "children", children);
  }

  private static void footerDockSpacing(Path root) throws Exception {
    var footer = parse(root, "modules/footer.html").selectFirst("footer").clone().empty();
    footer.removeAttr("th:fragment");
    for (String style : new String[] {null, "bottom", "side", "unknown"}) {
      for (Boolean enabled : new Boolean[] {null, true, false}) {
        var dock = map("dock_style", style, "enable_dock", enabled);
        var theme = map("config", map("general", map("floating_dock", dock)));
        var result = Jsoup.parse(render(footer.outerHtml(), map("theme", theme))).selectFirst("footer");
        boolean hasDock = !Boolean.FALSE.equals(enabled);
        String label = "footer dock style=" + style + " enabled=" + enabled;
        check(result.hasClass("pb-16") == hasDock, label + " preserves bottom clearance");
        check(result.hasClass("md:pb-0") == (hasDock && "side".equals(style)),
          label + " only side dock resets clearance on desktop");
        check(result.hasClass("bg-base-100/80") && result.hasClass("overflow-hidden"),
          label + " preserves footer appearance");
      }
    }
    var theme = map("config", map("general", map("floating_dock", null)));
    var result = Jsoup.parse(render(footer.outerHtml(), map("theme", theme))).selectFirst("footer");
    check(result.hasClass("pb-16") && !result.hasClass("md:pb-0"),
      "missing dock config retains default bottom dock clearance");
  }

  private static void categorySwitch(Path root) throws Exception {
    var fragmentEngine = engine();
    var resolver = new FileTemplateResolver();
    resolver.setPrefix(root.resolve("templates").toString() + "/");
    resolver.setSuffix(".html");
    fragmentEngine.setTemplateResolver(resolver);
    var children = new ArrayList<Map<String, Object>>();
    for (int i = 0; i < 20; i++) children.add(categoryNode("child-" + i, List.of()));
    var categories = List.of(categoryNode("parent", children));
    for (String style : List.of("pills", "chips", "underline", "glass")) {
      for (boolean selected : new boolean[] {false, true}) {
        var context = new Context();
        context.setVariables(map("categories", categories, "currentCategory", selected ? children.get(19) : null,
          "site", map("routes", map("categoriesUri", "/topics"))));
        context.setVariable(ThymeleafEvaluationContext.THYMELEAF_EVALUATION_CONTEXT_CONTEXT_VARIABLE_NAME,
          new ThymeleafEvaluationContext(new StaticApplicationContext(), null));
        var result = Jsoup.parse(fragmentEngine.process("modules/categories/category-switch", Set.of(style), context));
        check(result.select("a[data-category-item]").size() == 21, style + " retains all descendants");
        check(result.select("a[href='/topics']").size() == 1, style + " retains configured collection route");
        check(result.select("button[type='button']").size() == 1, style + " has a native expansion button");
        check(result.select("a[aria-current='page']").size() == (selected ? 1 : 0), style + " identifies current descendant");
        check(!selected || result.selectFirst("a[aria-current='page']").attr("href").endsWith("/child-19"),
          style + " selects the last child");
      }
    }
  }

  public static void main(String[] args) throws Exception {
    Path root = Path.of(args[0]);
    counts(root);
    excerpts(root);
    modernCards(root);
    docs(root);
    moments(root);
    photoDimensions(root);
    equipmentSpecs(root);
    authorMedia(root);
    authBrandAssets(root);
    aboutGithubColorScope(root);
    categorySidebarWidth(root);
    categorySwitch(root);
    footerDockSpacing(root);
    System.out.println("Template data checks: " + (checks - failures) + "/" + checks + " passed");
    if (failures > 0) throw new AssertionError(failures + " template data contract failures");
  }
}
