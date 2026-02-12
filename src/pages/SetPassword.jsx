import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Functions, Client } from 'appwrite';
import { CheckSquare, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

// Create a fresh client for the set-password page (user may not be logged in)
const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

const functions = new Functions(client);
const FUNCTION_ID = 'team-invite';

export default function SetPassword() {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!token || !email) {
            setError('Invalid invitation link. Please contact your admin.');
            return;
        }

        setLoading(true);
        try {
            const execution = await functions.createExecution(
                FUNCTION_ID,
                JSON.stringify({ action: 'set-password', email: decodeURIComponent(email), token, password }),
                false,
                '/',
                'POST'
            );
            const data = JSON.parse(execution.responseBody);

            if (execution.responseStatusCode >= 400) {
                setError(data.error || 'Failed to set password.');
            } else {
                setSuccess(true);
            }
        } catch (err) {
            setError('Network error. Please try again. ' + (err?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Password Set Successfully!</h1>
                    <p className="text-gray-500 mb-8">
                        Your account is now active. You can log in with your email and the password you just set.
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        Go to Login →
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-lg shadow-indigo-200 mb-4">
                        <CheckSquare className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Set Your Password</h1>
                    <p className="text-gray-500 mt-2">
                        Welcome to <strong className="text-indigo-600">EBSGL</strong>! Create a secure password to activate your account.
                    </p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Email display */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                        <p className="text-sm text-gray-500">Your email</p>
                        <p className="text-sm font-bold text-indigo-700">{decodeURIComponent(email)}</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start">
                            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    className="block w-full border border-gray-300 rounded-xl py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow"
                                    placeholder="Minimum 8 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={8}
                                className="block w-full border border-gray-300 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow"
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {/* Password strength hints */}
                        <div className="space-y-1.5">
                            <div className={`flex items-center text-xs ${password.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>
                                <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                At least 8 characters
                            </div>
                            <div className={`flex items-center text-xs ${password && password === confirmPassword ? 'text-green-600' : 'text-gray-400'}`}>
                                <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                Passwords match
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Setting password...' : 'Activate My Account'}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Already have a password? <Link to="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
