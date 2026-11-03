import { Suspense } from 'react';
import { AiRemediationPage } from '@/components/features/vms/AiRemediationPage';

export default function Page() {
    return (
        <Suspense>
            <AiRemediationPage />
        </Suspense>
    );
}
