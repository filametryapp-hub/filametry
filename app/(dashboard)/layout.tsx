import { Sidebar } from '@/components/layout/sidebar'
import { I18nProvider } from '@/lib/i18n'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </I18nProvider>
  )
}
