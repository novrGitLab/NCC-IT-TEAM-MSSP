'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportPageAsPDF } from '@/lib/exportPDF';

interface ExportButtonProps {
    elementId: string;
    filename: string;
    title: string;
}

export function ExportButton({ elementId, filename, title }: ExportButtonProps) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            await exportPageAsPDF(elementId, filename, title);
        } finally {
            setExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 border border-purple text-purple text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple/5 disabled:opacity-50 transition-colors flex-shrink-0"
        >
            <Download size={14} className={exporting ? 'animate-bounce' : ''} />
            {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
    );
}
