import React from 'react';

interface PageHeaderProps {
    domain: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ domain, title, description, actions }: PageHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
                <p className="text-xs text-foreground-muted mb-1">
                    {domain} <span className="mx-1 text-border">/</span> {title}
                </p>
                <h1 className="font-heading font-bold text-xl text-foreground">{title}</h1>
                {description && <p className="text-sm text-foreground-muted mt-1">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
        </div>
    );
}
