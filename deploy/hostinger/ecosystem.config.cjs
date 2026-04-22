module.exports = {
  apps: [
    {
      name: "ecommerce-backend",
      cwd: "/var/www/ecommerce-backend",
      script: "server.js",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
