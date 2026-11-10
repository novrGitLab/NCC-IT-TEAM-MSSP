// Official Nigerian Communications Commission logo, used unmodified (original 860x602 artwork). Height
// is fixed and width follows the artwork's own aspect ratio, so the emblem is never stretched or cropped.
// A white plate keeps the artwork legible on dark backgrounds.
const SIZES = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
} as const;

export function Logo({ size = 'md' }: { size?: keyof typeof SIZES }) {
    return (
        <span className="inline-flex w-fit self-start flex-shrink-0 items-center rounded-md bg-white p-1 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset; keeps the exact artwork without re-encoding */}
            <img
                src="/brand/ncc-logo.jpg"
                alt="Nigerian Communications Commission (NCC) logo"
                className={`${SIZES[size]} w-auto object-contain`}
            />
        </span>
    );
}
