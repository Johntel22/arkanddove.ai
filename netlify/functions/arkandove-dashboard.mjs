// Ark & Dove Campaigns - Dashboard Data Function
// Reads campaign data from Google Sheets and returns aggregated dashboard JSON

import { google } from 'googleapis';

const DEFAULT_SHEET_ID = '16nDq2IbvHgu7YuGHlv9-DDoZX2GkugVI-eEcn3ydosA';

const TABS = [
  'Campaign Settings',
  'Volunteer Roster',
  'Donor / Call Time Log',
  'Turf Assignment',
  'Event Log',
  'Yard Signs',
  'Postcards',
  'Contacts / Email Signups',
  'Endorsements'
];

function getAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
}

function getSheets(auth) {
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.sheets({ version: 'v4', auth });
}

function safeNum(val) {
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDateStr(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  return rows.slice(1).filter(r => r.some(c => c)).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ''; });
    return obj;
  });
}

function daysUntil(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function isThisWeek(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo && d <= now;
}

function isFuture(dateStr) {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  return d > new Date();
}

function processCampaignSettings(rows) {
  if (!rows || rows.length < 2) {
    return { name: 'New Campaign', office: '', district: '', electionDate: '', party: '', daysUntilElection: null };
  }
  // Campaign Settings is key-value pairs in columns A and B
  const settings = {};
  rows.forEach(r => {
    if (r[0]) settings[String(r[0]).trim().toLowerCase()] = r[1] || '';
  });

  const electionDate = settings['election date'] || settings['electiondate'] || '';
  return {
    name: settings['candidate name'] || settings['candidatename'] || settings['campaign name'] || 'New Campaign',
    office: settings['office'] || '',
    district: settings['district'] || settings['jurisdiction'] || '',
    electionDate,
    party: settings['party'] || '',
    state: settings['state'] || '',
    tagline: settings['tagline'] || '',
    daysUntilElection: daysUntil(electionDate),
    donationGoal: safeNum(settings['fundraising goal'] || settings['donation goal'] || '0'),
    doorGoal: safeNum(settings['door goal'] || settings['total doors'] || '0')
  };
}

function processVolunteers(rows) {
  const data = rowsToObjects(rows);
  const total = data.length;
  const thisWeek = data.filter(d => isThisWeek(d['signup date'] || d['date'] || d['date signed up'] || '')).length;
  const byStatus = {};
  data.forEach(d => {
    const s = (d['status'] || 'unknown').trim() || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  const recent5 = data.slice(-5).reverse().map(d => ({
    name: d['name'] || d['full name'] || d['volunteer name'] || '',
    email: d['email'] || '',
    phone: d['phone'] || '',
    status: d['status'] || '',
    turf: d['assigned turf'] || d['turf'] || '',
    date: d['signup date'] || d['date'] || ''
  }));
  const all = data.map(d => ({
    name: d['name'] || d['full name'] || d['volunteer name'] || '',
    email: d['email'] || '',
    phone: d['phone'] || '',
    status: d['status'] || '',
    turf: d['assigned turf'] || d['turf'] || '',
    availability: d['availability'] || '',
    date: d['signup date'] || d['date'] || ''
  }));
  return { total, thisWeek, byStatus, recent5, all };
}

function processDonors(rows) {
  const data = rowsToObjects(rows);
  let totalRaised = 0;
  let totalPledged = 0;
  let callCount = data.length;
  data.forEach(d => {
    totalRaised += safeNum(d['amount received'] || d['amount donated'] || d['received'] || '0');
    totalPledged += safeNum(d['amount pledged'] || d['pledged'] || '0');
  });
  const avgDonation = totalRaised > 0 ? Math.round(totalRaised / data.filter(d => safeNum(d['amount received'] || d['amount donated'] || d['received'] || '0') > 0).length || 1) : 0;
  const lastCallDate = data.length ? (data[data.length - 1]['date'] || '') : '';
  const daysSinceLastCall = lastCallDate ? daysUntil(lastCallDate) : null;
  const recentCalls = data.slice(-5).reverse().map(d => ({
    date: d['date'] || '',
    donor: d['donor name'] || d['name'] || d['contact name'] || '',
    pledged: safeNum(d['amount pledged'] || d['pledged'] || '0'),
    received: safeNum(d['amount received'] || d['amount donated'] || d['received'] || '0'),
    result: d['result'] || d['outcome'] || '',
    calledBy: d['called by'] || d['caller'] || ''
  }));
  const all = data.map(d => ({
    date: d['date'] || '',
    donor: d['donor name'] || d['name'] || d['contact name'] || '',
    pledged: safeNum(d['amount pledged'] || d['pledged'] || '0'),
    received: safeNum(d['amount received'] || d['amount donated'] || d['received'] || '0'),
    result: d['result'] || d['outcome'] || '',
    calledBy: d['called by'] || d['caller'] || ''
  }));
  return { totalRaised, totalPledged, callCount, avgDonation, daysSinceLastCall: daysSinceLastCall !== null ? Math.abs(daysSinceLastCall) : null, recentCalls, all };
}

function processTurf(rows) {
  const data = rowsToObjects(rows);
  let totalDoors = 0;
  let doorsKnocked = 0;
  data.forEach(d => {
    totalDoors += safeNum(d['total doors'] || d['doors'] || '0');
    doorsKnocked += safeNum(d['knocked'] || d['doors knocked'] || d['completed'] || '0');
  });
  const pctComplete = totalDoors > 0 ? Math.round((doorsKnocked / totalDoors) * 100) : 0;
  const turfsAssigned = data.filter(d => d['assigned to'] || d['volunteer'] || d['walker']).length;
  const all = data.map(d => ({
    area: d['area'] || d['turf name'] || d['name'] || '',
    zip: d['zip'] || d['zip code'] || '',
    totalDoors: safeNum(d['total doors'] || d['doors'] || '0'),
    knocked: safeNum(d['knocked'] || d['doors knocked'] || d['completed'] || '0'),
    pctComplete: safeNum(d['total doors'] || d['doors'] || '0') > 0 ? Math.round((safeNum(d['knocked'] || d['doors knocked'] || d['completed'] || '0') / safeNum(d['total doors'] || d['doors'] || '0')) * 100) : 0,
    assignedTo: d['assigned to'] || d['volunteer'] || d['walker'] || '',
    status: d['status'] || ''
  }));
  return { totalDoors, doorsKnocked, pctComplete, turfsAssigned, all };
}

function processEvents(rows) {
  const data = rowsToObjects(rows);
  const now = new Date();
  const upcoming = data.filter(d => isFuture(d['date'] || '')).map(d => ({
    name: d['event name'] || d['name'] || d['event'] || '',
    date: d['date'] || '',
    location: d['location'] || d['venue'] || '',
    type: d['type'] || d['event type'] || '',
    rsvp: safeNum(d['rsvp'] || d['rsvp count'] || d['expected'] || '0')
  }));
  const past = data.filter(d => !isFuture(d['date'] || '')).map(d => ({
    name: d['event name'] || d['name'] || d['event'] || '',
    date: d['date'] || '',
    location: d['location'] || d['venue'] || '',
    type: d['type'] || d['event type'] || '',
    attendance: safeNum(d['attendance'] || d['attended'] || d['actual'] || '0')
  }));
  const totalAttendance = past.reduce((sum, e) => sum + e.attendance, 0);
  return { upcoming, past, totalAttendance, all: data.map(d => ({
    name: d['event name'] || d['name'] || d['event'] || '',
    date: d['date'] || '',
    location: d['location'] || d['venue'] || '',
    type: d['type'] || d['event type'] || '',
    rsvp: safeNum(d['rsvp'] || d['rsvp count'] || d['expected'] || '0'),
    attendance: safeNum(d['attendance'] || d['attended'] || d['actual'] || '0')
  })) };
}

function processYardSigns(rows) {
  const data = rowsToObjects(rows);
  const requested = data.length;
  const delivered = data.filter(d => (d['status'] || '').toLowerCase().includes('deliver')).length;
  const pending = requested - delivered;
  const all = data.map(d => ({
    name: d['name'] || d['requester'] || d['resident name'] || '',
    address: d['address'] || d['location'] || '',
    status: d['status'] || '',
    driver: d['assigned driver'] || d['driver'] || d['delivered by'] || '',
    deliveredDate: d['delivered date'] || d['date delivered'] || ''
  }));
  return { requested, delivered, pending, all };
}

function processPostcards(rows) {
  const data = rowsToObjects(rows);
  const totalRequested = data.reduce((sum, d) => sum + safeNum(d['postcards requested'] || d['quantity'] || d['count'] || '0'), 0);
  const completed = data.filter(d => (d['status'] || '').toLowerCase().includes('complet') || (d['status'] || '').toLowerCase().includes('done') || (d['status'] || '').toLowerCase().includes('sent')).length;
  const pending = data.length - completed;
  const batchesClaimed = data.filter(d => d['batch number'] || d['batch']).length;
  const all = data.map(d => ({
    name: d['name'] || d['volunteer'] || '',
    requested: safeNum(d['postcards requested'] || d['quantity'] || d['count'] || '0'),
    status: d['status'] || '',
    batch: d['batch number'] || d['batch'] || ''
  }));
  return { totalRequested, completed, pending, batchesClaimed, all };
}

function processContacts(rows) {
  const data = rowsToObjects(rows);
  const total = data.length;
  const thisWeek = data.filter(d => isThisWeek(d['date'] || d['signup date'] || d['date added'] || '')).length;
  const bySources = {};
  data.forEach(d => {
    const s = (d['source'] || d['signup source'] || 'unknown').trim() || 'unknown';
    bySources[s] = (bySources[s] || 0) + 1;
  });
  const all = data.map(d => ({
    name: d['name'] || d['full name'] || '',
    email: d['email'] || '',
    phone: d['phone'] || '',
    source: d['source'] || d['signup source'] || '',
    date: d['date'] || d['signup date'] || d['date added'] || ''
  }));
  return { total, thisWeek, bySources, all };
}

function processEndorsements(rows) {
  const data = rowsToObjects(rows);
  const total = data.length;
  const publicCount = data.filter(d => (d['public'] || d['status'] || '').toLowerCase().includes('yes') || (d['public'] || d['status'] || '').toLowerCase().includes('public')).length;
  const pending = data.filter(d => (d['status'] || d['public'] || '').toLowerCase().includes('pending')).length;
  const all = data.map(d => ({
    name: d['name'] || d['endorser'] || '',
    title: d['title'] || d['position'] || d['organization'] || '',
    quote: d['quote'] || d['statement'] || '',
    public: d['public'] || d['status'] || ''
  }));
  return { total, public: publicCount, pending, all };
}

function generatePriorities(campaign, volunteers, donors, turf, events, yardSigns, postcards) {
  const priorities = [];

  // Call time check
  if (donors.daysSinceLastCall !== null && donors.daysSinceLastCall >= 3) {
    priorities.push({ severity: 'high', message: `Schedule call time - last session was ${donors.daysSinceLastCall} days ago` });
  } else if (donors.callCount === 0) {
    priorities.push({ severity: 'high', message: 'No call time logged yet - schedule your first session' });
  }

  // Unassigned volunteers
  const unassigned = volunteers.byStatus[''] || volunteers.byStatus['unknown'] || 0;
  if (unassigned > 0) {
    priorities.push({ severity: 'medium', message: `${unassigned} new volunteers need shift assignment` });
  }

  // Yard signs pending
  if (yardSigns.pending > 0) {
    priorities.push({ severity: 'medium', message: `${yardSigns.pending} yard sign requests awaiting delivery` });
  }

  // Postcards pending
  if (postcards.pending > 0) {
    priorities.push({ severity: 'medium', message: `${postcards.pending} postcard batches need follow-up` });
  }

  // Door pace
  if (campaign.daysUntilElection !== null && campaign.daysUntilElection < 60 && turf.pctComplete < 50) {
    const remaining = turf.totalDoors - turf.doorsKnocked;
    const perDay = campaign.daysUntilElection > 0 ? Math.ceil(remaining / campaign.daysUntilElection) : remaining;
    priorities.push({ severity: 'high', message: `Door pace is behind - need ${perDay} doors/day to hit target` });
  }

  // No upcoming events
  if (events.upcoming.length === 0) {
    priorities.push({ severity: 'medium', message: 'No upcoming events scheduled' });
  }

  // Sort by severity and return top 3
  const order = { high: 0, medium: 1, low: 2 };
  priorities.sort((a, b) => (order[a.severity] || 2) - (order[b.severity] || 2));
  return priorities.slice(0, 3);
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  const sheetId = url.searchParams.get('sheet') || DEFAULT_SHEET_ID;

  try {
    const auth = getAuth();
    const sheets = getSheets(auth);

    // Fetch all tabs in one batch request
    const ranges = TABS.map(t => `'${t}'!A:Z`);
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges
    });

    const valueRanges = response.data.valueRanges || [];
    const tabData = {};
    TABS.forEach((tab, i) => {
      tabData[tab] = valueRanges[i]?.values || [];
    });

    const campaign = processCampaignSettings(tabData['Campaign Settings']);
    const volunteers = processVolunteers(tabData['Volunteer Roster']);
    const donors = processDonors(tabData['Donor / Call Time Log']);
    const turf = processTurf(tabData['Turf Assignment']);
    const events = processEvents(tabData['Event Log']);
    const yardSigns = processYardSigns(tabData['Yard Signs']);
    const postcards = processPostcards(tabData['Postcards']);
    const contacts = processContacts(tabData['Contacts / Email Signups']);
    const endorsements = processEndorsements(tabData['Endorsements']);
    const priorities = generatePriorities(campaign, volunteers, donors, turf, events, yardSigns, postcards);

    const result = {
      campaign,
      volunteers,
      donors,
      turf,
      events,
      yardSigns,
      postcards,
      contacts,
      endorsements,
      priorities,
      fetchedAt: new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return new Response(JSON.stringify({
      error: 'Failed to fetch dashboard data',
      detail: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};

export const config = { path: '/api/arkandove-dashboard' };
