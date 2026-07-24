import { BrandMark } from "@/components/brand/BrandMark";

type StubPageProps = {
  title: string;
  description: string;
};

export function StubPage({ title, description }: StubPageProps) {
  return (
    <div className="px-2 py-6 sm:px-0">
      <BrandMark beeHeight={28} wordmarkHeight={18} />
      <h1
        className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl font-semibold text-stone-900"
        style={{ fontVariationSettings: '"opsz" 72' }}
      >
        {title}
      </h1>
      <p className="mt-4 max-w-lg text-base text-stone-600">{description}</p>
      <div className="mt-8 rounded-[20px] border border-dashed border-stone-200 bg-white px-6 py-12 text-center text-stone-500 shadow-sm">
        Coming soon
      </div>
    </div>
  );
}
