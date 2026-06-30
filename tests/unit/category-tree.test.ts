import { describe, it, expect } from "vitest";
import { buildCategoryTree } from "@/lib/data/menus";

const cat = (id: string, name: string, sort_order = 0, parent_id: string | null = null) => ({
  id,
  name,
  sort_order,
  parent_id,
});

describe("buildCategoryTree", () => {
  it("returns top-level categories with empty children when there are no sub-categories", () => {
    const tree = buildCategoryTree([cat("a", "Mains"), cat("b", "Drinks")], []);
    expect(tree).toEqual([
      { id: "a", name: "Mains", sort_order: 0, parent_id: null, children: [] },
      { id: "b", name: "Drinks", sort_order: 0, parent_id: null, children: [] },
    ]);
  });

  it("groups sub-categories under their parent (preserving input order)", () => {
    const tree = buildCategoryTree(
      [cat("mains", "Mains"), cat("drinks", "Drinks")],
      [cat("burgers", "Burgers", 0, "mains"), cat("steaks", "Steaks", 1, "mains")]
    );
    expect(tree).toHaveLength(2);
    const mains = tree.find((c) => c.id === "mains")!;
    expect(mains.children.map((c) => c.name)).toEqual(["Burgers", "Steaks"]);
    expect(mains.children.every((c) => c.children)).toBe(true);
    expect(mains.children.every((c) => c.children.length === 0)).toBe(true);
  });

  it("gives an empty children array to parents without sub-categories", () => {
    const tree = buildCategoryTree(
      [cat("mains", "Mains"), cat("drinks", "Drinks")],
      [cat("burgers", "Burgers", 0, "mains")]
    );
    expect(tree.find((c) => c.id === "drinks")!.children).toEqual([]);
  });

  it("ignores sub-categories whose parent is not in the top-level list", () => {
    const tree = buildCategoryTree([cat("mains", "Mains")], [
      cat("orphan", "Orphan", 0, "missing"),
    ]);
    expect(tree[0].children).toEqual([]);
  });

  it("preserves the provided order (rows are assumed pre-sorted)", () => {
    const tree = buildCategoryTree(
      [cat("a", "A", 0), cat("b", "B", 1)],
      [cat("s1", "S1", 0, "a"), cat("s2", "S2", 1, "a")]
    );
    expect(tree.map((c) => c.id)).toEqual(["a", "b"]);
    expect(tree[0].children.map((c) => c.id)).toEqual(["s1", "s2"]);
  });
});
