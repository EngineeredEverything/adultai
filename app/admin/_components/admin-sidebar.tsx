"use client"

import type React from "react"

import { Images, Users, TrendingUp, Settings, Home, Menu, LogOut, MonitorCog } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { usePathname } from "next/navigation"
import { cn, getUserImageByEmail } from "@/lib/utils"

export default function AdminSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const pathname = usePathname()

  function handleNavigation() {
    setIsMobileMenuOpen(false)
  }

  function NavItem({
    href,
    icon: Icon,
    children,
  }: {
    href: string
    icon: any
    children: React.ReactNode
  }) {
    const isActive = pathname === href

    return (
      <Link
        href={href}
        onClick={handleNavigation}
        className={cn(
          "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
          isActive
            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#1F1F23]",
        )}
      >
        <Icon className="h-4 w-4 mr-3 flex-shrink-0" />
        {children}
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-4 right-4 z-[70] p-2 rounded-lg bg-white dark:bg-[#0F0F12] shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      </button>
      <nav
        className={`
          fixed inset-y-0 left-0 z-[70] w-64 bg-white dark:bg-[#0F0F12] transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:w-64 border-r border-gray-200 dark:border-[#1F1F23]
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 px-6 flex items-center border-b border-gray-200 dark:border-[#1F1F23]">
            <div className="flex items-center gap-3">
              <Link href="/" className="px-4 flex items-center space-x-2">
                <Image src="/logo.png" alt="Logo" width={32} height={32} />

                <span className="font-bold text-xl">AdultAI</span>
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4 px-4">
            <div className="space-y-6">
              <div>
                <div className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  A safer way to adult
                </div>
                <div className="space-y-1">
                  <NavItem href="/admin" icon={Home}>
                    Dashboard
                  </NavItem>
                  <NavItem href="/admin/images" icon={Images}>
                    Manage Images
                  </NavItem>
                  <NavItem href="/admin/users" icon={Users}>
                    Users
                  </NavItem>
                  <NavItem href="/admin/statistics" icon={TrendingUp}>
                    Statistics
                  </NavItem>
                  <NavItem href="/admin/system" icon={MonitorCog}>
                    System
                  </NavItem>
                  <NavItem href="/admin/settings" icon={Settings}>
                    Settings
                  </NavItem>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 border-t border-gray-200 dark:border-[#1F1F23]">
            <div className="flex items-center gap-3 mb-3">
              <Image
                src={getUserImageByEmail(user?.email ?? undefined, user?.name)}
                alt={user?.name || ""}
                width={32}
                height={32}
                className="rounded-full"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[65] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
