import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, onAction }: EmptyStateProps) {
    const actionClasses = 'text-xs font-bold px-4 py-2 bg-orange hover:bg-orange-hover text-white rounded-lg transition-colors';
    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F1F6FF] flex items-center justify-center mb-4">
                <Icon size={20} strokeWidth={1.5} className="text-purple" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
            {description && <p className="text-xs text-foreground-muted max-w-sm mb-4">{description}</p>}
            {actionLabel && (
                actionHref ? (
                    <Link href={actionHref} className={actionClasses}>{actionLabel}</Link>
                ) : (
                    <button onClick={onAction} className={actionClasses}>{actionLabel}</button>
                )
            )}
        </div>
    );
}
