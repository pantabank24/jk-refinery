import { Fira_Code as FontMono } from "next/font/google";
import localFont from "next/font/local";

export const fontSans = localFont({
  src: [
    {
      path: "../public/fonts/LINESeedSansTH_A_Th.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/fonts/LINESeedSansTH_A_Rg.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/LINESeedSansTH_A_Bd.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/LINESeedSansTH_A_XBd.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/LINESeedSansTH_A_He.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});
