# OkLeaf Technical Architecture

## Overview

OkLeaf is a full-stack URL shortener SaaS platform consisting of three main components:
1. **Backend API** - Express.js/TypeScript server
2. **Mobile App** - Flutter iOS/Android application
3. **Browser Extension** - Manifest V3 Chrome/Firefox/Edge extension

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────┤
│   Web Admin     │   Mobile App    │ Browser Ext     │   Public Site           │
│   (Vanilla JS)  │   (Flutter)     │ (Manifest V3)   │   (Static HTML)         │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬────────────────┘
         │                 │                 │                 │
         └─────────────────┴─────────────────┴─────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOAD BALANCER / CDN                                  │
│                    (Nginx / Cloudflare / AWS ALB)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   API Service   │      │ Redirect Service│      │  Worker Service │
│   (PORT 3000)   │      │   (PORT 3000)   │      │   (Background)  │
│                 │      │                 │      │                 │
│ - Auth          │      │ - Short URL     │      │ - Click Queue   │
│ - Links CRUD    │      │   resolution    │      │ - Analytics     │
│ - Analytics     │      │ - GeoIP lookup  │      │ - Webhooks      │
│ - Billing       │      │ - Device detect │      │ - Integrations  │
│ - Domains       │      │ - A/B routing   │      │ - Retention     │
│ - Organizations │      │ - Deep linking  │      │                 │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
         ┌─────────────────┐         ┌─────────────────┐
         │   PostgreSQL    │         │     Redis       │
         │   (Primary DB)  │         │   (Cache/Queue) │
         │                 │         │                 │
         │ - Users         │         │ - Link cache    │
         │ - Organizations │         │ - Rate limits   │
         │ - Links         │         │ - Click queue   │
         │ - Click events  │         │ - Sessions      │
         │ - Domains       │         │                 │
         │ - Billing       │         │                 │
         └─────────────────┘         └─────────────────┘
```

---

## Backend Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20+ |
| Framework | Express.js | 5.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 15+ |
| Cache | Redis | 7+ |
| ORM | Raw SQL (pg) | - |

### Directory Structure

```
src/
├── index.ts                 # Application entry point
├── config/
│   ├── database.ts          # PostgreSQL connection pool
│   └── redis.ts             # Redis client setup
├── controllers/             # Request handlers (23 files)
│   ├── auth.controller.ts   # Authentication (1,282 lines)
│   ├── link.controller.ts   # Link CRUD (1,400+ lines)
│   ├── redirect.controller.ts
│   ├── analytics.controller.ts
│   ├── billing.controller.ts
│   ├── domain.controller.ts
│   ├── org.controller.ts
│   ├── bio.controller.ts
│   ├── qr.controller.ts
│   ├── mobileApps.controller.ts
│   └── ... (13 more)
├── routes/                  # Express route definitions (23 files)
├── middleware/
│   ├── auth.ts              # JWT/API key authentication
│   ├── org.ts               # Organization context
│   ├── rateLimit.ts         # Memory rate limiting
│   ├── redisRateLimit.ts    # Redis rate limiting
│   └── apiScope.ts          # API key scope validation
├── services/
│   ├── audit.ts             # Audit logging
│   ├── clickQueue.ts        # Redis click processing
│   ├── entitlements.ts      # Plan feature flags
│   ├── geoip.ts             # MaxMind GeoIP lookup
│   ├── integrations.ts      # Zapier/Slack/GA4
│   ├── linkCache.ts         # Redis link caching
│   ├── mailer.ts            # SMTP email
│   ├── oidc.ts              # SSO discovery
│   ├── orgLimits.ts         # Quota enforcement
│   ├── plan.ts              # Plan resolution
│   ├── platformConfig.ts    # Global settings
│   ├── webhooks.ts          # Webhook dispatch
│   └── ... (5 more)
└── utils/
    └── logger.ts            # Structured JSON logging
```

### Service Modes

The backend supports multiple deployment modes via `SERVICE_MODE` environment variable:

| Mode | Description |
|------|-------------|
| `all` | API + Redirect + Worker (default) |
| `api` | API endpoints only |
| `redirect` | Short URL resolution only |
| `worker` | Background job processing only |

### Database Schema (Key Tables)

```sql
-- Core entities
users (id, email, password_hash, plan, two_factor_secret, ...)
orgs (id, name, owner_user_id, settings, ...)
org_members (org_id, user_id, role, ...)

-- Links
links (id, org_id, short_code, original_url, title, expires_at,
       scheduled_start_at, scheduled_end_at, password_hash,
       click_count, active, ...)
link_variants (id, link_id, url, weight, ...)
link_routes (id, link_id, condition_type, condition_value, target_url, ...)
link_qr_settings (link_id, color, bg_color, size, logo_url, ...)

