import { Link } from "@tanstack/react-router";
import { siteConfig } from "@/lib/config/site-config";

const LINK_CLASS =
  "inline-block py-2 px-1 font-medium text-muted-foreground hover:text-secondary underline-offset-2 hover:underline";

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t-2 border-border bg-card/50 px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-sm sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl italic tracking-tight text-secondary">
            GameNight
          </span>
          <span className="text-muted-foreground">© {year}</span>
        </div>
        <nav aria-label="Legal and contact">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <li>
              <Link to="/privacy" className={LINK_CLASS}>
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/terms" className={LINK_CLASS}>
                Terms
              </Link>
            </li>
            <li>
              <a href={`mailto:${siteConfig.contactEmail}`} className={LINK_CLASS}>
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
