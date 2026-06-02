# nginx-config deployment notes

This folder contains the split Nginx configuration for:

- `snorkelology.co.uk`
- `beta.snorkelology.co.uk`
- `admin.snorkelology.co.uk`
- `practicenight.co.uk`

## Deployment steps

1. Copy this entire `nginx-config` folder to the server.

2. Ensure the deployed location matches the include paths inside `orchestrator.conf`.
   Current includes expect:
   - `/etc/nginx/nginx-config/00-http-to-https.conf`
   - `/etc/nginx/nginx-config/10-www-snorkelology-redirect.conf`
   - `/etc/nginx/nginx-config/11-www-practicenight-redirect.conf`
   - `/etc/nginx/nginx-config/12-www-beta-redirect.conf`
   - `/etc/nginx/nginx-config/20-snorkelology-public.conf`
   - `/etc/nginx/nginx-config/30-snorkelology-admin.conf`
   - `/etc/nginx/nginx-config/40-practicenight.conf`

3. Include `orchestrator.conf` from inside the global Nginx `http { ... }` block.
   Do not place it inside a `server { ... }` block, because it contains `upstream` and `map` directives.

   Example:

   ```nginx
   http {
       include /etc/nginx/nginx-config/orchestrator.conf;
   }
   ```

4. Make sure `orchestrator.conf` is loaded before any broad `include *.conf` pattern that could also pull in these server files separately.
   The intended model is:
   - global config includes `orchestrator.conf`
   - `orchestrator.conf` loads the split server files explicitly in order

5. Ensure TLS certificate coverage includes all required names:
   - `snorkelology.co.uk`
   - `www.snorkelology.co.uk`
   - `admin.snorkelology.co.uk`
   - `beta.snorkelology.co.uk`

   Example command:

   ```bash
   sudo certbot --nginx -d snorkelology.co.uk -d www.snorkelology.co.uk -d admin.snorkelology.co.uk -d beta.snorkelology.co.uk --expand
   ```

6. Ensure beta backend is available on `192.168.1.136:4001`.
   Production public/admin currently use `192.168.1.136:4000`.
   Practicenight uses `192.168.1.136:4005`.

7. Validate the config before reload:

   ```bash
   sudo nginx -t
   ```

8. Reload Nginx if validation passes:

   ```bash
   sudo systemctl reload nginx
   ```

## Important behavior notes

- `20-snorkelology-public.conf` uses shared `map` variables defined in `orchestrator.conf`.
- `beta.snorkelology.co.uk` is configured to bypass proxy cache and return no-store cache headers.
- `security-headers.conf` must remain free of `Cache-Control` directives, or you may end up with duplicate cache headers.
- `proxy-headers.conf` includes:
  - `proxy_http_version 1.1;`
  - `proxy_set_header Connection "";`
  These are required for upstream keepalive reuse.

## Recommended validation after deploy

1. Check syntax:

   ```bash
   sudo nginx -t
   ```

2. Confirm the beta host responds without cache reuse by inspecting headers:

   ```bash
   curl -I https://beta.snorkelology.co.uk/
   ```

3. Confirm the production host still uses normal cache behavior:

   ```bash
   curl -I https://snorkelology.co.uk/
   ```

4. If anything fails, inspect:
   - `/var/log/nginx/error.log`
   - backend process status for ports `4000`, `4001`, and `4005`
