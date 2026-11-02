'use client';

import { NccSocLogo } from '@/components/shared/NccSocLogo';
import { cn } from '@/lib/utils';

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

interface Service {
    name: string;
    status: ServiceStatus;
    uptime: string;
}

const SERVICES: Service[] = [
    { name: 'API Gateway', status: 'operational', uptime: '99.98%' },
    { name: 'endpoint manager', status: 'operational', uptime: '99.95%' },
    { name: 'OpenSearch / Indexer', status: 'operational', uptime: '99.92%' },
    { name: 'PostgreSQL Database', status: 'operational', uptime: '100%' },
    { name: 'Authentication', status: 'operational', uptime: '99.99%' },
    { name: 'Intelligence Feed', status: 'degraded', uptime: '98.10%' },
    { name: 'Alert Notifications', status: 'operational', uptime: '99.87%' },
    { name: 'Sensor Pipeline', status: 'operational', uptime: '99.93%' },
];

const STATUS_CONFIG: Record<ServiceStatus, { label: string; color: string; dot: string }> = {
    operational: { label: 'Operational', color: 'text-blue', dot: 'bg-blue' },
    degraded: { label: 'Degraded', color: 'text-red', dot: 'bg-red' },
    outage: { label: 'Outage', color: 'text-red', dot: 'bg-red animate-pulse' },
    maintenance: { label: 'Maintenance', color: 'text-purple', dot: 'bg-purple' },
};

export default function StatusPage() {
    const allOperational = SERVICES.every((s) => s.status === 'operational');

    return (
        <div className="min-h-screen bg-grey-50">
            <header className="bg-white border-b border-grey-100">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <NccSocLogo />
                    <a href="/" className="text-sm text-grey-500 hover:text-blue transition-colors">
                        ← Back to NCC SOC
                    </a>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <div
                    className={cn(
                        'rounded-2xl p-8 mb-8 text-center border',
                        allOperational ? 'bg-blue/5 border-blue/20' : 'bg-red/5 border-red/20'
                    )}
                >
                    <div className={cn('w-4 h-4 rounded-full mx-auto mb-3', allOperational ? 'bg-blue' : 'bg-red animate-pulse')} />
                    <h1 className="font-heading font-bold text-2xl text-grey-800 mb-1">
                        {allOperational ? 'All Systems Operational' : 'Partial Service Disruption'}
                    </h1>
                    <p className="text-sm text-grey-500">Last updated: {new Date().toUTCString()}</p>
                </div>

                <div className="bg-white border border-grey-100 rounded-xl overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-grey-100">
                        <h2 className="font-heading font-semibold text-base text-grey-800">Platform Services</h2>
                    </div>
                    <div className="divide-y divide-grey-100">
                        {SERVICES.map((service) => {
                            const cfg = STATUS_CONFIG[service.status];
                            return (
                                <div key={service.name} className="flex items-center justify-between px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
                                        <span className="text-sm font-medium text-grey-800">{service.name}</span>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="text-xs text-grey-500">{service.uptime} uptime</span>
                                        <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white border border-grey-100 rounded-xl p-6 mb-8">
                    <h2 className="font-heading font-semibold text-base text-grey-800 mb-4">90-Day Uptime</h2>
                    <div className="space-y-4">
                        {SERVICES.slice(0, 4).map((service) => (
                            <div key={service.name}>
                                <div className="flex justify-between text-xs text-grey-500 mb-1.5">
                                    <span>{service.name}</span>
                                    <span>{service.uptime}</span>
                                </div>
                                <div className="flex gap-0.5">
                                    {Array.from({ length: 90 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn('flex-1 h-6 rounded-sm', service.status === 'degraded' && i === 88 ? 'bg-red' : 'bg-blue/20')}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-center text-xs text-grey-500">NCC SOC Status Page</p>
            </main>
        </div>
    );
}
