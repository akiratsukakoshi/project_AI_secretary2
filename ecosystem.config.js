module.exports = {
  apps : [{
    name: "notion-mcp",
    script: "/home/tukapontas/ai-secretary2/mcp-servers/notion-mcp/build/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "200M",
    env: {
      NODE_ENV: "production",
      NOTION_TOKEN: process.env.NOTION_TOKEN || "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",
      NOTION_VERSION: process.env.NOTION_VERSION || "2022-06-28",
      PORT: 3001
    },
    error_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-error.log",
    out_file: "/home/tukapontas/ai-secretary2/logs/notion-mcp-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }
  // 将来的に Google Calendar MCP を追加する場合はここに追加
  // {
  //   name: "google-calendar-mcp",
  //   script: "/home/tukapontas/ai-secretary2/mcp-servers/google-calendar-mcp/build/index.js",
  //   instances: 1,
  //   autorestart: true,
  //   watch: false,
  //   max_memory_restart: "200M",
  //   env: {
  //     NODE_ENV: "production",
  //     PORT: 3002
  //   },
  //   error_file: "/home/tukapontas/ai-secretary2/logs/google-calendar-mcp-error.log",
  //   out_file: "/home/tukapontas/ai-secretary2/logs/google-calendar-mcp-out.log",
  //   log_date_format: "YYYY-MM-DD HH:mm:ss"
  // }
  ]
};
