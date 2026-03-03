import "kingschat-web-sdk/dist/stylesheets/style.min.css";
import "./globals.css";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "Prime Ops — Operations Management Platform",
  description:
    "Smart project proposal generation and committee management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-50">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
