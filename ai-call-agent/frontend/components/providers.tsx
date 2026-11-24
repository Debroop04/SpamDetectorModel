'use client';

import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';
import { AppPrompt } from '@/components/app-prompt';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig value={{ fetcher, revalidateOnFocus: true, shouldRetryOnError: false, keepPreviousData: true }}>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
          <AppPrompt />
        </ToastProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
