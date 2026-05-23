# Database Migrations

These SQL files provide a starter schema for tracking curriculum programs, downloadable resources, and shared repository documents.

Apply migrations in this order:
1. `001_create_curriculum_tables.sql`
2. `002_seed_curriculum_programs.sql`
3. `003_create_shared_resource_tables.sql`
4. `004_seed_shared_resources.sql`

For sqlite shell usage, `database/init.sql` chains the migration files in order.
