"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TabId } from "@/app/[[...tab]]/page";
import {
  ShieldCheck,
  Wallet,
  SplitSquareHorizontal,
  Braces,
  FileCode2,
  GanttChart,
  KeyRound,
  Webhook,
  ScanSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  X,
} from "lucide-react";
import { ThemeSelector } from "@/components/theme-selector";
import { canUseFeature, type OpsAccess } from "@/constants/ops-tools";

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const navItems: NavItem[] = [
  {
    id: "auth",
    label: "Auth",
    icon: <ShieldCheck className="h-4 w-4 shrink-0 text-warning" />,
    group: "Authentication",
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: <Wallet className="h-4 w-4 shrink-0 text-success" />,
    group: "Authentication",
  },
  {
    id: "delimiters",
    label: "Delimiters",
    icon: <SplitSquareHorizontal className="h-4 w-4 shrink-0 text-info" />,
    group: "Dev Tools",
  },
  {
    id: "json",
    label: "JSON to String",
    icon: <Braces className="h-4 w-4 shrink-0 text-info" />,
    group: "Dev Tools",
  },
  {
    id: "env",
    label: "ENV Converter",
    icon: <FileCode2 className="h-4 w-4 shrink-0 text-info" />,
    group: "Dev Tools",
  },
  {
    id: "gantt",
    label: "Gantt to CSV",
    icon: <GanttChart className="h-4 w-4 shrink-0 text-info" />,
    group: "Dev Tools",
  },
  {
    id: "apikey",
    label: "API Key Generator",
    icon: <KeyRound className="h-4 w-4 shrink-0 text-info" />,
    group: "Dev Tools",
  },
  {
    id: "webhook-replay",
    label: "Webhook Replay",
    icon: <Webhook className="h-4 w-4 shrink-0 text-warning" />,
    group: "Ops Tools",
  },
  {
    id: "nft-ownership",
    label: "NFT Ownership Check",
    icon: <ScanSearch className="h-4 w-4 shrink-0 text-info" />,
    group: "Ops Tools",
  },
  {
    id: "access-control",
    label: "Access Control",
    icon: <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />,
    group: "Ops Tools",
  },
];

// จำสถานะยุบ/ขยายของแต่ละกลุ่มเมนูไว้ใน localStorage (เก็บเฉพาะกลุ่มที่ "ยุบ")
const COLLAPSED_GROUPS_KEY = "sidebar-collapsed-groups";

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : []);
  } catch {
    return new Set();
  }
}

function writeCollapsedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(groups)));
  } catch {
    // ignore (private mode / storage blocked)
  }
}

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  email: string;
  opsAccess: OpsAccess | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  email,
  opsAccess,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  // Ops Tools: each item needs a grant from Access Control; "access-control" itself is admin-only
  const visibleItems = navItems.filter((item) => {
    if (item.group !== "Ops Tools") return true;
    if (item.id === "access-control") return opsAccess?.role === "admin";
    return canUseFeature(opsAccess, item.id);
  });
  const groups = Array.from(new Set(visibleItems.map((item) => item.group)));

  // กลุ่มเมนูที่ถูกยุบอยู่ — อ่านจาก localStorage หลัง mount เพื่อเลี่ยง hydration mismatch
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setCollapsedGroups(readCollapsedGroups());
  }, []);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      writeCollapsedGroups(next);
      return next;
    });
  };

  // ถ้า tab ที่ active อยู่ในกลุ่มที่ยุบไว้ ให้ขยายกลุ่มนั้นออกมาเสมอ จะได้ไม่ซ่อนเมนูที่กำลังใช้อยู่
  const activeGroup = navItems.find((item) => item.id === activeTab)?.group;
  useEffect(() => {
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      writeCollapsedGroups(next);
      return next;
    });
  }, [activeGroup]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, onMobileClose]);

  const handleTabChange = (tab: TabId) => {
    onTabChange(tab);
    onMobileClose();
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn("border-b border-border", collapsed ? "p-3 flex justify-center" : "p-5")}>
        <div className="flex items-center gap-3">
          <Image
            src="/maxion-logo.webp"
            alt="Maxion"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover shrink-0"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground tracking-wide">
                MAXION
              </h2>
              <p className="text-xs text-muted-foreground tracking-widest uppercase">
                Dev Hub
              </p>
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            aria-label="Close navigation menu"
            className="md:hidden ml-auto rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-1.5 space-y-3" : "p-3 space-y-5")}>
        {groups.map((group) => {
          // ตอน sidebar ย่อเป็นไอคอน ไม่มีหัวกลุ่มให้กด จึงโชว์ทุกเมนูเสมอ
          const isGroupOpen = collapsed || !collapsedGroups.has(group);
          const groupId = `sidebar-group-${group.toLowerCase().replace(/\s+/g, "-")}`;
          return (
          <div key={group}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={isGroupOpen}
                aria-controls={groupId}
                className="flex items-center justify-between w-full rounded-md px-3 py-1 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <span>{group}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    !isGroupOpen && "-rotate-90"
                  )}
                />
              </button>
            )}
            <div id={groupId} className={cn("space-y-0.5", !isGroupOpen && "hidden")}>
              {visibleItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center w-full rounded-lg text-sm transition-all duration-150",
                      collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                      activeTab === item.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {item.icon}
                    {!collapsed && (
                      <span className="flex-1 min-w-0 truncate text-left" title={item.label}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && activeTab === item.id && (
                      <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Theme + Collapse */}
      <div className={cn("border-t border-border", collapsed ? "p-1.5 space-y-1" : "px-4 py-3")}>
        <ThemeSelector collapsed={collapsed} />
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            "hidden md:flex items-center w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors",
            collapsed ? "justify-center p-2.5" : "gap-3 px-1.5 py-2 mt-1"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* User info */}
      <div className={cn("border-t border-border", collapsed ? "p-2 flex justify-center" : "p-4")}>
        <div className={cn("flex items-center", collapsed ? "" : "gap-3")}>
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground shrink-0">
            {email ? email.charAt(0).toUpperCase() : "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground truncate">{email}</p>
              <p className="text-xs text-muted-foreground">Authenticated</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-full bg-card border-r border-border flex-col shrink-0 transition-[width] duration-200",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
