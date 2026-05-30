import admin from 'firebase-admin';

// Prevent re-initializing the app if the function is called multiple times
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The replace function safely handles the hidden newline characters in the Vercel variables
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Only allow POST requests from our Admin button
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    const db = admin.firestore();

    // 1. Fetch all users from your specific Firestore path
    const usersSnapshot = await db
      .collection('artifacts')
      .doc('ff-tournament-live-db')
      .collection('public')
      .doc('data')
      .collection('users')
      .get();

    // 2. Extract FCM Tokens
    const tokens = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'No tokens found. Database updated.' });
    }

    // 3. Construct the actual phone push notification
    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: tokens, 
    };

    // 4. Blast the notification to all devices
    const response = await admin.messaging().sendEachForMulticast(message);

    return res.status(200).json({
      message: 'Push sent successfully',
      successes: response.successCount,
      failures: response.failureCount,
    });
  } catch (error) {
    console.error('Push Error:', error);
    return res.status(500).json({ error: error.message });
  }
}