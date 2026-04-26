import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BCM Dashboard",
  description: "Construction project management for BCM Construction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply theme before hydration to avoid a flash of the wrong mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try { if (localStorage.getItem('bcm-theme') === 'light') { document.documentElement.classList.add('bcm-light'); } } catch (e) {}`,
          }}
        />
      </head>
      <body className="h-full overflow-hidden bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
