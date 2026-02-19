import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
    subsets: ["latin", "cyrillic"],
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "Opinion Deal Calculator — Trade Simulator",
    description: "Calculate entry price, slippage, break-even, hedge parameters and bankroll risk for opinion.trade prediction markets",
    keywords: ["opinion", "prediction market", "deal calculator", "slippage", "hedge", "break-even"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable}>
            <body className="antialiased">
                {children}
            </body>
        </html>
    );
}
