import { skyDebug } from "./debug.js";

/**
 * Compose features inside a page module. Swup imports the module explicitly and
 * owns when it mounts. Component registrations and cleanup stay local.
 */
export function createPage() {
  const features = [];
  const components = [];

  return {
    onMount: (feature) => features.push(feature),
    useAlpine: (register) => components.push(register),
    registerAlpine(alpine) {
      for (const register of components) register(alpine);
    },
    mount(context) {
      const cleanups = [];
      const cleanup = () => {
        for (const dispose of cleanups.splice(0).reverse()) {
          try {
            dispose();
          } catch (error) {
            skyDebug.error("page", "页面清理失败", error);
          }
        }
      };
      try {
        for (const feature of features) {
          const dispose = feature(context);
          if (typeof dispose === "function") cleanups.push(dispose);
        }
      } catch (error) {
        cleanup();
        throw error;
      }
      return cleanup;
    },
  };
}
