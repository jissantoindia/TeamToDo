import { useEffect, useState } from 'react';
import { app } from '@microsoft/teams-js';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function TeamsApp() {
    const { user, loginWithMicrosoft, loading: authLoading } = useAuth();
    const [teamsContext, setTeamsContext] = useState(null);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;

        const initTeams = async () => {
            try {
                // Initialize Teams SDK
                await app.initialize();

                // Get Context (User, Theme, etc.)
                const context = await app.getContext();
                if (mounted) setTeamsContext(context);

                // Apply Initial Theme
                applyTheme(context.app.theme);

                // Listen for Theme Changes
                app.registerOnThemeChangeHandler((theme) => {
                    applyTheme(theme);
                });

            } catch (err) {
                console.warn("Teams SDK init failed (likely running outside Teams):", err);
                // Fallback: Check system preference if needed, or default to light
            } finally {
                if (mounted) setTeamsLoading(false);
            }
        };

        initTeams();

        return () => { mounted = false; };
    }, []);

    const applyTheme = (theme) => {
        // Teams themes: 'default' (light), 'dark', 'contrast'
        const isDark = theme === 'dark' || theme === 'contrast';
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // Show loading state while Auth or Teams SDK initializes
    if (authLoading || teamsLoading) {
        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Initializing Teams Interface...</p>
            </div>
        );
    }

    // If User is NOT authenticated, show Login Prompt
    if (!user) {
        const emailHint = teamsContext?.user?.loginHint;

        return (
            <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-center transition-colors">
                <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
                    <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Welcome to TeamToDo
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">
                        Please sign in to access your dashboard from within Microsoft Teams.
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={loginWithMicrosoft}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#2F2F2F] text-white rounded-lg font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                                <path fill="#f35325" d="M1 1h10v10H1z" />
                                <path fill="#81bc06" d="M12 1h10v10H12z" />
                                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                <path fill="#ffba08" d="M12 12h10v10H12z" />
                            </svg>
                            Sign in with Microsoft
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Or</span>
                            </div>
                        </div>

                        <button
                            onClick={() => navigate(`/login${emailHint ? `?email=${encodeURIComponent(emailHint)}` : ''}`)}
                            className="w-full px-6 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Sign in with Email
                        </button>
                    </div>

                    {emailHint && (
                        <p className="mt-6 text-xs text-gray-400">
                            We detected your Teams email as <br />
                            <span className="font-semibold text-gray-600 dark:text-gray-300">{emailHint}</span>
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Authenticated -> Show Dashboard directly
    // Using a wrapper to ensure dark mode styles apply nicely to background
    return (
        <div className="teams-shell min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors">
            <div className="p-4 sm:p-6">
                <Dashboard />
            </div>
        </div>
    );
}