-- Analytics
click_events (id, link_id, clicked_at, ip_hash, country, city,
              device_type, browser, os, referrer, ...)

-- Domains
domains (id, org_id, domain, verified, verification_token, ...)

-- Billing
plan_grants (id, target_type, target_id, plan, ends_at, ...)
coupons (code, discount_percent, max_uses, ...)

-- Bio pages
bio_pages (id, org_id, slug, display_name, bio, avatar_url, theme, ...)
bio_links (id, bio_page_id, label, url, position, ...)

-- Integrations
mobile_apps (id, org_id, platform, bundle_id, scheme, ...)
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Login   │────▶│  2FA?    │────▶│  JWT +   │
│          │     │ Endpoint │     │ Required │     │  Cookie  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │                 │
                      │                 ▼
                      │          ┌──────────┐
                      │          │  TOTP    │
                      │          │  Verify  │
                      │          └──────────┘
                      │                 │
                      ▼                 ▼
              ┌─────────────────────────────┐
              │     JWT Token Response      │
              │  + HttpOnly Cookie (web)    │
              │  + Refresh Token Rotation   │
              └─────────────────────────────┘
```

**Authentication Methods:**
1. **JWT Bearer Token** - API access
2. **HTTP-Only Cookie** - Web dashboard
3. **API Key** - Programmatic access with scopes
4. **SSO/OIDC** - Enterprise single sign-on

### Rate Limiting Architecture

```
Request → Redis Rate Limiter → Memory Fallback → Handler
              │
              ├── Per-IP limits
              ├── Per-User limits
              ├── Per-Org limits
              └── Per-API-Key limits
```

### Click Processing Pipeline

```
Redirect Request
      │
      ▼
┌─────────────┐
│ Link Cache  │ ◄── Redis GET
│   (Redis)   │
└──────┬──────┘
       │ miss
       ▼
┌─────────────┐
│  Database   │
│   Query     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  GeoIP      │
│  Lookup     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Click Queue │ ──▶ Redis LPUSH
│   (Redis)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Worker    │ ◄── Redis BRPOP
│  Process    │
└──────┬──────┘
       │
       ├──▶ Insert click_events
       ├──▶ Update link.click_count
       ├──▶ Emit webhooks
       └──▶ Dispatch integrations
```

---

## Mobile App Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Flutter | 3.x |
| Language | Dart | 3.6+ |
| State | StatefulWidget | - |
| HTTP | Dio | 5.7.0 |
| Storage | cookie_jar | 4.0.8 |

### Directory Structure

```
mobile/lib/
├── main.dart                    # App entry, routing, session gate
├── screens/
│   ├── login_screen.dart        # Email/password + 2FA detection
│   ├── two_factor_screen.dart   # TOTP verification
│   ├── home_screen.dart         # Bottom navigation (5 tabs)
│   ├── links_screen.dart        # Link list with actions
│   ├── create_link_screen.dart  # Link creation form
│   ├── analytics_screen.dart    # Stats dashboard
│   ├── bio_screen.dart          # Link-in-bio management
│   └── qr_screen.dart           # QR studio with live preview
├── services/
│   ├── api_client.dart          # Dio HTTP client, CSRF, errors
│   ├── auth_service.dart        # Login, 2FA, logout
│   └── session_manager.dart     # Global navigator, 401 redirect
├── widgets/
│   ├── empty_state.dart         # Empty list placeholder
│   ├── stat_card.dart           # Analytics stat display
│   └── app_snackbar.dart        # Success/error messages
└── theme/
    └── app_theme.dart           # Dark theme, Material 3
```

### App Flow

```
┌─────────────┐
│    main()   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SessionGate │
│ (FutureBuilder)
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌─────┐  ┌─────┐
│Login│  │Home │
└──┬──┘  └──┬──┘
   │        │
   ▼        ▼
┌─────┐  ┌─────────────────────────────────┐
│ 2FA │  │         Bottom Navigation        │
└──┬──┘  ├─────┬─────┬─────┬─────┬─────────┤
   │     │Links│Create│Stats│Bio │QR Studio│
   └────▶└─────┴─────┴─────┴─────┴─────────┘
```

### API Client Features

```dart
class ApiClient {
  // Cookie-based session persistence
  late final PersistCookieJar cookieJar;

  // CSRF token auto-injection for mutations
  onRequest: (options, handler) {
    if (method != 'GET') {
      options.headers['x-csrf-token'] = csrfToken;
    }
  }

  // 401 auto-redirect to login
  onError: (err, handler) {
    if (err.response?.statusCode == 401) {
      SessionManager.redirectToLogin();
    }
  }

