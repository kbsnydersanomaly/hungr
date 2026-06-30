/**
 * A category tree node.
 *
 * Categories support a single level of nesting: a top-level category may have
 * sub-categories (`children`), but sub-categories cannot have their own
 * children. `children` is always empty for sub-categories.
 */
export interface CategoryNode {
  id: string;
  name: string;
  sort_order: number;
  parent_id: string | null;
  children: CategoryNode[];
}
