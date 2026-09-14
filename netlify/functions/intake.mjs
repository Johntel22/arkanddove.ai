// Ark & Dove Campaigns - Client Intake Function
// Receives form submission, sends formatted email via Gmail API (as Johntel),
// falls back to Resend if Gmail fails. Also pushes contact to GHL A&D sub-account.

import { google } from 'googleapis';

async function sendViaGmail({ from, to, replyTo, subject, html }) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const gmail = google.gmail({ version: 'v1', auth });

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8'
  ].filter(Boolean);

  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + html)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

async function sendViaResend({ from, to, replyTo, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const {
    candidate_name,
    office,
    office_other,
    district,
    state,
    election_date,
    party,
    manager_name,
    manager_email,
    manager_phone,
    treasurer_name,
    campaign_email,
    campaign_phone,
    bio,
    top_issues,
    tagline,
    authority_line,
    color_primary_hex,
    color_accent_hex,
    let_us_choose_colors,
    donation_link,
    existing_website,
    facebook_url,
    instagram_handle,
    twitter_handle,
    services_needed,
    services_other,
    additional_notes,
    referral_source
  } = body;

  // services_needed comes as an array from multi-checkbox; normalize
  const servicesList = Array.isArray(services_needed)
    ? services_needed
    : (services_needed ? [services_needed] : []);
  const servicesDisplay = [...servicesList, services_other].filter(Boolean).join(', ');

  const officeFinal = office === 'Other' && office_other ? office_other : office;
  const candidateDisplay = candidate_name || '(unknown)';
  const officeDisplay = officeFinal || '(unknown)';

  const subject = `New Campaign Intake: ${candidateDisplay} for ${officeDisplay}`;

  function row(label, value) {
    if (!value || String(value).trim() === '') return '';
    return `
      <tr>
        <td style="padding: 8px 12px; font-size: 13px; color: #5A6A7E; font-weight: 600; white-space: nowrap; vertical-align: top; width: 200px; border-bottom: 1px solid #E8ECF2;">${label}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #2D3748; vertical-align: top; border-bottom: 1px solid #E8ECF2;">${String(value).replace(/\n/g, '<br>')}</td>
      </tr>
    `;
  }

  function section(title, rows) {
    const content = rows.filter(Boolean).join('');
    if (!content) return '';
    return `
      <tr>
        <td colspan="2" style="padding: 16px 12px 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #FFFFFF; background: #0A2540;">
          ${title}
        </td>
      </tr>
      ${content}
    `;
  }

  const colorInfo = let_us_choose_colors === 'yes'
    ? 'Let Ark &amp; Dove choose'
    : `Primary: ${color_primary_hex || '#0A2540'} / Accent: ${color_accent_hex || '#2B7DE9'}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
    </head>
    <body style="margin: 0; padding: 0; background: #F5F7FA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #F5F7FA; padding: 32px 16px;">
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 700px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E8ECF2;">

              <!-- Header -->
              <tr>
                <td colspan="2" style="background: #0A2540; padding: 24px 28px; border-bottom: 3px solid #2B7DE9;">
                  <div style="font-size: 20px; font-weight: 700; color: #FFFFFF;">Ark &amp; Dove Campaigns</div>
                  <div style="font-size: 13px; color: #2B7DE9; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em;">New Client Intake</div>
                  <div style="font-size: 22px; font-weight: 700; color: #FFFFFF; margin-top: 14px;">${candidateDisplay}</div>
                  <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 4px;">${officeDisplay}${district ? ' - ' + district : ''}${state ? ', ' + state : ''}</div>
                </td>
              </tr>

              <!-- Data table -->
              <tr>
                <td colspan="2">
                  <table width="100%" cellpadding="0" cellspacing="0">

                    ${section('Campaign Basics', [
                      row('Candidate Name', candidate_name),
                      row('Office', officeFinal),
                      row('District / Jurisdiction', district),
                      row('State', state),
                      row('Election Date', election_date),
                      row('Party', party)
                    ])}

                    ${section('Campaign Team', [
                      row('Campaign Manager', manager_name),
                      row('Campaign Manager Email', manager_email),
                      row('Campaign Manager Phone', manager_phone),
                      row('Treasurer', treasurer_name),
                      row('Campaign Email', campaign_email),
                      row('Campaign Phone', campaign_phone)
                    ])}

                    ${section('About the Candidate', [
                      row('Bio', bio),
                      row('Top Issues', top_issues),
                      row('Tagline', tagline),
                      row('Authority Line', authority_line)
                    ])}

                    ${section('Brand & Design', [
                      row('Colors', colorInfo)
                    ])}

                    ${section('Online Presence', [
                      row('Donation Link', donation_link),
                      row('Existing Website', existing_website),
                      row('Facebook', facebook_url),
                      row('Instagram', instagram_handle),
                      row('X (Twitter)', twitter_handle)
                    ])}

                    ${section('Services to Connect', [
                      row('Services Requested', servicesDisplay || 'None specified')
                    ])}

                    ${section('Additional', [
                      row('Additional Notes', additional_notes),
                      row('How They Found Us', referral_source)
                    ])}

                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td colspan="2" style="background: #0A2540; padding: 16px 28px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.5);">
                  Ark &amp; Dove Campaigns, LLC - sales@arkanddove.ai - arkanddove.ai
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Send notification email. Try Gmail (sends as Johntel) first, fall back to Resend.
  let emailVia = 'gmail';
  try {
    await sendViaGmail({
      from: 'Johntel Greene <johntel@goodgov.ai>',
      to: 'sales@arkanddove.ai',
      replyTo: 'sales@arkanddove.ai',
      subject,
      html: htmlBody
    });
  } catch (gmailErr) {
    console.error('Gmail send failed, falling back to Resend:', gmailErr?.message || gmailErr);
    emailVia = 'resend';
    try {
      await sendViaResend({
        from: 'Johntel Greene <notifications@send.jameskitchin.com>',
        to: 'sales@arkanddove.ai',
        replyTo: 'sales@arkanddove.ai',
        subject,
        html: htmlBody
      });
    } catch (resendErr) {
      console.error('Resend fallback also failed:', resendErr?.message || resendErr);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send notification email' })
      };
    }
  }

  // Push contact to GoHighLevel A&D sub-account. Non-blocking: any failure here
  // is logged and surfaced in the response but does not fail the intake.
  let ghlStatus = 'skipped';
  const ghlToken = process.env.GHL_AD_API_KEY;
  const ghlLocationId = process.env.GHL_AD_LOCATION_ID;

  if (ghlToken && ghlLocationId) {
    const nameParts = (candidate_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');
    const ghlPayload = {
      locationId: ghlLocationId,
      firstName,
      lastName,
      email: campaign_email || manager_email || undefined,
      phone: campaign_phone || manager_phone || undefined,
      source: 'arkanddove.ai intake',
      tags: ['website-lead', 'arkandove-intake', 'demo-request'],
      customFields: [
        { key: 'office', field_value: officeFinal || '' },
        { key: 'district', field_value: district || '' },
        { key: 'state', field_value: state || '' },
        { key: 'election_date', field_value: election_date || '' },
        { key: 'party', field_value: party || '' }
      ]
    };

    try {
      const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ghlToken}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
          'Accept': 'application/json'
        },
        body: JSON.stringify(ghlPayload)
      });

      if (ghlRes.ok) {
        ghlStatus = 'created';
      } else {
        const errBody = await ghlRes.text().catch(() => '');
        console.error('GHL contact create failed:', ghlRes.status, errBody);
        ghlStatus = `error_${ghlRes.status}`;
      }
    } catch (err) {
      console.error('GHL contact create exception:', err);
      ghlStatus = 'exception';
    }
  } else {
    console.warn('GHL env vars missing - skipping contact push', {
      hasToken: !!ghlToken,
      hasLocationId: !!ghlLocationId
    });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, message: 'Intake received', ghl: ghlStatus, email: emailVia })
  };
};
