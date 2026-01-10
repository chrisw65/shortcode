# SSO Setup (OIDC)

Use the admin Settings page to configure OIDC per organization.

## Required fields
- Issuer URL: your IdP issuer (e.g., `https://YOUR_DOMAIN/`)
- Client ID and Client secret
- Scopes: include `openid,email,profile` at minimum
- Enable toggle: must be on

## Login flow
1) Go to `/admin/` login page.
2) Enter the organization ID.
3) Click “Continue with SSO”.

The callback issues a standard JWT and drops you into `/admin/dashboard.html`.

## Callback URL
Use this callback in your IdP:
`https://okleaf.link/api/auth/oidc/callback`

If running locally, update to match your `BASE_URL` or `PUBLIC_HOST`.