  // Centralized error messages
  static String errorMessage(Object error) {
    // Network timeout, connection error, API error, etc.
  }
}
```

### Theme System

```dart
// Brand colors matching web app
bg:      #0A0D12  // Dark background
panel:   #151B24  // Card surface
text:    #F5F3EF  // Primary text
accent:  #D5A24B  // Gold primary
accent2: #2FB7A4  // Teal secondary

// Material 3 components themed:
// AppBar, Card, Input, Button, NavigationBar, etc.
```

---

## Browser Extension Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Manifest | V3 (Chrome MV3) |
| Popup | HTML + Vanilla JS |
| Storage | chrome.storage.local |
| Permissions | activeTab, storage, clipboardWrite |

### Directory Structure

```
extension/
├── manifest.json            # Store-ready manifest
├── manifest.selfhosted.json # Self-hosted with update_url
├── popup.html               # Extension popup UI
├── popup.js                 # Popup logic
├── options.html             # Settings page
├── options.js               # Settings logic
├── styles.css               # Shared styles
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### Extension Flow

```
┌─────────────────┐
│ Click Extension │
│     Icon        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  popup.html     │
│  (popup.js)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ chrome.tabs     │
│ .query()        │ ──▶ Get current tab URL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ chrome.storage  │
│ .local.get()    │ ──▶ Get API key + base URL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/links │
│ X-API-Key: xxx  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Copy to         │
│ Clipboard       │
└─────────────────┘
```

### Manifest Permissions

```json
{
  "permissions": [
    "storage",        // Save API key locally
    "activeTab",      // Read current tab URL
    "tabs",           // Query tab info
    "clipboardWrite"  // Copy short URL
  ],
  "host_permissions": [
    "<all_urls>"      // Shorten any site
  ]
}
```

### Self-Hosted Updates

For enterprise deployment without store:

```xml
<!-- updates.xml -->
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="okleaf-extension">
    <updatecheck
      codebase="https://okleaf.link/extension/okleaf-extension-0.1.1.zip"
      version="0.1.1" />
  </app>
</gupdate>
```

---

## Security Architecture

### Authentication Security

| Layer | Implementation |
|-------|----------------|
| Password hashing | bcrypt (cost 12) |
| JWT signing | HS256 with secret rotation support |
| Session cookies | HttpOnly, Secure, SameSite=Lax |
| CSRF protection | Double-submit cookie pattern |
| 2FA | TOTP (RFC 6238) |
| API keys | SHA-256 hashed, scoped permissions |

### Input Validation

- SQL: Parameterized queries throughout
- XSS: HTML escaping in templates
- CORS: Origin whitelist validation
- Rate limiting: Redis-backed with memory fallback

### Data Protection

- IP anonymization option per org
- Data retention policies (configurable)
- GDPR export/delete endpoints
- Audit logging for sensitive actions

---

## Deployment Architecture

### Docker Compose (Development)

```yaml
services:
  api:
    build: .
    environment:
      - SERVICE_MODE=all
      - DATABASE_URL=postgres://...
      - REDIS_URL=redis://...
    ports:
      - "3000:3000"

  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
```

### Production Recommendations

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN + WAF)   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Load Balancer  │
                    │  (AWS ALB)      │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ API Pod │        │ API Pod │        │ API Pod │
    │ (ECS)   │        │ (ECS)   │        │ (ECS)   │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
    ┌─────────────────┐        ┌─────────────────┐
    │ RDS PostgreSQL  │        │ ElastiCache     │
    │ (Multi-AZ)      │        │ Redis Cluster   │
    └─────────────────┘        └─────────────────┘
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured JSON logging
log('info', 'link.created', {
  org_id: '...',
  link_id: '...',
  short_code: 'abc123'
});

// Output:
// {"level":"info","message":"link.created","time":"...","org_id":"..."}
```

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness probe (always 200) |
| `GET /health` | Readiness with DB/Redis check |

### Recommended Integrations

- **APM**: Datadog, New Relic, or OpenTelemetry
- **Error Tracking**: Sentry
- **Log Aggregation**: ELK Stack, Datadog Logs
- **Metrics**: Prometheus + Grafana

---

## Scalability Considerations

### Horizontal Scaling

- Stateless API servers (scale via replicas)
- Redis for session/cache (cluster mode)
- PostgreSQL read replicas for analytics

### Performance Optimizations

1. **Link cache** - Redis GET before DB query
2. **Click queue** - Async processing via Redis
3. **Connection pooling** - pg pool (max: 20)
4. **Rate limiting** - Redis-backed with memory fallback

### Estimated Capacity

| Component | Capacity |
|-----------|----------|
| Single API instance | ~1,000 req/s |
| Redis link cache | ~50,000 ops/s |
| Click queue processing | ~5,000 clicks/s |
| PostgreSQL (standard) | ~10,000 QPS |
