
import { Client, Databases, Permission, Role } from 'node-appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('698ce9a3002b537b3451')
    .setKey('standard_4889130265aed84970cadfca95d0118ec22e4a1a0ce565e503188e26b29d4862a5a4d038300895dad13c011dfb49e3874d30c79bf332736a1c32624ace23f71fd7cb94db196bf82468ad09df9c76b39747f404604f4ebe1ad28baf2b3e0296fc292467519043e4f038ed4029c5ba2c19bbf620671e3821872f3b33f51a8c8a23');

const databases = new Databases(client);
const DB_ID = '698cec760003f1ff45a1';

const NEW_COLLECTIONS = [
    {
        id: 'holidays',
        name: 'Holidays',
        attributes: [
            { key: 'name', type: 'string', size: 128, required: true },
            { key: 'date', type: 'string', size: 20, required: true },
            { key: 'type', type: 'string', size: 20, required: true },
            { key: 'year', type: 'integer', required: true },
            { key: 'description', type: 'string', size: 500, required: false },
            { key: 'createdBy', type: 'string', size: 36, required: true }
        ],
        indexes: [
            { key: 'year', type: 'key', attributes: ['year'] },
            { key: 'date', type: 'key', attributes: ['date'] }
        ]
    },
    {
        id: 'notifications',
        name: 'Notifications',
        attributes: [
            { key: 'title', type: 'string', size: 200, required: true },
            { key: 'message', type: 'string', size: 2000, required: true },
            { key: 'type', type: 'string', size: 30, required: true },
            { key: 'targetUserId', type: 'string', size: 36, required: false },
            { key: 'createdBy', type: 'string', size: 36, required: true }
        ],
        indexes: [
            { key: 'targetUserId', type: 'key', attributes: ['targetUserId'] },
            { key: 'type', type: 'key', attributes: ['type'] }
        ]
    }
];

async function setup() {
    console.log('Setting up new collections (holidays, notifications)...\n');

    for (const col of NEW_COLLECTIONS) {
        try {
            try {
                await databases.getCollection(DB_ID, col.id);
                console.log(`✅ Collection "${col.name}" already exists.`);
            } catch (e) {
                if (e.code === 404) {
                    console.log(`Creating collection "${col.name}"...`);
                    await databases.createCollection(DB_ID, col.id, col.name, [
                        Permission.read(Role.any()),
                        Permission.write(Role.any()),
                        Permission.update(Role.any()),
                        Permission.delete(Role.any())
                    ]);
                    console.log(`✅ Collection "${col.name}" created.`);
                } else throw e;
            }

            for (const attr of col.attributes) {
                try {
                    if (attr.type === 'string') {
                        await databases.createStringAttribute(DB_ID, col.id, attr.key, attr.size, attr.required, undefined, attr.array);
                    } else if (attr.type === 'integer') {
                        await databases.createIntegerAttribute(DB_ID, col.id, attr.key, attr.required);
                    } else if (attr.type === 'datetime') {
                        await databases.createDatetimeAttribute(DB_ID, col.id, attr.key, attr.required);
                    }
                    console.log(`  + Attribute: ${attr.key}`);
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    if (e.code !== 409) console.error(`  - Error: ${attr.key}:`, e.message);
                    else console.log(`  ~ Attribute ${attr.key} already exists.`);
                }
            }

            if (col.indexes) {
                await new Promise(r => setTimeout(r, 2000));
                for (const idx of col.indexes) {
                    try {
                        await databases.createIndex(DB_ID, col.id, idx.key, idx.type, idx.attributes);
                        console.log(`  + Index: ${idx.key}`);
                    } catch (e) {
                        if (e.code !== 409) console.error(`  - Index error ${idx.key}:`, e.message);
                        else console.log(`  ~ Index ${idx.key} already exists.`);
                    }
                }
            }
            console.log('');
        } catch (e) {
            console.error(`Error with collection "${col.name}":`, e);
        }
    }

    console.log('Done! New collections are ready.');
}

setup();
