import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

config.default = {
  ...config.default,
  minify: true,
};

config.buildCommand = "npx prisma generate && npx next build";

export default config;
