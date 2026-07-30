import { IM_Fell_English_SC, Permanent_Marker, Rye, Special_Elite } from "next/font/google";

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

const elite = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-elite",
});

const fellSc = IM_Fell_English_SC({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fell-sc",
});

export default function HiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${rye.variable} ${marker.variable} ${elite.variable} ${fellSc.variable}`}
    >
      {children}
    </div>
  );
}
