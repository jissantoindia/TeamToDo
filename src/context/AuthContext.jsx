import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { account, databases, DATABASE_ID, COLLECTIONS } from "../lib/appwrite";
import { ID, Query } from "appwrite";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userPermissions, setUserPermissions] = useState([]);
    const [userRole, setUserRole] = useState(null);       // { $id, name, permissions }
    const [teamMember, setTeamMember] = useState(null);    // team_members doc for this user

    useEffect(() => {
        checkUserStatus();
    }, []);

    async function checkUserStatus() {
        try {
            const loggedInUser = await account.get();
            setUser(loggedInUser);
            await loadUserPermissions(loggedInUser);
        } catch (error) {
            setUser(null);
            setUserPermissions([]);
            setUserRole(null);
            setTeamMember(null);
        } finally {
            setLoading(false);
        }
    }

    // Load the user's team-member record → role → permissions
    async function loadUserPermissions(loggedInUser) {
        try {
            // 1. Find the team member record for this user
            //    team-members may store the user's email or userId
            const memberByUserId = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.TEAM_MEMBERS,
                [Query.equal('userId', loggedInUser.$id), Query.limit(1)]
            );

            let member = memberByUserId.documents[0] || null;

            // Fallback: match by email if userId not found
            if (!member) {
                const memberByEmail = await databases.listDocuments(
                    DATABASE_ID,
                    COLLECTIONS.TEAM_MEMBERS,
                    [Query.equal('email', loggedInUser.email), Query.limit(1)]
                );
                member = memberByEmail.documents[0] || null;
            }

            if (member) {
                setTeamMember(member);

                // 2. Load the role for this member
                if (member.roleId) {
                    try {
                        const role = await databases.getDocument(
                            DATABASE_ID,
                            COLLECTIONS.ROLES,
                            member.roleId
                        );
                        setUserRole(role);
                        setUserPermissions(role.permissions || []);
                    } catch {
                        // Role may have been deleted
                        setUserRole(null);
                        setUserPermissions([]);
                    }
                } else {
                    setUserRole(null);
                    setUserPermissions([]);
                }
            } else {
                // User not in team_members — treat as admin (owner/creator)
                // who hasn't been added as a member yet
                setTeamMember(null);
                setUserRole(null);
                // Give full permissions to users not in team table (likely the app creator)
                setUserPermissions([
                    'manage_projects', 'manage_tasks', 'manage_team',
                    'manage_leaves', 'approve_leaves', 'view_reports', 'manage_roles'
                ]);
            }
        } catch (error) {
            console.error("Error loading permissions:", error);
            setUserPermissions([]);
            setUserRole(null);
            setTeamMember(null);
        }
    }

    // Check if user has a specific permission
    const hasPermission = useCallback((permissionId) => {
        // If no team member record exists, user is the app owner — full access
        if (!teamMember) return true;
        return userPermissions.includes(permissionId);
    }, [teamMember, userPermissions]);

    // Check if user is admin-level (has manage_roles or no team member record)
    const isAdmin = useCallback(() => {
        if (!teamMember) return true;
        return userPermissions.includes('manage_roles');
    }, [teamMember, userPermissions]);

    async function login(email, password) {
        try {
            await account.createEmailPasswordSession(email, password);
            await checkUserStatus();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function signup(email, password, name) {
        try {
            await account.create(ID.unique(), email, password, name);
            await login(email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function logout() {
        try {
            await account.deleteSession("current");
            setUser(null);
            setUserPermissions([]);
            setUserRole(null);
            setTeamMember(null);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

    // Reload permissions (e.g. after role changes in Settings)
    async function refreshPermissions() {
        if (user) {
            await loadUserPermissions(user);
        }
    }

    async function loginWithMicrosoft() {
        try {
            // Initiates OAuth flow. Appwrite will redirect to Microsoft, then back to success URL.
            // Using window.location.href ensures we return to the current page (e.g. /teams)
            account.createOAuth2Session(
                'microsoft',
                window.location.href,
                window.location.href
            );
        } catch (error) {
            console.error("Microsoft Login failed:", error);
        }
    }

    const value = {
        user,
        loading,
        login,
        loginWithMicrosoft,
        signup,
        logout,
        checkUserStatus,
        // Permission system
        userPermissions,
        userRole,
        teamMember,
        hasPermission,
        isAdmin,
        refreshPermissions
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
