const LEGEND = [
    { color: '#CC2B2B', label: 'Critical' },
    { color: '#FF5500', label: 'High' },
    { color: '#7B2FBE', label: 'Medium' },
    { color: '#5B0095', label: 'Low' },
];

const STATS = [
    { value: '220+', label: 'Events Indexed' },
    { value: '37', label: 'States Monitored' },
    { value: '2', label: 'Active Agents' },
];

// Right-panel brand visual for both login pages (admin + client) — a stylized Nigeria state
// grid (not the real geographic map used on the dashboard; see components/geo/NigeriaMap2.tsx
// for that), just a decorative, always-renders-the-same visual for the auth screens.
export function NigeriaLoginMap() {
    return (
        <div className="hidden lg:flex w-3/5 bg-purple flex-col justify-between p-16 relative overflow-hidden min-h-screen">

            {/* Background grid pattern */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }}
            />

            {/* Top — tagline */}
            <div>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
                    <span className="text-white/70 text-xs font-medium tracking-wide">
                        Live threat monitoring active
                    </span>
                </div>
                <h2 className="text-white font-black text-4xl leading-tight mb-3 tracking-tight">
                    Africa&rsquo;s Intelligence-<br />Driven SOC Platform
                </h2>
                <p className="text-white/50 text-sm leading-relaxed max-w-sm">
                    Real-time threat detection across all 37 Nigerian states.
                    Monitor, detect, and respond — all from one dashboard.
                </p>
            </div>

            {/* Center — Nigeria Map SVG */}
            <div className="flex-1 flex items-center justify-center py-10 relative">

                {/* Glow behind map */}
                <div className="absolute w-80 h-80 bg-white/5 rounded-full blur-3xl" />

                {/* Nigeria SVG map */}
                <div className="relative w-full max-w-lg">
                    <svg viewBox="0 0 500 460" xmlns="http://www.w3.org/2000/svg" className="w-full">

                        {/* State rectangles — arranged geographically */}
                        {/* NORTH WEST */}
                        <rect x="30" y="20" width="80" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="70" y="51" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">SK</text>

                        <rect x="30" y="80" width="80" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="70" y="111" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KB</text>

                        <rect x="115" y="20" width="85" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="157" y="51" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">ZM</text>

                        <rect x="115" y="80" width="85" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="157" y="111" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KT</text>

                        <rect x="175" y="120" width="85" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="217" y="151" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KN</text>

                        <rect x="205" y="60" width="75" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="242" y="91" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">JI</text>

                        <rect x="125" y="140" width="85" height="60" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="167" y="174" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KD</text>

                        {/* NORTH EAST */}
                        <rect x="290" y="20" width="100" height="85" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="340" y="66" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">BO</text>

                        <rect x="285" y="110" width="80" height="55" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="325" y="141" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">YO</text>

                        <rect x="285" y="170" width="80" height="75" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="325" y="211" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">AD</text>

                        <rect x="240" y="120" width="75" height="50" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="277" y="149" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">GM</text>

                        <rect x="205" y="170" width="90" height="60" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="250" y="204" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">BA</text>

                        <rect x="285" y="250" width="80" height="65" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="325" y="286" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">TA</text>

                        {/* NORTH CENTRAL */}
                        <rect x="30" y="140" width="90" height="75" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="75" y="181" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">NI</text>

                        <rect x="40" y="220" width="80" height="60" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="80" y="254" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KW</text>

                        <rect x="120" y="235" width="75" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="157" y="266" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">KO</text>

                        <rect x="195" y="235" width="55" height="50" rx="4" fill="#FF5500" stroke="white" strokeWidth="2" opacity="0.9" />
                        <text x="222" y="264" textAnchor="middle" fontSize="7" fill="white" fontWeight="800">FCT</text>

                        <rect x="200" y="205" width="80" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="240" y="236" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">NA</text>

                        <rect x="205" y="175" width="80" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="245" y="206" textAnchor="middle" fontSize="7" fill="white" fontWeight="600">BE</text>

                        {/* SOUTH WEST — Lagos highlighted HIGH */}
                        <rect x="30" y="310" width="70" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="65" y="341" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">OG</text>

                        <rect x="30" y="370" width="65" height="50" rx="4" fill="#FF5500" stroke="white" strokeWidth="2.5" />
                        <text x="62" y="399" textAnchor="middle" fontSize="8" fill="white" fontWeight="800">LA</text>

                        <rect x="80" y="280" width="85" height="65" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="122" y="316" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">OY</text>

                        <rect x="120" y="310" width="65" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="152" y="341" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">OS</text>

                        <rect x="155" y="280" width="60" height="55" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="185" y="311" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">EK</text>

                        <rect x="120" y="360" width="75" height="60" rx="4" fill="#6B1FA8" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="157" y="394" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">ON</text>

                        {/* SOUTH EAST */}
                        <rect x="215" y="295" width="65" height="55" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="247" y="326" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">EN</text>

                        <rect x="185" y="345" width="65" height="50" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="217" y="374" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">AN</text>

                        <rect x="185" y="395" width="60" height="50" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="215" y="424" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">IM</text>

                        <rect x="245" y="345" width="65" height="55" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="277" y="376" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">AB</text>

                        <rect x="245" y="280" width="65" height="55" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="277" y="311" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">EB</text>

                        {/* SOUTH SOUTH */}
                        <rect x="310" y="295" width="75" height="65" rx="4" fill="#CC2B2B" stroke="white" strokeWidth="2.5" />
                        <text x="347" y="331" textAnchor="middle" fontSize="8" fill="white" fontWeight="800">RI</text>

                        <rect x="195" y="395" width="65" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="227" y="426" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">BY</text>

                        <rect x="150" y="390" width="65" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="182" y="421" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">DE</text>

                        <rect x="175" y="295" width="65" height="55" rx="4" fill="#5B0095" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="207" y="326" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">ED</text>

                        <rect x="310" y="360" width="75" height="65" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="347" y="396" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">CR</text>

                        <rect x="245" y="395" width="65" height="55" rx="4" fill="#7B2FBE" stroke="white" strokeWidth="1.5" opacity="0.8" />
                        <text x="277" y="426" textAnchor="middle" fontSize="8" fill="white" fontWeight="600">AK</text>

                        {/* Threat pulse overlays for active states */}
                        <circle cx="62" cy="395" r="20" fill="#FF5500" opacity="0.2">
                            <animate attributeName="r" from="15" to="30" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                        </circle>

                        <circle cx="347" cy="325" r="20" fill="#CC2B2B" opacity="0.2">
                            <animate attributeName="r" from="15" to="30" dur="1.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.3" to="0" dur="1.5s" repeatCount="indefinite" />
                        </circle>

                        <circle cx="340" cy="60" r="25" fill="#CC2B2B" opacity="0.15">
                            <animate attributeName="r" from="20" to="40" dur="2.5s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.25" to="0" dur="2.5s" repeatCount="indefinite" />
                        </circle>

                    </svg>

                    {/* Legend */}
                    <div className="absolute bottom-0 right-0 bg-black/30 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                        <div className="text-white/50 text-[9px] uppercase tracking-wider mb-2">Threat Level</div>
                        {LEGEND.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: item.color }} />
                                <span className="text-white/60 text-[9px]">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Bottom — live stats */}
            <div className="grid grid-cols-3 gap-4">
                {STATS.map((stat) => (
                    <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <div className="font-black text-2xl text-white mb-0.5">{stat.value}</div>
                        <div className="text-white/40 text-[10px] uppercase tracking-wide">{stat.label}</div>
                    </div>
                ))}
            </div>

        </div>
    );
}
