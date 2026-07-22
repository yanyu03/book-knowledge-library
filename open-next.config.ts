import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

export default {
  ...config,
  dangerous: {
    ...config.dangerous,
    disableIncrementalCache: true,
  },
};
