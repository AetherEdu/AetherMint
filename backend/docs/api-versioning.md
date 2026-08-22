# API Versioning Strategy

## Overview

The AetherMint API uses **URL-based versioning** with standard deprecation and sunset HTTP headers to manage the lifecycle of API versions.

## Current Version

The current stable API version is **v1**.

## Accessing the API

### Versioned (preferred)

All endpoints are available under `/api/v1/`:

```
GET /api/v1/health
GET /api/v1/quizzes
POST /api/v1/quizzes
```

### Legacy (deprecated)

The original non-versioned `/api/*` routes are still operational for backward compatibility, but they are **deprecated** and will be **sunset** on **2027-01-28**.

## Deprecation & Sunset Headers

When accessing non-versioned `/api/*` routes, the API attaches the following HTTP headers (RFC 8594):

| Header | Value | Description |
|--------|-------|-------------|
| `Deprecation` | `2026-07-28` | Date the endpoint was marked deprecated |
| `Sunset` | `2027-01-28` | Date after which the endpoint may be removed |
| `Link` | `</api/v1/{path}>; rel="deprecation"` | Link to the versioned replacement |
| `X-API-Version` | `v1` | The API version that served the request |

## Backward Compatibility Period

- **Deprecation Date**: 2026-07-28
- **Sunset Date**: 2027-01-28
- **Compatibility Period**: 6 months from deprecation date

During this period, both the versioned (`/api/v1/`) and legacy (`/api/`) routes will work identically. Clients are strongly encouraged to migrate to the versioned paths before the sunset date.

## Version Information Endpoint

```
GET /api/version
```

Returns the current version, supported versions, deprecation dates, and migration guide URL.

## Unsupported Versions

Requests to unsupported API versions (e.g., `/api/v0/`, `/api/v2/`) receive a **410 Gone** response with details on the supported versions.

## Migration Guide

To migrate from non-versioned endpoints to versioned endpoints:

1. Replace `/api/` with `/api/v1/` in your API calls
2. Verify your application works with the versioned endpoints
3. Update your documentation and API client configurations
4. Test thoroughly before the sunset date (2027-01-28)
