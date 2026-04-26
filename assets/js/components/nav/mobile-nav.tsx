import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface MobileNavLink {
  label: string;
  to: "/dashboard" | "/games";
}

export interface MobileNavProps {
  links: MobileNavLink[];
}

/**
 * Hamburger + Sheet used below the `sm` breakpoint. Collapses the
 * primary nav links (Dashboard, All Games) into a full-height side
 * sheet; the brand + user menu stay visible in the header. Each
 * link closes the sheet on click so returning-to-nav after a route
 * change doesn't require a second tap.
 */
export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  if (links.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          aria-label="Open navigation menu"
          data-testid="mobile-nav-trigger"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px]">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1 px-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
              activeProps={{ "aria-current": "page" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
