# Reference Docs Review (Summary)

The PDFs in `/reference/` are long-form design documents. They describe:
- A multi-service architecture with dedicated redirect, analytics, and API services
- Redis caching, queue-based analytics, and ClickHouse/TimescaleDB
- API keys, OAuth, 2FA, and enterprise security controls
- Kubernetes (DOKS) deployments, CI/CD, and ops runbooks

## What matches the current MVP
- Core URL shortening, redirect, and basic analytics
- Custom domains and QR codes (MVP-level)
- Basic rate limiting (added to API)

## What does not exist in the current repo
- Separate redirect service
- Redis caching and rate-limit store
- Analytics DB (ClickHouse/Timescale)
- API keys and org/team model
- K8s manifests and CI/CD pipeline

## Recommendation
Use the PDFs as the target-state reference only. The MVP should be documented separately
so the implementation and the docs are aligned.
