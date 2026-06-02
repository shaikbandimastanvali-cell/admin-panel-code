import admin from 'firebase-admin';

// Initialize Firebase Admin securely
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The replace function fixes the multiline string bug in Vercel
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // --- 1. BYPASS CORS BLOCKING ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- 2. SEND THE NOTIFICATION ---
  try {
    const { title, body, fcmTokens, data } = req.body;

    if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      return res.status(400).json({ error: 'No FCM tokens provided by Admin Panel' });
    }

    const message = {
      notification: { title, body },
      data: data || {},
      tokens: fcmTokens.filter(token => token && typeof token === 'string'),
      android: {
        priority: 'high', // Forces Android to wake up the phone
        notification: { sound: 'default' }
      },
      apns: {
        payload: { aps: { sound: 'default', contentAvailable: 1 } } // Forces iOS to wake up
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}