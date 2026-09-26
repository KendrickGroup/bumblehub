export default function HomeLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 pt-2" aria-hidden>
      <div className="h-16 w-52 rounded-2xl bg-[#EFE6D6]" />
      <div className="mt-3 h-6 w-24 rounded-full bg-[#EFE6D6]" />
      <div className="h-24 rounded-[20px] bg-[#EFE6D6]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-[20px] bg-[#EFE6D6]" />
        <div className="h-20 rounded-[20px] bg-[#EFE6D6]" />
      </div>
    </div>
  );
}
