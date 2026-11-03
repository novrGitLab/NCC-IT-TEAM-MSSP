// NCC IT rebrand (2026-10-31): the source app's logo was a baked-in raster wordmark
// image ("NOVRSOC by CYBERNOVR", novrsoc.jpg). No image-generation tooling is available in
// this extraction pass, so the brand mark is a text wordmark instead — flagged here rather
// than silently left showing the old brand's image.
const SIZES = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
} as const;

export function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
    return (
        <span className={`${SIZES[size]} font-extrabold tracking-tight text-[#2563EB] flex-shrink-0`}>
            NCC IT
        </span>
    );
}
