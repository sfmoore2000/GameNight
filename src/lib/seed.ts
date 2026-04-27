import { collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function seedDatabase() {
  const players = [
    { name: 'Julian Thorne', email: 'julian@example.com', active: true, createdAt: serverTimestamp() },
    { name: 'Sarah Jenkins', email: 'sarah@example.com', active: true, createdAt: serverTimestamp() },
    { name: 'David Wu', email: 'david@example.com', active: true, createdAt: serverTimestamp() },
    { name: 'Omar Little', email: 'omar@example.com', active: true, createdAt: serverTimestamp() },
    { name: 'Elena Rodriguez', email: 'elena@example.com', active: true, createdAt: serverTimestamp() },
  ];

  const locations = [
    { name: 'The Gilded Library', address: '42nd & Madison, Suite 1200', active: true, createdAt: serverTimestamp() },
    { name: 'Skyline Loft', address: '789 Broadway Ave, Penthouse B', active: true, createdAt: serverTimestamp() },
    { name: 'The Speakeasy', address: '12 Underground Way', active: true, createdAt: serverTimestamp() },
  ];

  const staff = [
    { name: 'Julian K.', active: true, createdAt: serverTimestamp() },
    { name: 'Elena V.', active: true, createdAt: serverTimestamp() },
  ];

  try {
    console.log('Starting database seed...');
    const playerRefs = await Promise.all(players.map(p => addDoc(collection(db, 'players'), p)));
    const locationRefs = await Promise.all(locations.map(l => addDoc(collection(db, 'locations'), l)));
    const staffRefs = await Promise.all(staff.map(s => addDoc(collection(db, 'staff'), s)));

    console.log('Core entities created. Creating sessions...');
    
    // Create a completed session
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() - 7);
    
    const sessionData = {
      date: Timestamp.fromDate(sessionDate),
      locationId: locationRefs[0].id,
      status: 'completed',
      staffIds: [staffRefs[0].id, staffRefs[1].id],
      totalBuyIn: 8000,
      totalPayout: 8000,
      createdAt: serverTimestamp(),
    };

    const sessionRef = await addDoc(collection(db, 'sessions'), sessionData);

    // Add entries for the session
    const entries = [
      {
        sessionId: sessionRef.id,
        playerId: playerRefs[0].id,
        playerDisplayName: 'Julian Thorne',
        buyIns: [{ amount: 1500, method: 'cash', timestamp: Timestamp.now() }],
        totalBuyIn: 1500,
        cashOutAmount: 2300,
        cashOutMethod: 'cash',
        netProfit: 800,
        status: 'finished'
      },
      {
        sessionId: sessionRef.id,
        playerId: playerRefs[1].id,
        playerDisplayName: 'Sarah Jenkins',
        buyIns: [{ amount: 2000, method: 'venmo', timestamp: Timestamp.now() }],
        totalBuyIn: 2000,
        cashOutAmount: 1700,
        cashOutMethod: 'venmo',
        netProfit: -300,
        status: 'finished'
      },
      {
        sessionId: sessionRef.id,
        playerId: playerRefs[2].id,
        playerDisplayName: 'David Wu',
        buyIns: [{ amount: 1000, method: 'apple_pay', timestamp: Timestamp.now() }],
        totalBuyIn: 1000,
        cashOutAmount: 3000,
        cashOutMethod: 'apple_pay',
        netProfit: 2000,
        status: 'finished'
      },
      {
        sessionId: sessionRef.id,
        playerId: playerRefs[3].id,
        playerDisplayName: 'Omar Little',
        buyIns: [{ amount: 3500, method: 'cash_app', timestamp: Timestamp.now() }],
        totalBuyIn: 3500,
        cashOutAmount: 500,
        cashOutMethod: 'cash_app',
        netProfit: -3000,
        status: 'finished'
      }
    ];

    for (const entry of entries) {
      await addDoc(collection(db, 'sessions', sessionRef.id, 'entries'), entry);
    }

    // Add staff entries for the session
    const staffEntries = [
      {
        sessionId: sessionRef.id,
        staffId: staffRefs[0].id,
        staffDisplayName: 'Julian K.',
        payoutAmount: 300,
        method: 'cash',
        createdAt: serverTimestamp()
      },
      {
        sessionId: sessionRef.id,
        staffId: staffRefs[1].id,
        staffDisplayName: 'Elena V.',
        payoutAmount: 200,
        method: 'venmo',
        createdAt: serverTimestamp()
      }
    ];

    for (const sEntry of staffEntries) {
      await addDoc(collection(db, 'sessions', sessionRef.id, 'staff_entries'), sEntry);
    }

    console.log('Database seeded successfully.');
    alert('Database seeded successfully. Refreshing page...');
    window.location.reload();
  } catch (error) {
    console.error('Error seeding data:', error);
    alert('Error seeding data. Check console for details. Ensure you are signed in as sfmoore2000@gmail.com.');
  }
}
