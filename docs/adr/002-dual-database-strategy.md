# ADR-002: Dual Database Strategy (PostgreSQL + MongoDB)

**Status**: Accepted

**Date**: 2024-07

**Deciders**: Core development team

## Context

AetherMint serves two distinct data workloads:

1. **Relational/transactional data**: User accounts, enrollments, course structures, credential records — data with strict schemas, relationships, and ACID requirements.
2. **Document/flexible data**: Course content, learning materials, analytics events, user-generated metadata — data with variable schemas, nested structures, and eventual-consistency tolerance.

Using a single database for both workloads would force compromises: either denormalizing relational data into documents (losing integrity guarantees) or forcing flexible content into rigid relational schemas (losing agility).

Additionally, a **caching layer** is needed for session management, rate limiting, and frequently-accessed data like user profiles and course metadata.

## Decision

We will use a **dual-database strategy** with a dedicated caching layer:

| Database | Purpose |
|----------|---------|
| **PostgreSQL** (primary) | User accounts, enrollments, credentials, courses — all relational/transactional data requiring ACID compliance |
| **MongoDB** (document store) | Course content, analytics events, learning materials, user activity logs — flexible-schema data |
| **Redis** (cache) | Session tokens, rate limiting, frequently-accessed queries, real-time analytics counters |
| **Neo4j** (graph — backend only) | Learning path recommendations, skill relationship graphs, social connections (available in backend services, not in local docker-compose) |

Specifically:
- PostgreSQL accessed via the **`pg`** driver for direct SQL queries
- MongoDB accessed via **`mongoose`** ODM for schema validation on flexible documents
- Redis via **`ioredis`** with connection pooling
- Neo4j via **`neo4j-driver`** for graph queries

## Alternatives Considered

### PostgreSQL-only
- **Pros**: Single database to operate, simpler infrastructure, ACID for all data
- **Cons**: JSONB columns for flexible content add query complexity, poor performance for analytics events at scale, no native graph traversal
- **Why rejected**: The learning analytics and content management workloads would strain a single relational database. JSONB queries are less ergonomic than native MongoDB document operations.

### MongoDB-only
- **Pros**: Flexible schema, good for content and analytics, horizontal scaling
- **Cons**: Weak relational integrity, no native JOINs for complex enrollment queries, transaction support less mature
- **Why rejected**: Credential verification and enrollment management require strong consistency and relational integrity that MongoDB's document model doesn't naturally provide.

### PostgreSQL + Elasticsearch
- **Pros**: Strong search capabilities for course discovery
- **Cons**: Additional infrastructure complexity, operational overhead of keeping indexes in sync
- **Why rejected**: The search requirements (course name, description, tags) are well-served by PostgreSQL's full-text search and MongoDB's text indexes. Elasticsearch adds complexity without proportional benefit at current scale.

## Consequences

### Positive
- **Workload-optimized**: Each database is chosen for its specific workload characteristics
- **Scalability**: MongoDB handles horizontal scaling for analytics; PostgreSQL handles vertical scaling for transactions
- **Developer ergonomics**: Direct SQL via `pg` gives full control over query optimization; Mongoose provides schema flexibility for content
- **Caching**: Redis reduces database load for hot paths (session validation, profile reads)

### Negative
- **Operational complexity**: Four databases to manage, monitor, backup, and secure
- **Data consistency**: No cross-database transactions; eventual consistency between PostgreSQL and MongoDB
- **Learning curve**: Team needs proficiency in SQL, MongoDB queries, Cypher (Neo4j), and Redis commands
- **Infrastructure cost**: Higher resource requirements in both development and production

### Neutral
- **Backup strategy**: Each database requires its own backup configuration (`scripts/backup-db.sh` for PostgreSQL, MongoDB snapshots, Redis AOF persistence)
- **Migrations**: PostgreSQL uses migration scripts (`backend/migrations/`); MongoDB uses schema versioning in Mongoose models
- **Monitoring**: Need database-specific metrics for each store

## References

- `docker-compose.yml` — service definitions for all databases
- `backend/package.json` — database driver dependencies
- `scripts/backup-db.sh` — PostgreSQL backup with S3 upload
