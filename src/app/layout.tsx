import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ServiceWorkerRegistrar } from "@/components/layout/service-worker";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LÍA", template: "%s · LÍA" },
  description: "LÍA — Life Operating System. Tu Chief of Staff personal.",
  applicationName: "LÍA",
  appleWebApp: { capable: true, title: "LÍA", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

/** Resolves the theme before first paint so there is no flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('lia-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
