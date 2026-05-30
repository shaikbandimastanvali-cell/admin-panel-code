import admin from 'firebase-admin';

// Prevent re-initializing the app if the function is called multiple times
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  console.log("--- PUSH NOTIFICATION API TRIGGERED ---");
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, body } = req.body;
    console.log(`Message Details: Title="${title}", Body="${body}"`);

    const db = admin.firestore();

    console.log("Fetching users from Firestore...");
    const usersSnapshot = await db
      .collection('artifacts')
      .doc('ff-tournament-live-db')
      .collection('public')
      .doc('data')
      .collection('users')
      .get();

    const tokens = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      // We only grab tokens if they exist AND notifications are enabled
      if (data.fcmToken && data.notificationsEnabled !== false) {
        tokens.push(data.fcmToken);
      }
    });

    console.log(`Found ${tokens.length} valid FCM tokens in Firestore.`);

    if (tokens.length === 0) {
      console.log("ABORTING: No tokens found in database. User hasn't granted permission or logged in.");
      return res.status(200).json({ message: 'No tokens found.' });
    }

    // This payload includes BOTH "notification" and "data" to guarantee Android wakes up
    const message = {
      tokens: tokens,
      notification: {
        title: title,
        body: body,
      },
      data: {
        title: title,
        body: body,
        click_action: "https://esports-tournament-app-beta.vercel.app/"
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          icon: "https://esports-tournament-app-beta.vercel.app/favicon.svg",
          vibrate: [200, 100, 200, 100, 200]
        }
      }
    };

    console.log("Sending payload to Firebase servers...");
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`Push Results: ${response.successCount} succeeded, ${response.failureCount} failed.`);
    
    // If any failed, print EXACTLY why they failed (e.g. "invalid-registration-token")
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Token ${idx} failed:`, resp.error);
        }
      });
    }

    return res.status(200).json({
      message: 'Push processed',
      successes: response.successCount,
      failures: response.failureCount,
    });
  } catch (error) {
    console.error('CRITICAL API ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
