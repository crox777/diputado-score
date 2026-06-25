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
  title: "DiputadoScore — Asistencia y votaciones de la Asamblea Legislativa",
  description:
    "Calificación de asistencia al plenario y participación en votaciones de los 57 diputados de Costa Rica (2026–2030), calculada a partir del registro legislativo público. Proyecto independiente.",
  keywords: ["diputados", "Costa Rica", "transparencia", "asistencia", "votaciones", "Asamblea Legislativa"],
  openGraph: {
    title: "DiputadoScore",
    description: "Asistencia al plenario y participación en votaciones, calculadas del registro público. Score 1–10.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0c0e] text-white">{children}</body>
    </html>
  );
}
