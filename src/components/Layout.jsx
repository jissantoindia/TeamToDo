import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, CheckSquare, Users, Settings, LogOut, Clock, Calendar, BarChart, Building2, Shield, Sparkles, Bell, CalendarHeart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ChatBot from "./ChatBot";
import clsx from "clsx";

export default function Layout() {
    const { user, logout, hasPermission, isAdmin, userRole } = useAuth();
    const location = useLocation();

    // Map each nav item to the permission(s) required to see it
    // null = always visible, string = requires that permission
    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, permission: null },
        { name: 'Projects', href: '/projects', icon: FolderKanban, permission: 'manage_projects' },
        { name: 'Customers', href: '/customers', icon: Building2, permission: 'manage_projects' },
        { name: 'My Tasks', href: '/tasks', icon: CheckSquare, permission: null },
        { name: 'AI Tasks', href: '/ai-tasks', icon: Sparkles, permission: 'ai_task_creator' },
        { name: 'Attendance', href: '/attendance', icon: Clock, permission: null },
        { name: 'Leaves', href: '/leaves', icon: Calendar, permission: 'manage_leaves' },
        { name: 'Reports', href: '/reports', icon: BarChart, permission: 'view_reports' },
        { name: 'Holidays', href: '/holidays', icon: CalendarHeart, permission: null },
        { name: 'Notifications', href: '/notifications', icon: Bell, permission: null },
        { name: 'Team', href: '/team', icon: Users, permission: 'manage_team' },
        { name: 'Settings', href: '/settings', icon: Settings, permission: 'manage_roles' },
    ];

    // Filter navigation based on user permissions
    const visibleNavigation = navigation.filter(item => {
        if (!item.permission) return true; // Always visible
        return hasPermission(item.permission);
    });

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <div className="hidden md:flex md:w-72 md:flex-col box-border shadow-xl z-20">
                <div className="flex flex-col flex-grow pt-8 bg-white overflow-y-auto">
                    <div className="flex items-center flex-shrink-0 px-8 mb-8">
                        <div className="h-10 w-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-indigo-200">
                            <CheckSquare className="h-6 w-6 text-white" />
                        </div>
                        <span className="font-extrabold text-2xl text-gray-900 tracking-tight">TeamToDo</span>
                    </div>
                    <div className="mt-4 flex-1 flex flex-col px-4">
                        <nav className="flex-1 space-y-2">
                            {visibleNavigation.map((item) => {
                                const isActive = location.pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        className={clsx(
                                            isActive
                                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                                            'group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ease-in-out'
                                        )}
                                    >
                                        <item.icon
                                            className={clsx(
                                                isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500',
                                                'mr-4 flex-shrink-0 h-5 w-5 transition-colors'
                                            )}
                                            aria-hidden="true"
                                        />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                    <div className="flex-shrink-0 flex border-t border-gray-100 p-6 bg-gray-50/50">
                        <div className="flex-shrink-0 w-full group block">
                            <div className="flex items-center">
                                <div className="inline-block h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 p-0.5 shadow-md">
                                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-indigo-700 font-bold text-sm">
                                        {user?.name?.charAt(0) || 'U'}
                                    </div>
                                </div>
                                <div className="ml-3 overflow-hidden">
                                    <p className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                                        {user?.name || 'User'}
                                    </p>
                                    {userRole && (
                                        <p className="text-[10px] text-indigo-500 font-medium flex items-center">
                                            <Shield className="h-2.5 w-2.5 mr-0.5" />
                                            {userRole.name}
                                        </p>
                                    )}
                                    <button
                                        onClick={logout}
                                        className="text-xs font-medium text-gray-500 hover:text-red-600 flex items-center mt-0.5 transition-colors"
                                    >
                                        <LogOut className="h-3 w-3 mr-1" />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/50">
                <main className="flex-1 relative overflow-y-auto focus:outline-none scroll-smooth">
                    <Outlet />
                </main>
            </div>

            {/* TDo AI Chatbot */}
            <ChatBot />
        </div>
    );
}
