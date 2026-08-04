export default function Loading() {
  return (
    <main
      className="flex min-h-[55vh] items-center justify-center bg-white px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative h-16 w-12 animate-[sclero-loader-float_1.5s_ease-in-out_infinite]" aria-hidden="true">
          <div className="absolute inset-0 rounded-[50%_50%_48%_48%/58%_58%_42%_42%] border-[7px] border-[#101871]" />
          <div className="absolute inset-[10px] rounded-[50%_50%_48%_48%/58%_58%_42%_42%] bg-[radial-gradient(circle_at_48%_30%,#fffdf7_0%,#fff8e8_22%,#f6a62b_61%,#df7b16_100%)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.7)]" />
          <span className="absolute -right-1 top-1 h-3 w-3 animate-ping rounded-full bg-[#f6a62b] opacity-70" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#101871]">Loading Sclero Proteins</p>
      </div>
    </main>
  );
}
