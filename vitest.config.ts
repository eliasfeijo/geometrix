import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    // Workspaces without tests yet must not fail the run.
    passWithNoTests: true,
  },
});
