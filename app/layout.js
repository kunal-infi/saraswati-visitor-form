import "./globals.css";
import { MuseoModerno } from "next/font/google";

const museo = MuseoModerno({
  subsets: ["latin"],
  weight: ["100", "300", "500", "700", "900"],
});

export const metadata = {
  title: "Visitor Registration | Saraswati Global School",
  description: "Pre-register your visit to Saraswati Global School and generate your visitor QR code.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={museo.className}>{children}</body>
    </html>
  );
}
