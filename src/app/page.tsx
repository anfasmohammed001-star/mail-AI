'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { ContactsTab } from '@/components/dashboard/contacts-tab';
import { TemplatesTab } from '@/components/dashboard/templates-tab';
import { ComposeTab } from '@/components/dashboard/compose-tab';
import { InboxTab } from '@/components/dashboard/inbox-tab';
import { RulesTab } from '@/components/dashboard/rules-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { SettingsTab } from '@/components/dashboard/settings-tab';
import {
  LayoutDashboard,
  Users,
  FileText,
  Send,
  Inbox,
  Shield,
  ScrollText,
  Mail,
  Settings,
  Sun,
  Moon,
  Database,
  Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SidebarContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  mounted: boolean;
  onItemClick?: () => void;
}

function SidebarContent({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  mounted,
  onItemClick,
}: SidebarContentProps) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'compose', label: 'Compose', icon: Send },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'rules', label: 'Rules', icon: Shield },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
          <Mail className="w-4.5 h-4.5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight leading-none">MailAgent AI</h1>
          <p className="text-[10px] text-muted-foreground mt-1">Automation Dashboard</p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onItemClick) onItemClick();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t bg-muted/20 space-y-3">
        {/* Agent Status */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Agent Active</span>
          </div>
          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-500 bg-emerald-500/20 px-1.5 py-0.5 rounded">Local</span>
        </div>

        {/* DB & Theme Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-medium text-[11px]">Supabase Connected</span>
          </div>

          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-violet-600" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onNavigate={setActiveTab} />;
      case 'contacts':
        return <ContactsTab />;
      case 'templates':
        return <TemplatesTab />;
      case 'compose':
        return <ComposeTab />;
      case 'inbox':
        return <InboxTab />;
      case 'rules':
        return <RulesTab />;
      case 'logs':
        return <LogsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <OverviewTab onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-200">
      {/* Desktop Sidebar Navigation */}
      <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0 shrink-0 hidden md:flex">
        <SidebarContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          theme={theme}
          setTheme={setTheme}
          mounted={mounted}
        />
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-muted/20 h-screen overflow-y-auto">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Menu Trigger */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 flex flex-col h-full w-64 bg-card border-r">
                <SidebarContent
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  theme={theme}
                  setTheme={setTheme}
                  mounted={mounted}
                  onItemClick={() => setIsMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div>
              <h2 className="text-sm font-semibold capitalize text-muted-foreground">Dashboard</h2>
              <h3 className="text-lg font-bold tracking-tight capitalize mt-0.5">{activeTab}</h3>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-medium hidden sm:block">
            Local Time: {mounted ? new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {renderActiveContent()}
        </div>
      </main>
    </div>
  );
}