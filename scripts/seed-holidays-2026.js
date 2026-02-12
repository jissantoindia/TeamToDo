import { Client, Databases, ID } from 'node-appwrite';
import 'dotenv/config';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('698ce9a3002b537b3451')
    .setKey(process.env.APPWRITE_PROJECT_API_KEY);

const databases = new Databases(client);
const DATABASE_ID = '698cec760003f1ff45a1';
const COLLECTION_ID = 'holidays';

const HOLIDAYS_2026 = [
    { name: 'Maha Sivarathri', date: '2026-02-26', type: 'paid' },
    { name: 'Id-ul-Fitr (Ramzan)', date: '2026-03-31', type: 'paid' },
    { name: 'Annual Closing of accounts of Commercial and Co-operative Banks', date: '2026-04-01', type: 'paid' },
    { name: 'Vishu / Dr. B.R. Ambedkar Jayanthi', date: '2026-04-14', type: 'paid' },
    { name: 'Good Friday', date: '2026-04-18', type: 'paid' },
    { name: 'May Day', date: '2026-05-01', type: 'paid' },
    { name: 'Id-ul-Ad\'ha (Bakrid)', date: '2026-06-06', type: 'paid' },
    { name: 'Independence Day', date: '2026-08-15', type: 'paid' },
    { name: 'First Onam', date: '2026-09-04', type: 'paid' },
    { name: 'Thiruvonam / Milad-i-Sherif', date: '2026-09-05', type: 'paid' },
    { name: 'Mahanavami', date: '2026-10-01', type: 'paid' },
    { name: 'Vijayadasami / Gandhi Jayanthi', date: '2026-10-02', type: 'paid' },
    { name: 'Deepavali', date: '2026-10-20', type: 'paid' },
    { name: 'Christmas', date: '2026-12-25', type: 'paid' },
];

async function seedHolidays() {
    console.log(`\nSeeding ${HOLIDAYS_2026.length} public holidays for 2026...\n`);

    let success = 0;
    let failed = 0;

    for (const holiday of HOLIDAYS_2026) {
        try {
            await databases.createDocument(
                DATABASE_ID,
                COLLECTION_ID,
                ID.unique(),
                {
                    name: holiday.name,
                    date: holiday.date,
                    type: holiday.type,
                    year: 2026,
                    description: 'Public Holiday',
                    createdBy: 'system'
                }
            );
            console.log(`  ✅ ${holiday.date}  ${holiday.name}`);
            success++;
        } catch (error) {
            console.error(`  ❌ ${holiday.date}  ${holiday.name} — ${error.message}`);
            failed++;
        }
    }

    console.log(`\nDone! ${success} added, ${failed} failed.`);
}

seedHolidays();
