# Domain Setup Guide

## Recommended order
1. Deploy the site first and confirm the Render URL works.
2. Confirm both `https://your-render-url/api/health` and `https://your-render-url/api/resources` respond successfully.
3. Add your custom domain in the Render dashboard.
4. Update DNS at your registrar.
5. Verify the domain in Render.
6. Confirm HTTPS is active.

## Typical DNS notes
- Root domain often uses ALIAS/ANAME depending on provider.
- `www` usually uses a CNAME to the Render service hostname.
- Remove conflicting `AAAA` records if your platform requires IPv4-only routing.

## Final checks
- `https://yourdomain.com` loads correctly
- `http://yourdomain.com` redirects to HTTPS
- `www` and root redirect as desired
- `https://yourdomain.com/api/health` responds with `status: ok`
- `https://yourdomain.com/api/resources` returns the shared resource library
