# Hostinger VPS Deployment (GoDaddy Domains + Certbot SSL)

This guide deploys:

- Backend API: `api.tbsveda.com` -> Node/Express on port `5000`
- User frontend: `tbsveda.com` + `www.tbsveda.com` -> static Vite build
- Admin frontend: `admin.tbsveda.com` -> static Vite build

VPS target: `62.72.56.117`

---

## 1) GoDaddy DNS setup

Create/update these `A` records (TTL: default/600):

- `@` -> `62.72.56.117`
- `www` -> `62.72.56.117`
- `admin` -> `62.72.56.117`
- `api` -> `62.72.56.117`

Wait for DNS propagation (usually a few minutes, sometimes longer).

---

## 2) SSH to VPS and install base packages

```bash
ssh root@62.72.56.117
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx git curl
```

Install Node.js LTS + PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
npm install -g pm2
```

---

## 3) Prepare folders on VPS

```bash
mkdir -p /var/www
mkdir -p /var/www/ecommerce-backend
mkdir -p /var/www/tbsveda.com
mkdir -p /var/www/admin.tbsveda.com
```

---

## 4) Upload project and install dependencies

Clone or upload this repo to:

- `/var/www/ecommerce-backend`

Then run:

```bash
cd /var/www/ecommerce-backend
npm install
cd admin-panel && npm install && npm run build
cd "../Demo fronted/Demo fronted" && npm install && npm run build
```

Copy built frontend files to Nginx web roots:

```bash
rm -rf /var/www/tbsveda.com/*
cp -r "/var/www/ecommerce-backend/Demo fronted/Demo fronted/dist/"* /var/www/tbsveda.com/

rm -rf /var/www/admin.tbsveda.com/*
cp -r /var/www/ecommerce-backend/admin-panel/dist/* /var/www/admin.tbsveda.com/
```

---

## 5) Backend production env

Create `/var/www/ecommerce-backend/.env`:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_strong_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=https://tbsveda.com,https://www.tbsveda.com,https://admin.tbsveda.com
BASE_URL=https://api.tbsveda.com/

AWS_REGION=ap-south-1
AWS_S3_BUCKET=your_bucket
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

Frontend env files:

- `/var/www/ecommerce-backend/admin-panel/.env`
  - `VITE_API_BASE_URL=https://api.tbsveda.com`
- `/var/www/ecommerce-backend/Demo fronted/Demo fronted/.env`
  - `VITE_API_URL=https://api.tbsveda.com`

After env changes, rebuild frontends:

```bash
cd /var/www/ecommerce-backend/admin-panel && npm run build
cd "/var/www/ecommerce-backend/Demo fronted/Demo fronted" && npm run build
```

Then recopy `dist` to `/var/www/tbsveda.com` and `/var/www/admin.tbsveda.com`.

---

## 6) PM2 for backend

Copy ecosystem file:

```bash
cp /var/www/ecommerce-backend/deploy/hostinger/ecosystem.config.cjs /var/www/ecommerce-backend/ecosystem.config.cjs
cd /var/www/ecommerce-backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 7) Nginx vhosts

Copy configs:

```bash
cp /var/www/ecommerce-backend/deploy/hostinger/nginx/api.tbsveda.com.conf /etc/nginx/sites-available/
cp /var/www/ecommerce-backend/deploy/hostinger/nginx/tbsveda.com.conf /etc/nginx/sites-available/
cp /var/www/ecommerce-backend/deploy/hostinger/nginx/admin.tbsveda.com.conf /etc/nginx/sites-available/
```

Enable them:

```bash
ln -sf /etc/nginx/sites-available/api.tbsveda.com.conf /etc/nginx/sites-enabled/api.tbsveda.com.conf
ln -sf /etc/nginx/sites-available/tbsveda.com.conf /etc/nginx/sites-enabled/tbsveda.com.conf
ln -sf /etc/nginx/sites-available/admin.tbsveda.com.conf /etc/nginx/sites-enabled/admin.tbsveda.com.conf
nginx -t
systemctl reload nginx
```

---

## 8) SSL with Certbot

Run once DNS is live:

```bash
certbot --nginx -d tbsveda.com -d www.tbsveda.com -d admin.tbsveda.com -d api.tbsveda.com
```

Choose redirect to HTTPS when prompted.

Test auto-renew:

```bash
certbot renew --dry-run
```

---

## 9) Firewall (recommended)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 10) Verify deployment

```bash
curl -I https://tbsveda.com
curl -I https://admin.tbsveda.com
curl -I https://api.tbsveda.com
curl https://api.tbsveda.com/
pm2 status
systemctl status nginx
```

---

## 11) Update flow for future deploys

```bash
cd /var/www/ecommerce-backend
git pull
npm install
pm2 restart ecommerce-backend

cd admin-panel && npm install && npm run build
rm -rf /var/www/admin.tbsveda.com/* && cp -r dist/* /var/www/admin.tbsveda.com/

cd "../Demo fronted/Demo fronted" && npm install && npm run build
rm -rf /var/www/tbsveda.com/* && cp -r dist/* /var/www/tbsveda.com/

nginx -t && systemctl reload nginx
```
