import { cn } from '@/lib/utils';

interface NovaSOCLogoProps {
    size?: 'sm' | 'md';
    variant?: 'default' | 'white';
}

export function NovaSOCLogo({ size = 'md', variant = 'default' }: NovaSOCLogoProps) {
    return (
        <div className="flex flex-col leading-tight">
            <span
                className={cn(
                    'font-heading font-bold',
                    size === 'md' ? 'text-lg' : 'text-base',
                    variant === 'white' ? 'text-white' : 'text-grey-800'
                )}
            >
                NovaSOC NCC
            </span>
            <span className={cn('text-[10px] font-medium -mt-0.5', variant === 'white' ? 'text-white/60' : 'text-purple')}>
                demonstration edition
            </span>
        </div>
    );
}
