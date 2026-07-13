import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus } from "lucide-react";
import type { Database } from "@/lib/database.types";

export type RestaurantCardData = Pick<
  Database["public"]["Tables"]["restaurants"]["Row"],
  "id" | "name" | "slug" | "status" | "street" | "city" | "province"
>;

const quickLinks = [
  { label: "Menus", path: "menus" },
  { label: "Branding", path: "branding" },
  { label: "Reviews", path: "reviews" },
];

export function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  const base = `/restaurants/${restaurant.id}`;
  const address = [restaurant.street, restaurant.city, restaurant.province]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="relative hover:border-primary/50 transition-colors h-full">
      <Link
        href={base}
        aria-label={`View ${restaurant.name}`}
        className="absolute inset-0 rounded-xl"
      >
        <span className="sr-only">View restaurant</span>
      </Link>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">{restaurant.name}</CardTitle>
          <Badge variant={restaurant.status === "active" ? "default" : "secondary"}>
            {restaurant.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {address && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {address}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Slug: /m/{restaurant.slug}
        </p>
      </CardContent>
      <CardFooter className="relative z-10 gap-4 py-3 text-xs">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            href={`${base}/${link.path}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </CardFooter>
    </Card>
  );
}

export function AddRestaurantCard() {
  return (
    <Link href="/restaurants/new" className="block h-full">
      <Card className="h-full items-center justify-center border-dashed hover:border-primary/50 transition-colors min-h-32">
        <CardContent className="flex flex-col items-center gap-2 text-center py-8">
          <Plus className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">Add restaurant</span>
          <span className="text-xs text-muted-foreground">
            Create another location
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
