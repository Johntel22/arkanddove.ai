import { google } from 'googleapis';

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

const DEFAULT_SHEET = '16nDq2IbvHgu7YuGHlv9-DDoZX2GkugVI-eEcn3ydosA';

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const { section, data, sheetId, publish } = body;
    const SHEET_ID = sheetId || DEFAULT_SHEET;

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Campaign Settings is a key-value tab: Column A = Setting, Column B = Value
    // Read existing settings to get row mapping
    let existingRows;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Campaign Settings!A:B',
      });
      existingRows = res.data.values || [];
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Could not read Campaign Settings tab' }), { status: 500, headers });
    }

    // Build a map of setting name -> row number
    const rowMap = {};
    for (let i = 0; i < existingRows.length; i++) {
      if (existingRows[i][0]) {
        rowMap[existingRows[i][0].trim()] = i + 1; // 1-indexed
      }
    }

    // Map form fields to Campaign Settings rows
    const updates = [];

    if (section === 'home') {
      if (data.name !== undefined) updates.push(['Candidate Name', data.name]);
      if (data.tagline !== undefined) updates.push(['Campaign Tagline', data.tagline]);
      if (data.office !== undefined) updates.push(['Office', data.office]);
      if (data.district !== undefined) updates.push(['District/Jurisdiction', data.district]);
    }

    if (section === 'about') {
      if (data.bio !== undefined) updates.push(['Candidate Bio', data.bio]);
    }

    if (section === 'brand') {
      if (data.primaryColor !== undefined) updates.push(['Primary Color', data.primaryColor]);
      if (data.accentColor !== undefined) updates.push(['Accent Color', data.accentColor]);
    }

    if (section === 'links') {
      if (data.donateUrl !== undefined) updates.push(['ActBlue / Donate URL', data.donateUrl]);
      if (data.email !== undefined) updates.push(['Campaign Email', data.email]);
      if (data.facebook !== undefined) updates.push(['Facebook', data.facebook]);
      if (data.instagram !== undefined) updates.push(['Instagram', data.instagram]);
    }

    // For fields that might not exist yet, we need to handle both update and append
    const batchData = [];
    const appendData = [];

    for (const [setting, value] of updates) {
      if (rowMap[setting]) {
        // Update existing row
        batchData.push({
          range: `Campaign Settings!B${rowMap[setting]}`,
          values: [[value]]
        });
      } else {
        // Append new row
        appendData.push([setting, value]);
      }
    }

    // Batch update existing settings
    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: batchData
        }
      });
    }

    // Append new settings
    if (appendData.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Campaign Settings!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appendData }
      });
    }

    // Handle issues - write to a dedicated range
    if (section === 'issues' && data.issues) {
      // Check if Issues tab exists, create if not
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Issues!A1',
        });
      } catch (e) {
        if (e.message?.includes('Unable to parse range')) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
              requests: [{ addSheet: { properties: { title: 'Issues' } } }]
            }
          });
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'Issues!A1:C1',
            valueInputOption: 'RAW',
            requestBody: { values: [['Order', 'Title', 'Description']] }
          });
        }
      }

      // Clear and rewrite issues
      const issueSheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Issues!A:A',
      });
      const issueRowCount = (issueSheet.data.values || []).length;
      if (issueRowCount > 1) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: `Issues!A2:C${issueRowCount}`,
        });
      }

      if (data.issues.length > 0) {
        const issueRows = data.issues.map((issue, i) => [
          i + 1,
          issue.title || '',
          issue.description || ''
        ]);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Issues!A2:C${data.issues.length + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: issueRows }
        });
      }
    }

    // Handle endorsement - append to Endorsements tab
    if (section === 'endorsement' && data.name) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Endorsements!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            data.name || '',
            data.title || '',
            data.quote || '',
            data.date || '',
            data.isPublic === 'yes' ? 'Yes' : 'No',
            '',
            ''
          ]]
        }
      });
    }

    // Handle "other" change request - log it
    if (section === 'other' && data.description) {
      // Check if Change Requests tab exists
      try {
        await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Change Requests!A1',
        });
      } catch (e) {
        if (e.message?.includes('Unable to parse range')) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
              requests: [{ addSheet: { properties: { title: 'Change Requests' } } }]
            }
          });
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: 'Change Requests!A1:E1',
            valueInputOption: 'RAW',
            requestBody: { values: [['Timestamp', 'Page', 'Section', 'Description', 'Status']] }
          });
        }
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Change Requests!A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            data.page || '',
            data.section || '',
            data.description || '',
            'Pending'
          ]]
        }
      });
    }

    // Trigger deploy if publish flag is set
    if (publish) {
      const hookUrl = process.env.NETLIFY_DEPLOY_HOOK;
      if (hookUrl) {
        try {
          await fetch(hookUrl, { method: 'POST' });
        } catch (e) {
          console.error('Deploy hook error (non-fatal):', e.message);
        }
      }
    }

    const totalUpdates = batchData.length + appendData.length + (section === 'issues' ? 1 : 0) + (section === 'endorsement' ? 1 : 0) + (section === 'other' ? 1 : 0);
    return new Response(JSON.stringify({ success: true, updated: totalUpdates, published: !!publish }), { headers });

  } catch (err) {
    console.error('website-update error:', err);
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500, headers });
  }
};
