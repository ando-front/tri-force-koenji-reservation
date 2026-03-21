import * as admin from 'firebase-admin';
import * as fs from 'fs';

type FacilitySeed = {
  facilityId: string;
  name: string;
  capacity: number;
  openHour: number;
  closeHour: number;
  slotDurationMinutes: number;
  closedWeekdays: number[];
  maintenanceDates: string[];
  isActive: boolean;
};

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'tri-force-koenji-reservation';
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

const facilities: FacilitySeed[] = [
  {
    facilityId: 'koenji-free-mat-area',
    name: 'トライフォース高円寺 フリーマット',
    capacity: 20,
    openHour: 10,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [],
    maintenanceDates: [],
    isActive: true,
  },
  {
    facilityId: 'koenji-fitness-area',
    name: 'トライフォース高円寺 フィットネス',
    capacity: 10,
    openHour: 10,
    closeHour: 22,
    slotDurationMinutes: 60,
    closedWeekdays: [],
    maintenanceDates: [],
    isActive: true,
  },
];

async function run(): Promise<void> {
  if (SERVICE_ACCOUNT_PATH) {
    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  } else {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore();

  const batch = db.batch();
  for (const facility of facilities) {
    const ref = db.collection('facilities').doc(facility.facilityId);
    batch.set(ref, facility, { merge: true });
  }

  await batch.commit();

  console.log(`Seeded ${facilities.length} facilities into project ${PROJECT_ID}.`);
}

run().catch((error: unknown) => {
  console.error('Failed to seed facilities:', error);
  process.exit(1);
});
