import { Bricolage_Grotesque, Fraunces } from "next/font/google";
import "./landing.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${fraunces.variable} ${bricolage.variable} landing-page`}
    >
      {children}
    </div>
  );
}
