# AetherMint Error Catalog (RFC 7807)

> Issue #254 — _Standardize error response format across all API endpoints_

This catalog is the **single source of truth** for every machine-readable
error code the AetherMint API can emit. New codes must be added here before
they ship in code, and every code below must resolve to exactly one row in
`backend/src/utils/problemDetails.ts → ErrorCatalog`.

All error responses follow
[RFC 7807 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
and are served with `Content-Type: application/problem+json`. Every
endpoint emits the same canonical envelope so clients can implement one
uniform error handler regardless of route.

---

## 1. Wire format

| Field        | Type     | Notes                                             |
| ------------ | -------- | ------------------------------------------------- |
| `type`       | `string` (URI) | Stable identifier of the problem class    |
| `title`      | `string` | Short summary, constant for the same `type`       |
| `status`     | `number` | Mirror of the HTTP status code                    |
| `detail`     | `string` | Per-occurrence explanation (human-readable)       |
| `instance`   | `string` | `"<METHOD> <path>"` of the failing request        |
| `code`       | `string` | Machine-readable AetherMint code (see catalog)    |
| `success`    | `false`  | Always `false` for an error response              |
| `requestId`  | `string` | UUID v4; matches the `X-Request-ID` response header |
| `timestamp`  | `string` | ISO-8601 string                                   |
| `errors?`    | `array`  | Field-level validation errors (see schema)        |
| `error`      | `object` | **Deprecated** legacy envelope mirror (see §4)   |

### Example envelope — `POST /api/auth/register` with bad payload

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
X-Request-ID: 7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10
```

```json
{
  "type": "https://aethermint.io/problems/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Validation failed for 2 fields",
  "instance": "POST /api/auth/register",
  "code": "VALIDATION_ERROR",
  "success": false,
  "requestId": "7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10",
  "timestamp": "2026-07-24T12:34:56.000Z",
  "errors": [
    { "field": "email", "message": "\"email\" must be a valid email" },
    { "field": "password", "message": "\"password\" length must be at least 8 characters long" }
  ],
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed for 2 fields",
    "details": [
      { "field": "email", "message": "\"email\" must be a valid email" },
      { "field": "password", "message": "\"password\" length must be at least 8 characters long" }
    ],
    "requestId": "7e2c1f5a-8d2b-4e0d-9d6f-3a1d2e9b4c10"
  }
}
```

---

## 2. Catalog

| `code`                  | HTTP | Title                    | `type` URI                                                           | Default message                                                                                  |
| ----------------------- | ---- | ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`      | 400  | Validation Error         | `https://aethermint.io/problems/validation-error`                    | The request payload failed validation.                                                           |
| `UNAUTHORIZED`          | 401  | Unauthorized             | `https://aethermint.io/problems/unauthorized`                        | Authentication is required to access this resource.                                              |
| `FORBIDDEN`             | 403  | Forbidden                | `https://aethermint.io/problems/forbidden`                           | You do not have permission to perform this action.                                                |
| `NOT_FOUND`             | 404  | Not Found                | `https://aethermint.io/problems/not-found`                           | The requested resource could not be found.                                                        |
| `CONFLICT`              | 409  | Conflict                 | `https://aethermint.io/problems/conflict`                            | The request conflicts with the current state of the resource.                                     |
| `PAYLOAD_TOO_LARGE`     | 413  | Payload Too Large        | `https://aethermint.io/problems/payload-too-large`                   | The request body exceeds the maximum allowed size.                                                |
| `UNSUPPORTED_MEDIA_TYPE`| 415  | Unsupported Media Type   | `https://aethermint.io/problems/unsupported-media-type`              | The request media type is not supported by this endpoint.                                         |
| `RATE_LIMITED`          | 429  | Too Many Requests        | `https://aethermint.io/problems/rate-limited`                        | You have exceeded the rate limit. Please retry after a moment.                                    |
| `SERVICE_UNAVAILABLE`   | 503  | Service Unavailable      | `https://aethermint.io/problems/service-unavailable`                 | The service is temporarily unavailable. Please retry shortly.                                     |
| `INTERNAL_ERROR`        | 500  | Internal Server Error    | `https://aethermint.io/problems/internal-error`                      | An unexpected error occurred. Please try again later.                                             |
| _fallback_              | 500  | Unknown Error            | `https://aethermint.io/problems/unknown-error`                       | An unspecified error occurred. (only used for codes absent from this table)                      |

> Every `code` in the left column must match an entry in
> [`backend/src/utils/problemDetails.ts → ErrorCatalog`](../src/utils/problemDetails.ts).
> Adding a new operational error requires **both** a new AppError
> subclass in `utils/errors.ts` **and** a new entry in `ErrorCatalog`,
> otherwise the response will fall through to `UNKNOWN_ERROR`.

---

## 3. Status / severity policy

- `400–499` are **operational** errors. Logged at `warn` level.
- `500–599` and any non-operational throw are **programmer / infra**
  errors. Logged at `error` level with full stack trace (development only).
- The central error middleware always sets `Content-Type:
  application/problem+json` and writes the envelope via `res.send`.
- Stack traces are only included when `NODE_ENV === 'development'`.

---

## 4. Backward-compatibility mirror

The legacy `{ "success": false, "error": { "code", "message", "details",
"requestId" } }` shape is still emitted under the top-level `error` field
so existing CLI / dashboard clients keep working. The mirror is annotated
`deprecated: true` in the OpenAPI schema and is scheduled for removal in
the next major version.

When migrating clients:

| Old field           | New field            |
| ------------------- | -------------------- |
| `body.success`      | `body.success` *(unchanged, always `false`)* |
| `body.error.code`   | `body.code`          |
| `body.error.message`| `body.detail`        |
| `body.error.details`| `body.errors`        |
| _none_              | `body.type`          |
| _none_              | `body.title`         |
| _none_              | `body.instance`      |
| _none_              | `body.timestamp`     |
| `body.error.requestId` | `body.requestId`   |

---

## 5. Adding a new error

1. Create the subclass in `backend/src/utils/errors.ts`.
2. Add a matching row in `ErrorCatalog` (`utils/problemDetails.ts`) — never
   throw with a `code` that does not exist there.
3. Update the table in this document.
4. Add a test in `backend/tests/middleware/errorHandler.test.ts`.
5. Reference the new `type` URI in any client SDK error mapping.

Thanks to one error middleware emitting the same shape everywhere,
no other code changes are typically required for new codes to flow
through every route.
