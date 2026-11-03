import React from 'react';

interface ChartWrapperProps {
    title: string;
    height?: string;
    children: React.ReactNode;
}

export const ChartWrapper = ({ title, height = "h-64", children }: ChartWrapperProps) => {
    return (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground-muted text-xs tracking-wide uppercase">{title}</h3>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                    </span>
                    <span className="text-[10px] text-foreground-muted font-semibold">Live</span>
                </div>
            </div>
            <div className={`${height} w-full p-5 relative overflow-hidden bg-card`}>
                {children}
            </div>
        </div>
    );
};
