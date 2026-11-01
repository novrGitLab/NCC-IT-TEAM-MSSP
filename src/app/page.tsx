import Link from 'next/link';

// NCC SOC landing page — deliberately minimal per the extraction brief: pure white
// background, centered title, a single blue Login CTA. No marketing sections.

export default function Home() {
    return (
        <main className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="flex flex-col items-center text-center gap-8">
                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-[#0F172A]">
                    NCC SOC
                </h1>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-8 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#153F83]"
                >
                    Login
                </Link>
            </div>
        </main>
    );
}
