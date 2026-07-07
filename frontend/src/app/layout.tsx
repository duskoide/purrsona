import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavigationBar } from "@/components/NavigationBar";

export const metadata: Metadata = {
  title: "Purrsona — Community Cat Tracker",
  description: "Track and document community cats in your area",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavigationBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
