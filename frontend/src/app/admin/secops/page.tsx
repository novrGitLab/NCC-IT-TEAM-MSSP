import { SecOpsOverview } from '@/components/features/SecOpsOverview';

export default function Page() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-black text-foreground">SOC Overview</h1>
                <p className="text-xs text-foreground-muted">Alerts, cases, automated decisions and pending approvals from the shared SOC records.</p>
            </div>
            <SecOpsOverview />
        </div>
    );
}
