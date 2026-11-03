'use client';

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
        {children}
    </NextThemesProvider>
);

// Thin re-export so existing/future imports of `useTheme` from this module keep working
// without every consumer needing to know it's backed by next-themes under the hood.
export const useTheme = useNextTheme;
