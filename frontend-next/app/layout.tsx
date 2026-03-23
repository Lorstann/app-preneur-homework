import "./globals.css";

export const metadata = {
  title: "File Converter Hub",
  description: "3D-powered file conversion interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
