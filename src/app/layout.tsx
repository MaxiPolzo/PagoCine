import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Registro de Entrada - Feria Escolar",
  description: "Registro y validación de entradas para feria escolar",
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
