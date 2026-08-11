import baseConfig from "./playwright.config";

export default {
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    command: "npx next start -p 3003",
    timeout: 180000,
  },
};
