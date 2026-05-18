import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

config.default = {
  ...config.default,
  minify: true,
};

config.cloudflare = {
  useWorkerdCondition: false,
};

export default config;
