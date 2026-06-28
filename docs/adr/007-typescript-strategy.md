# ADR-007: TypeScript Adoption Strategy (Gradual Migration from JavaScript)

**Status**: Accepted

**Date**: 2024-06

**Deciders**: Core development team

## Context

AetherMint spans three packages with different starting points:

1. **`contracts/`**: Already in Rust — no JavaScript/TypeScript involved
2. **`backend/`**: Started as JavaScript (Express.js), migrating to TypeScript
3. **`frontend/`**: Started as Next.js with TypeScript from day one

The backend initially used plain JavaScript for rapid prototyping. As the codebase grew, the lack of type safety led to increased bug density, harder refactoring, and poor IDE support. However, a full rewrite in TypeScript would be time-consuming and risky.

## Decision

We will follow a **gradual TypeScript migration strategy**:

| Phase | Action | Status |
|-------|--------|--------|
| **Phase 1** | Add TypeScript tooling (tsconfig.json, tsc, ESLint TypeScript plugins) | ✅ Complete |
| **Phase 2** | New code in TypeScript; existing JS files renamed to `.ts` with minimal types | ✅ In progress |
| **Phase 3** | Add strict typing to core modules (routes, middleware, services) | 🔄 Ongoing |
| **Phase 4** | Enable `strict: true` in tsconfig when type coverage is sufficient | 📅 Planned |

Specifically:
- Backend compiles with both **Babel** (`babel/preset-typescript`) for fast transpilation and **`tsc --noEmit`** for type checking
- Frontend uses Next.js native TypeScript support with `tsconfig.json`
- Shared types (e.g., credential schemas, API contracts) are in the frontend's `types/` directory as the source of truth
- **`allowJs: true`** in backend tsconfig to permit incremental migration
- New backend files must be `.ts`; existing `.js` files can be migrated opportunistically

## Alternatives Considered

### Full TypeScript rewrite
- **Pros**: Complete type safety immediately, consistent codebase, no migration overhead
- **Cons**: Large upfront engineering investment, risk of introducing bugs during rewrite, delays feature development
- **Why rejected**: The migration cost would halt feature velocity for weeks. Gradual migration allows continued feature development while improving type safety incrementally.

### Stay with JavaScript
- **Pros**: No migration effort, simpler build pipeline, faster iteration
- **Cons**: Higher bug density, poor refactoring safety, worse IDE support, harder onboarding
- **Why rejected**: The codebase complexity has grown beyond what's comfortable without types. The credential verification domain requires correctness guarantees that TypeScript provides.

### Deno/TypeScript-native runtime
- **Pros**: Native TypeScript support, no build step, modern standard library
- **Cons**: Smaller ecosystem, fewer compatible npm packages, team unfamiliarity
- **Why rejected**: The existing dependency footprint (Express, Prisma, Mongoose, Socket.io) is tightly coupled to Node.js. Switching runtimes would require replacing core dependencies.

## Consequences

### Positive
- **Type safety**: Compile-time detection of common bugs (null references, missing properties, type mismatches)
- **Better IDE support**: Autocomplete, refactoring tools, inline documentation in VS Code
- **Self-documenting code**: Type annotations serve as living documentation of data shapes
- **Safer refactoring**: TypeScript catches broken references across files
- **Incremental adoption**: No feature freeze; new code is typed while old code continues to work

### Negative
- **Build complexity**: Backend needs both Babel (transpilation) and tsc (type checking) — two tools to configure and maintain
- **Migration overhead**: `any` types and `@ts-ignore` comments accumulate technical debt during migration
- **Learning curve**: Team members comfortable with dynamic JavaScript patterns must learn TypeScript idioms
- **Type definition gaps**: Some npm packages lack quality type definitions, requiring manual `@types` or declaration files

### Neutral
- **CI pipeline**: `tsc --noEmit` runs in CI to catch type errors; build step uses Babel for speed
- **Linting**: ESLint configured with `@typescript-eslint` for consistent code style
- **Documentation**: TypeScript types serve as API documentation for shared contracts

## References

- `backend/tsconfig.json` — Backend TypeScript configuration with `allowJs: true`
- `frontend/tsconfig.json` — Frontend TypeScript configuration
- `backend/package.json` — Babel and TypeScript build scripts
- `frontend/src/types/` — Shared type definitions
