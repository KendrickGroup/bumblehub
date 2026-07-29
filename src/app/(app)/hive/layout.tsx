import { Permanent_Marker, Rye } from "next/font/google";

const rye = Rye({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rye",
});

const marker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marker",
});

export default function HiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${rye.variable} ${marker.variable}`}>{children}</div>
  );
}
