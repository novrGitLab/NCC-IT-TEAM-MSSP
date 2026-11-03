import type { LucideIcon } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';

interface FeatureStubProps {
    domain: string;
    title: string;
    description: string;
    icon: LucideIcon;
    emptyTitle: string;
    emptyDescription: string;
    actionLabel: string;
}

export function FeatureStub({ domain, title, description, icon, emptyTitle, emptyDescription, actionLabel }: FeatureStubProps) {
    return (
        <div>
            <PageHeader
                domain={domain}
                title={title}
                description={description}
                actions={
                    <button className="bg-orange hover:bg-orange-hover text-white font-semibold rounded-lg px-5 py-2.5 text-xs transition-colors">
                        {actionLabel}
                    </button>
                }
            />
            <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
        </div>
    );
}
