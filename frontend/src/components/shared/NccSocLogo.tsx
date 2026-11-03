import { cn } from '@/lib/utils';

interface NccSocLogoProps {
    size?: 'sm' | 'md';
    variant?: 'default' | 'white';
}

export function NccSocLogo({ size = 'md', variant = 'default' }: NccSocLogoProps) {
    return (
        <div className="flex flex-col leading-tight">
            <span
                className={cn(
                    'font-heading font-bold',
                    size === 'md' ? 'text-lg' : 'text-base',
                    variant === 'white' ? 'text-white' : 'text-grey-800'
                )}
            >
                NCC IT
            </span>
        </div>
    );
}
