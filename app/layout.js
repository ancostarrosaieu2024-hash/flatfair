import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "FlatFair: split flat expenses with your roommates",
  description:
    "FlatFair helps university students living with roommates track shared expenses so they know who owes whom.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
