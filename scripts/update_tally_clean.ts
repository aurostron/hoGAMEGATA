const apiKey = process.env.TALLY_API_KEY || 'tly-yqLZQHLYj0qKzHxMCJxxz971ppG2XM8Q';

async function callTool(name, args = {}) {
  const res = await fetch('https://api.tally.so/mcp', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now() + Math.floor(Math.random() * 1000),
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });

  const text = await res.text();
  for (const l of text.split('\n')) {
    if (l.startsWith('data: ')) {
      const data = JSON.parse(l.slice(6));
      if (data.error) throw new Error(JSON.stringify(data.error));
      return data.result;
    }
  }
}

async function run() {
  console.log('--- 1. Loading form Gx49Zp ---');
  await callTool('load_form', { formId: 'Gx49Zp' });

  console.log('--- 2. Removing emojis from headings (pure plain text) ---');
  const textUpdateRes = await callTool('update_text', {
    updates: [
      {
        blockUuid: 'fad8f982-caed-4821-8d45-d13f5042fc73',
        html: '<b>New Game Submission</b>'
      },
      {
        blockUuid: '311833d0-ef2a-434b-b8a4-c1f075b92f91',
        html: '<b>Update Existing Game Info</b>'
      },
      {
        blockUuid: '43403dcf-a4cc-4d84-8c62-bc47537219fc',
        html: '<b>Claim Developer Page / Verification</b>'
      },
      {
        blockUuid: '7d9ac253-7dd2-44e7-ba33-1ca14bc1168a',
        html: '<b>Listing Removal / Duplicate Report</b>'
      },
      {
        blockUuid: 'b586cd06-15bf-4efb-b965-dfd59278d112',
        html: '<b>General Inquiry / Feedback</b>'
      },
      {
        blockUuid: 'a9efc4d0-fa1f-4aed-a849-31771b395763',
        html: '<b>Your Contact Info</b>'
      }
    ]
  });
  console.log('Text update feedback:', textUpdateRes.structuredContent?.context?.feedback || 'Success');

  console.log('--- 3. Configuring badgeType="OFF" on all 18 Multiple Choice options ---');
  const allChoiceUuids = [
    // Request Type (5)
    '963e1c4f-4d80-4670-9f74-4ddf8b7a21f4',
    '347fe977-e111-4fe5-978a-5fda5826947d',
    '7e53d7c9-4d83-4fe3-8155-9440e0e44a9a',
    '6af9a262-4fe3-42cb-9913-a19a77c115ef',
    '264bbb79-8c9b-4c11-a132-ba5a474886e3',
    // Affiliation / Relationship (4)
    '78bb95f8-8bb4-45e2-a2fa-c43e6a611efe',
    'a9320290-a5af-48f9-8a10-dcfb8e71bb12',
    '785de4db-6f11-47eb-bce4-919b2c9be09e',
    'ddf3a141-928e-4edd-9068-6f8937d9a37d',
    // Release Status (4)
    'f323be9f-c9c2-48ee-b5f3-c8eb7fa19fce',
    '99eadfd9-bb37-4580-9e49-4e38b7f93a1a',
    '414ff9b9-7d9f-4421-b2e7-1b2532a33301',
    '8fc5f6d5-1439-44ec-960e-e14bc3d9504e',
    // Reason for Removal (5)
    '71d443e5-d40d-4bd8-9cb9-70dbb0e6aca4',
    '9f0846aa-956a-498e-bb6e-61d07fd0086f',
    '775b7baa-e158-444a-9343-2f1245aa916c',
    '8c234acf-6cc9-4fd6-8d28-3d54548f9204',
    'ec051f5e-3c27-425f-b79a-4627e232e7fa'
  ];

  const configRes = await callTool('configure_blocks', {
    updates: allChoiceUuids.map(uuid => ({
      blockUuid: uuid,
      operation: 'choice_behavior',
      badgeType: 'OFF'
    }))
  });
  console.log('Choice behavior feedback:', configRes.structuredContent?.context?.feedback || 'Success');

  console.log('--- 4. Updating form styling to high-contrast Gamegata theme ---');
  const styleRes = await callTool('update_styling', {
    appearance: {
      theme: 'CUSTOM',
      backgroundColor: '#050508',
      textColor: '#ffffff',
      accentColor: '#e50914',
      buttonBackgroundColor: '#e50914',
      buttonTextColor: '#ffffff',
      fontFamily: 'Plus Jakarta Sans',
      submitButtonText: 'Submit Request'
    }
  });
  console.log('Styling feedback:', styleRes.structuredContent?.context?.feedback || 'Success');

  console.log('--- 5. Saving and Publishing form ---');
  const saveRes = await callTool('save_form', {
    formId: 'Gx49Zp',
    status: 'PUBLISHED'
  });
  console.log('Save result:', saveRes.structuredContent?.data ? 'Form published successfully' : saveRes);

  console.log('--- 6. Verifying live form at https://tally.so/r/Gx49Zp ---');
  const liveRes = await fetch('https://tally.so/r/Gx49Zp?_t=' + Date.now());
  const html = await liveRes.text();

  // Check emojis
  const emojis = ['➕', '✏️', '🛡️', '🗑️', '💬', '📬', '🩸'];
  const foundEmojis = emojis.filter(e => html.includes(e));
  console.log('Emojis found on live page (should be none):', foundEmojis);

  // Check enumeration badges (should be none because badgeType is OFF)
  const hasBadges = html.includes('tally-enumeration-badge') || html.includes('tally-alphabet-badge');
  console.log('Has low-contrast enumeration badges (should be false):', hasBadges);

  // Check theme
  const idx = html.indexOf('__NEXT_DATA__');
  const start = html.indexOf('>', idx) + 1;
  const end = html.indexOf('</script>', start);
  const data = JSON.parse(html.slice(start, end));
  const p = data.props.pageProps;
  console.log('Live form theme:', {
    theme: p.theme.is,
    background: p.theme.color.background,
    text: p.theme.color.text,
    accent: p.theme.color.accent,
    buttonBg: p.theme.color.button.bg,
    buttonText: p.theme.color.button.fg
  });

  console.log('--- ALL DONE! Form is updated and verified! ---');
}

run().catch(console.error);
