import { Settings } from 'lucide-react';
import { FeatureStub } from '@/components/shared/FeatureStub';

export default function Page() {
    return (
        <FeatureStub
            domain="Account"
            title="Settings"
            description="Manage your organization's platform preferences and notification settings."
            icon={Settings}
            emptyTitle="Nothing to configure yet"
            emptyDescription="Organization settings will appear here."
            actionLabel="Configure"
        />
    );
}
