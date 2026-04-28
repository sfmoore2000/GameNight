import { supabase } from './supabase';

export async function seedDatabase() {
  const players = [
    { name: 'Julian Thorne', email: 'julian@example.com', active: true, createdAt: new Date().toISOString() },
    { name: 'Sarah Jenkins', email: 'sarah@example.com', active: true, createdAt: new Date().toISOString() },
    { name: 'David Wu', email: 'david@example.com', active: true, createdAt: new Date().toISOString() },
    { name: 'Omar Little', email: 'omar@example.com', active: true, createdAt: new Date().toISOString() },
    { name: 'Elena Rodriguez', email: 'elena@example.com', active: true, createdAt: new Date().toISOString() },
  ];

  const locations = [
    { name: 'The Gilded Library', address: '42nd & Madison, Suite 1200', active: true, createdAt: new Date().toISOString() },
    { name: 'Skyline Loft', address: '789 Broadway Ave, Penthouse B', active: true, createdAt: new Date().toISOString() },
    { name: 'The Speakeasy', address: '12 Underground Way', active: true, createdAt: new Date().toISOString() },
  ];

  const staff = [
    { name: 'Julian K.', active: true, createdAt: new Date().toISOString() },
    { name: 'Elena V.', active: true, createdAt: new Date().toISOString() },
  ];

  try {
    console.log('Starting database seed...');
    
    // Clear existing data (Note: In production you would have RLS or be careful with this)
    await supabase.from('player_session_entries').delete().neq('id', '0');
    await supabase.from('staff_session_entries').delete().neq('id', '0');
    await supabase.from('sessions').delete().neq('id', '0');
    await supabase.from('players').delete().neq('id', '0');
    await supabase.from('staff').delete().neq('id', '0');
    await supabase.from('locations').delete().neq('id', '0');

    const { data: playerData, error: pError } = await supabase.from('players').insert(players).select();
    if (pError) throw pError;
    
    const { data: locationData, error: lError } = await supabase.from('locations').insert(locations).select();
    if (lError) throw lError;

    const { data: staffData, error: sError } = await supabase.from('staff').insert(staff).select();
    if (sError) throw sError;

    console.log('Core entities created. Creating sessions...');
    
    if (!locationData || !playerData || !staffData) return;

    // Create a completed session
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() - 7);
    
    const sessionData = {
      date: sessionDate.toISOString(),
      locationId: locationData[0].id,
      status: 'completed',
      staffIds: [staffData[0].id, staffData[1].id],
      totalBuyIn: 8000,
      totalPayout: 8000,
      createdAt: new Date().toISOString(),
    };

    const { data: sessionResult, error: sessionError } = await supabase.from('sessions').insert([sessionData]).select().single();
    if (sessionError) throw sessionError;

    // Add entries for the session
    const entries = [
      {
        sessionId: sessionResult.id,
        playerId: playerData[0].id,
        playerDisplayName: 'Julian Thorne',
        buyIns: [{ amount: 1500, method: 'cash', timestamp: new Date().toISOString() }],
        totalBuyIn: 1500,
        payouts: [{ amount: 2300, method: 'cash', timestamp: new Date().toISOString() }],
        totalPayout: 2300,
        netProfit: 800,
        status: 'finished'
      },
      {
        sessionId: sessionResult.id,
        playerId: playerData[1].id,
        playerDisplayName: 'Sarah Jenkins',
        buyIns: [{ amount: 2000, method: 'venmo', timestamp: new Date().toISOString() }],
        totalBuyIn: 2000,
        payouts: [{ amount: 1700, method: 'venmo', timestamp: new Date().toISOString() }],
        totalPayout: 1700,
        netProfit: -300,
        status: 'finished'
      },
      {
        sessionId: sessionResult.id,
        playerId: playerData[2].id,
        playerDisplayName: 'David Wu',
        buyIns: [{ amount: 1000, method: 'apple_pay', timestamp: new Date().toISOString() }],
        totalBuyIn: 1000,
        payouts: [{ amount: 3000, method: 'apple_pay', timestamp: new Date().toISOString() }],
        totalPayout: 3000,
        netProfit: 2000,
        status: 'finished'
      }
    ];

    const { error: entriesError } = await supabase.from('player_session_entries').insert(entries);
    if (entriesError) throw entriesError;

    // Add staff entries for the session
    const staffEntries = [
      {
        sessionId: sessionResult.id,
        staffId: staffData[0].id,
        staffDisplayName: 'Julian K.',
        payoutAmount: 300,
        method: 'cash',
        createdAt: new Date().toISOString()
      },
      {
        sessionId: sessionResult.id,
        staffId: staffData[1].id,
        staffDisplayName: 'Elena V.',
        payoutAmount: 200,
        method: 'venmo',
        createdAt: new Date().toISOString()
      }
    ];

    const { error: staffEntriesError } = await supabase.from('staff_session_entries').insert(staffEntries);
    if (staffEntriesError) throw staffEntriesError;

    console.log('Database seeded successfully.');
    alert('Database seeded successfully. Refreshing page...');
    window.location.reload();
  } catch (error) {
    console.error('Error seeding data:', error);
    alert('Error seeding data. Check console for details.');
  }
}
