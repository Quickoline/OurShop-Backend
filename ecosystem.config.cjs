module.exports = {
  apps: [
    {
      name: "ecom-api",
      cwd: "/var/www/ecom-api",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 5002,
      },
    },
  ],
};
