import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Members", href: "/members" },
  { label: "Classes", href: "/classes" },
  { label: "Settings", href: "/settings" },
];

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 — Route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <Dumbbell className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="text-8xl font-black text-muted-foreground/30 mb-2" aria-hidden="true">404</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-2">
          The page <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">{location.pathname}</code> does not exist.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          It may have been moved, deleted, or you may have typed the address incorrectly.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Button onClick={() => window.history.back()} variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
          </Button>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Home
            </Link>
          </Button>
        </div>

        <div className="text-left border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Links</span>
          </div>
          <ul>
            {QUICK_LINKS.map(({ label, href }) => (
              <li key={href} className="border-b border-border last:border-0">
                <Link
                  to={href}
                  className="flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {label}
                  <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
