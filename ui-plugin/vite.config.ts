import { viteConfig } from "@halo-dev/ui-plugin-bundler-kit/vite";

export default viteConfig({
  provider: "theme",
  manifestPath: "theme.yaml",
  vite: {
    build: {
      outDir: "ui-plugin/dist",
      rollupOptions: {
        input: "src/console/settings.js",
      },
    },
  },
});
