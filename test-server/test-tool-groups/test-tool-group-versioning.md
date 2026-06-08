# Test: Versioning (OCC)

## Scenario
You are managing an optimistic concurrency control system for the `testdb` database.

## Tasks

### 1. Enable Versioning
- Enable versioning on the `inventory` table using the `mysql_enable_versioning` tool.
- Verify the `_version` column is added and the trigger is created.

### 2. Check Version
- Check the current version of the item with `id = 1` in the `inventory` table using `mysql_check_version`.

### 3. Conditional Update (Success)
- Perform a conditional update on the `inventory` table for `id = 1`, setting `quantity` to 500, passing the version retrieved in the previous step as `expectedVersion`.
- Verify the operation succeeds and rows are affected.

### 4. Conditional Update (Conflict)
- Attempt to perform another conditional update on the `inventory` table for `id = 1`, using the OLD version you used in step 3.
- Verify the operation fails with a `Version conflict` error.

### 5. Disable Versioning
- Disable versioning on the `inventory` table using `mysql_disable_versioning`.
- Verify the `_version` column is dropped.
