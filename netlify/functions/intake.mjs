// Ark & Dove Campaigns - Client Intake Function
// Receives form submission, sends formatted email via Resend

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
    switchboard_account_id,
    switchboard_secret_key,
    ghl_api_key,
    van_api_key,
    additional_notes,
    referral_source
  } = body;

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
                      row('Manager Email', manager_email),
                      row('Manager Phone', manager_phone),
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

                    ${section('Integrations', [
                      row('Switchboard Account ID', switchboard_account_id),
                      row('Switchboard Secret Key', switchboard_secret_key ? '(provided - see form submission)' : ''),
                      row('GoHighLevel API Key', ghl_api_key ? '(provided - see form submission)' : ''),
                      row('VAN API Key', van_api_key ? '(provided - see form submission)' : '')
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
                  Ark &amp; Dove Campaigns, LLC - hello@arkandovecampaigns.com
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'Ark & Dove <notifications@send.jameskitchin.com>',
      to: ['johntel.greene@gmail.com'],
      cc: ['michelle@arkandovecampaigns.com'],
      subject,
      html: htmlBody
    })
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error('Resend error:', errText);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification email' })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, message: 'Intake received' })
  };
};
