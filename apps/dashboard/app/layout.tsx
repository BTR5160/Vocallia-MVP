import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2>Vocallia MVP</h2>
            <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link href="/">Dashboard</Link>
            </nav>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
