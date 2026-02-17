
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Bot,
  Plus,
  History,
  Users,
  BarChart,
  Settings,
  Target,
  Leaf,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chatbot', label: 'Chatbot', icon: Bot },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/progress-tracker', label: 'Tracker', icon: BarChart },
  { href: '/diet', label: 'Diet Plan', icon: Leaf },
  { href: '/challenges', label: 'Challenges', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();
  const { state, isMobile, setOpen } = useSidebar();

  const isChatbotRoute = pathname === '/chatbot';

  const handleNavItemClick = () => {
    // Close sidebar on mobile when navigation item is clicked
    if (isMobile) {
      setOpen(false);
    }
  };

  return (
    <SidebarMenu className={state === 'collapsed' ? 'p-2 items-center' : 'p-2'}>
      {navItems.map((item) => {
        const isChatbotItem = item.href === '/chatbot';
        return (
          <React.Fragment key={item.href}>
            <SidebarMenuItem>
              <Link href={item.href} onClick={handleNavItemClick}>
                <SidebarMenuButton
                  isActive={pathname === item.href}
                  tooltip={state === 'collapsed' ? item.label : undefined}
                  data-state={state}
                  className="data-[state=collapsed]:justify-center"
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className={`transition-all duration-300 ${state === 'collapsed' ? 'sr-only' : 'block'}`}>
                    {item.label}
                  </span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

            {isChatbotItem && isChatbotRoute ? (
              <>
                <SidebarMenuItem>
                  <Link href="/chatbot?tab=new" onClick={handleNavItemClick}>
                    <SidebarMenuButton
                      isActive={false}
                      tooltip={state === 'collapsed' ? 'New Chat' : undefined}
                      data-state={state}
                      className={
                        state === 'collapsed'
                          ? 'data-[state=collapsed]:justify-center'
                          : 'ml-6 h-9 text-sm text-muted-foreground hover:text-foreground'
                      }
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className={`transition-all duration-300 ${state === 'collapsed' ? 'sr-only' : 'block'}`}>
                        New Chat
                      </span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Link href="/chatbot?tab=history" onClick={handleNavItemClick}>
                    <SidebarMenuButton
                      isActive={false}
                      tooltip={state === 'collapsed' ? 'History' : undefined}
                      data-state={state}
                      className={
                        state === 'collapsed'
                          ? 'data-[state=collapsed]:justify-center'
                          : 'ml-6 h-9 text-sm text-muted-foreground hover:text-foreground'
                      }
                    >
                      <History className="h-4 w-4 shrink-0" />
                      <span className={`transition-all duration-300 ${state === 'collapsed' ? 'sr-only' : 'block'}`}>
                        History
                      </span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </>
            ) : null}
          </React.Fragment>
        );
      })}
    </SidebarMenu>
  );
}
