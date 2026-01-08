# DigitalOcean Droplet Ops (MVP)

## Assumed deployment model
- Single droplet
- Node app running via systemd or a process manager
- Postgres hosted externally or on the droplet
- Nginx (or Caddy) as reverse proxy
- Domain: `oklink.lnk`

## Baseline checks
- `systemctl status <service>`
- `curl http://127.0.0.1:3000/health`
- `curl https://oklink.lnk/health`
- `openssl s_client -connect oklink.lnk:443 -servername oklink.lnk`

## Env validation
- `JWT_SECRET` set
- Postgres env vars set
- `PUBLIC_HOST=https://oklink.lnk`

## Suggested systemd unit (example)
```
[Unit]
Description=shortcode api
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/shortcode
EnvironmentFile=/opt/shortcode/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Nginx reverse proxy (example)
```
server {
  server_name oklink.lnk;
  listen 80;
  return 301 https://$host$request_uri;
}

server {
  server_name oklink.lnk;
  listen 443 ssl http2;
  # ssl_certificate ...;
  # ssl_certificate_key ...;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Logs and monitoring
- App logs: `journalctl -u <service> -f`
- Nginx logs: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

## Backup
- Postgres backups (managed or cron)
- `.env` stored securely
