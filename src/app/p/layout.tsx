import { Rye } from "next/font/google";

const rye = Rye({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-rye",
});

export default function PublicPortraitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${rye.variable} min-h-dvh font-sans`}>{children}</div>
  );
}
