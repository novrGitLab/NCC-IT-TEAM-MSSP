import { ShieldCheck, Radar, FileBarChart } from 'lucide-react';

const FEATURES = [
    { icon: Radar, label: 'Vulnerability Management' },
    { icon: ShieldCheck, label: 'Security Operations' },
    { icon: FileBarChart, label: 'Threat Intelligence & Reporting' },
];

// Right-panel brand visual for both login pages (admin + client) — a simple, static panel, no
// live-looking counters or claims about active monitoring.
export function NigeriaLoginMap() {
    return (
        <div className="hidden lg:flex w-3/5 bg-purple flex-col justify-center p-16 relative overflow-hidden min-h-screen">
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />
            <div className="relative max-w-md">
                <h2 className="text-white font-black text-4xl leading-tight mb-4 tracking-tight">
                    Security Operations, Vulnerability Management &amp; Threat Intelligence
                </h2>
                <p className="text-white/60 text-sm leading-relaxed mb-8">
                    One platform for monitoring, investigating and reporting on your organization&apos;s security posture.
                </p>
                <div className="space-y-3">
                    {FEATURES.map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                            <Icon className="w-4 h-4 text-white/70" aria-hidden />
                            <span className="text-white/80 text-sm font-medium">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
