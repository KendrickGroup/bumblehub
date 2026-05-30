import { Bricolage_Grotesque, Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

export default function RecipesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${fraunces.variable} ${bricolage.variable} min-h-full bg-[#FAF8F3] font-[family-name:var(--font-bricolage)] text-stone-900`}
    >
      {children}
    </div>
  );
}
