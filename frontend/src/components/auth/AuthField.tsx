import type { InputHTMLAttributes } from 'react';

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: boolean;
}

export function AuthField({ label, error, className, ...props }: AuthFieldProps) {
    return (
        <div>
            <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wider block mb-1.5">
                {label}
            </label>
            <input
                {...props}
                className={`w-full border rounded-xl px-4 py-3.5 text-sm bg-white text-foreground placeholder:text-grey-300 focus:outline-none focus:ring-2 focus:ring-purple/10 focus:border-purple transition-all ${
                    error ? 'border-red' : 'border-border'
                } ${className ?? ''}`}
            />
        </div>
    );
}
