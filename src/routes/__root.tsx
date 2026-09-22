import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ActivityTracker } from "@/lib/activity-tracker";

import "../styles.css";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-strong rounded-2xl p-8">
        <h1 className="text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md gradient-bg px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ecomedic — Scientific Research on Disease & Drug Discovery" },
      { name: "description", content: "Ecomedic is a scientific research platform exploring disease mechanisms, drug discovery, and breakthrough medical innovations. Stay informed with the latest research publications." },
      { name: "author", content: "Ecomedic" },
      { name: "application-name", content: "Ecomedic" },
      { property: "og:title", content: "Ecomedic — Scientific Research on Disease & Drug Discovery" },
      { property: "og:description", content: "Ecomedic is a scientific research platform exploring disease mechanisms, drug discovery, and breakthrough medical innovations. Stay informed with the latest research publications." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Ecomedic" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ecomedic — Scientific Research on Disease & Drug Discovery" },
      { name: "twitter:description", content: "Ecomedic is a scientific research platform exploring disease mechanisms, drug discovery, and breakthrough medical innovations." },
      { property: "og:image", content: "https://plain-weur-prod-public.komododecks.com/202604/27/fr6ZybYCiboKOuJAjmUC/image.png" },
      { name: "twitter:image", content: "https://plain-weur-prod-public.komododecks.com/202604/27/fr6ZybYCiboKOuJAjmUC/image.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ActivityTracker />
          <Outlet />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
