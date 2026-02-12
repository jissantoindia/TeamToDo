
import { Client, Databases, Permission, Role } from 'node-appwrite';
import fs from 'fs';
import path from 'path';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('698ce9a3002b537b3451')
    .setKey('standard_4889130265aed84970cadfca95d0118ec22e4a1a0ce565e503188e26b29d4862a5a4d038300895dad13c011dfb49e3874d30c79bf332736a1c32624ace23f71fd7cb94db196bf82468ad09df9c76b39747f404604f4ebe1ad28baf2b3e0296fc292467519043e4f038ed4029c5ba2c19bbf620671e3821872f3b33f51a8c8a23');

const databases = new Databases(client);

// Collections definition (keep same as before)
const COLLECTIONS = [
    {
        id: 'projects',
        name: 'Projects',
        attributes: [
            { key: 'name', type: 'string', size: 128, required: true },
            { key: 'description', type: 'string', size: 10000, required: false },
            { key: 'status', type: 'string', size: 20, required: true },
            { key: 'ownerId', type: 'string', size: 36, required: true },
            { key: 'startDate', type: 'datetime', required: false },
            { key: 'endDate', type: 'datetime', required: false }
        ]
    },
    {
        id: 'tasks',
        name: 'Tasks',
        attributes: [
            { key: 'title', type: 'string', size: 128, required: true },
            { key: 'description', type: 'string', size: 10000, required: false },
            { key: 'projectId', type: 'string', size: 36, required: false },
            { key: 'assigneeId', type: 'string', size: 36, required: false },
            { key: 'status', type: 'string', size: 20, required: true },
            { key: 'priority', type: 'string', size: 10, required: true },
            { key: 'estimatedHours', type: 'double', required: false },
            { key: 'dueDate', type: 'datetime', required: false }
        ],
        indexes: [
            { key: 'projectId', type: 'key', attributes: ['projectId'] },
            { key: 'assigneeId', type: 'key', attributes: ['assigneeId'] }
        ]
    },
    {
        id: 'time-entries',
        name: 'TimeEntries',
        attributes: [
            { key: 'taskId', type: 'string', size: 36, required: true },
            { key: 'userId', type: 'string', size: 36, required: true },
            { key: 'startTime', type: 'datetime', required: true },
            { key: 'endTime', type: 'datetime', required: false },
            { key: 'duration', type: 'double', required: false }
        ]
    },
    {
        id: 'roles',
        name: 'Roles',
        attributes: [
            { key: 'name', type: 'string', size: 50, required: true },
            { key: 'permissions', type: 'string', size: 1000, required: false, array: true }
        ]
    },
    {
        id: 'team-members',
        name: 'Team Members',
        attributes: [
            { key: 'name', type: 'string', size: 128, required: true },
            { key: 'email', type: 'string', size: 128, required: true },
            { key: 'roleId', type: 'string', size: 36, required: true },
            { key: 'userId', type: 'string', size: 36, required: false }
        ],
        indexes: [
            { key: 'email', type: 'key', attributes: ['email'] }
        ]
    },
    {
        id: 'tech-stacks',
        name: 'Tech Stacks',
        attributes: [
            { key: 'name', type: 'string', size: 100, required: true },
            { key: 'description', type: 'string', size: 5000, required: false }
        ]
    }
];

async function setup() {
    console.log('Starting Appwrite Setup...');

    let dbId = 'teamtodo-db';

    // 1. Check or Create Database
    try {
        const dbs = await databases.list();
        if (dbs.total > 0) {
            // Check if our preferred DB exists
            const existing = dbs.databases.find(d => d.name === 'TeamToDo DB' || d.$id === 'teamtodo-db');
            if (existing) {
                dbId = existing.$id;
                console.log(`Using existing database: ${dbId}`);
            } else {
                // Use the first available DB
                dbId = dbs.databases[0].$id;
                console.log(`Max databases reached. Using existing database found: ${dbId} (${dbs.databases[0].name})`);
            }
        } else {
            console.log(`Creating database ${dbId}...`);
            await databases.create(dbId, 'TeamToDo DB');
        }
    } catch (e) {
        console.error('Error with database operations:', e);
        return;
    }

    // 2. Create Collections
    console.log(`Setting up collections in ${dbId}...`);

    for (const col of COLLECTIONS) {
        try {
            // Create Collection
            try {
                await databases.getCollection(dbId, col.id);
                console.log(`Collection ${col.name} (${col.id}) exists.`);
            } catch (e) {
                if (e.code === 404) {
                    console.log(`Creating collection ${col.name}...`);
                    await databases.createCollection(dbId, col.id, col.name, [
                        Permission.read(Role.any()),
                        Permission.write(Role.any()),
                        Permission.update(Role.any()),
                        Permission.delete(Role.any())
                    ]);
                } else throw e;
            }

            // Create Attributes
            for (const attr of col.attributes) {
                try {
                    // We can't easily check existence without listing, so we just try/catch create
                    if (attr.type === 'string') {
                        await databases.createStringAttribute(dbId, col.id, attr.key, attr.size, attr.required, undefined, attr.array);
                    } else if (attr.type === 'datetime') {
                        await databases.createDatetimeAttribute(dbId, col.id, attr.key, attr.required, undefined, attr.array);
                    } else if (attr.type === 'double') {
                        await databases.createFloatAttribute(dbId, col.id, attr.key, attr.required, undefined, attr.array);
                    }
                    console.log(`  + Attribute ${attr.key}`);
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    // Ignore if already exists
                    if (e.code !== 409) console.error(`  - Error creating attribute ${attr.key}:`, e.message);
                }
            }

            // Create Indexes
            if (col.indexes) {
                await new Promise(r => setTimeout(r, 2000)); // Wait for attrs
                for (const idx of col.indexes) {
                    try {
                        await databases.createIndex(dbId, col.id, idx.key, idx.type, idx.attributes);
                        console.log(`  + Index ${idx.key}`);
                    } catch (e) {
                        if (e.code !== 409) console.error(`  - Error creating index ${idx.key}:`, e.message);
                    }
                }
            }

        } catch (e) {
            console.error(`Error processing collection ${col.name}:`, e);
        }
    }

    // 3. Update appwrite.js with the correct DB ID if differs
    if (dbId !== 'teamtodo-db') {
        console.log(`Updating src/lib/appwrite.js with DATABASE_ID = '${dbId}'...`);
        const appwriteJsPath = path.resolve('src/lib/appwrite.js');
        if (fs.existsSync(appwriteJsPath)) {
            let content = fs.readFileSync(appwriteJsPath, 'utf8');
            content = content.replace(/export const DATABASE_ID = '.*';/, `export const DATABASE_ID = '${dbId}';`);
            fs.writeFileSync(appwriteJsPath, content);
            console.log('Updated appwrite.js');
        }
    }

    console.log('Setup finished.');
}

setup();
