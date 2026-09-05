DROP INDEX account_categories_workspace_name_unique;
CREATE UNIQUE INDEX account_categories_workspace_profile_name_unique
  ON account_categories (workspace_id, profile_id, name);
