'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/components/dashboard/overview-tab';
import { ContactsTab } from '@/components/dashboard/contacts-tab';
import { TemplatesTab } from '@/components/dashboard/templates-tab';
import { ComposeTab } from '@/components/dashboard/compose-tab';
import { InboxTab } from '@/components/dashboard/inbox-tab';
import { RulesTab } from '@/components/dashboard/rules-tab';
import { LogsTab } from '@/components/dashboard/logs-tab';
import { LayoutDashboard, Users, FileText, Send, Inbox, Shield, ScrollText, Mail } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight">MailAgent AI</h1>
                <p className="text-xs text-muted-foreground">Email Automation Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">Agent Active</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex overflow-x-auto bg-muted/50 p-1 h-auto gap-0.5 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="compose" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Send className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Compose</span>
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Inbox className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Inbox</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Rules</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ScrollText className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="contacts" className="mt-0">
            <ContactsTab />
          </TabsContent>
          <TabsContent value="templates" className="mt-0">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="compose" className="mt-0">
            <ComposeTab />
          </TabsContent>
          <TabsContent value="inbox" className="mt-0">
            <InboxTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-0">
            <RulesTab />
          </TabsContent>
          <TabsContent value="logs" className="mt-0">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>MailAgent AI — Local Email Automation</span>
          <span>Secure &bull; Encrypted &bull; Local</span>
        </div>
      </footer>
    </div>
  );
}