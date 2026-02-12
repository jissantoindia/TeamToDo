import { Client, Account, Databases, Avatars, Teams } from 'appwrite';

export const client = new Client();

client
    .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const avatars = new Avatars(client);
export const teams = new Teams(client);

// Database & Collection IDs
export const DATABASE_ID = '698cec760003f1ff45a1';
export const COLLECTIONS = {
    PROJECTS: 'projects',
    TASKS: 'tasks',
    TIME_ENTRIES: 'time-entries',
    ROLES: 'roles',
    TEAM_MEMBERS: 'team-members',
    LEAVES: 'leaves',
    ATTENDANCE: 'attendance',
    CUSTOMERS: 'customers',
    TASK_STATUSES: 'task-statuses',
    TECH_STACKS: 'tech-stacks',
    HOLIDAYS: 'holidays',
    NOTIFICATIONS: 'notifications'
};
