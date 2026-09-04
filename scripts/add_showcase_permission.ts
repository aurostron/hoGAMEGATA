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

  console.log('--- 2. Creating Showcase Permission question block right after Trailer URL ---');
  // Trailer URL input blockUuid is f9c23f3f-19f1-4a65-a03a-1ebb119895a4
  const createRes = await callTool('create_blocks', {
    groups: [
      {
        insertAfterBlockUuid: 'f9c23f3f-19f1-4a65-a03a-1ebb119895a4',
        blocks: [
          {
            type: 'TITLE',
            html: 'Video & Social Showcase Permission'
          },
          {
            type: 'TEXT',
            html: '<i>Can we feature your trailer or gameplay on hoGAMEGATA video showcases and socials?</i>'
          },
          {
            type: 'MULTIPLE_CHOICE_OPTION',
            text: 'Yes — feel free to feature trailer footage and credit our studio'
          },
          {
            type: 'MULTIPLE_CHOICE_OPTION',
            text: 'Yes — contact us first for approval / press kit'
          },
          {
            type: 'MULTIPLE_CHOICE_OPTION',
            text: 'No — listing on the database only'
          }
        ]
      }
    ]
  });
  console.log('Create blocks response feedback:', createRes.structuredContent?.context?.feedback || 'Created blocks');

  console.log('--- 3. Fetching updated ledger to retrieve new block & question UUIDs ---');
  const listRes = await callTool('list_blocks', {});
  const ledgerText = listRes.content?.[1]?.text;
  const rawData = JSON.parse(ledgerText);
  const ledger = rawData.context?.ledger || '';

  // Parse lines to locate the new question and options
  const lines = ledger.split('\n');
  let newQuestionUuid = null;
  const newOptionUuids = [];

  for (const line of lines) {
    if (line.includes('Video &amp; Social Showcase Permission') || line.includes('Video & Social Showcase Permission')) {
      const parts = line.split('|').map(s => s.trim());
      newQuestionUuid = parts[5]; // questionUuid column
    }
    if (
      line.includes('feel free to feature trailer footage') ||
      line.includes('contact us first for approval') ||
      line.includes('listing on the database only')
    ) {
      const parts = line.split('|').map(s => s.trim());
      newOptionUuids.push(parts[3]); // blockUuid
    }
  }

  console.log('New Question Group UUID:', newQuestionUuid);
  console.log('New Option UUIDs:', newOptionUuids);

  if (!newQuestionUuid || newOptionUuids.length < 3) {
    throw new Error('Failed to find new question or option UUIDs in ledger');
  }

  console.log('--- 4. Setting badgeType="OFF" on new options for high contrast ---');
  await callTool('configure_blocks', {
    updates: newOptionUuids.map(uuid => ({
      blockUuid: uuid,
      operation: 'choice_behavior',
      badgeType: 'OFF'
    }))
  });

  console.log('--- 5. Updating Branch 1 Conditional Logic Rule to show new question ---');
  const routerQuestionUuid = '0244b7e9-9efd-4998-8fbb-a1245fe4fb8a';
  const optAddGame = '963e1c4f-4d80-4670-9f74-4ddf8b7a21f4';
  const logicRuleBlockUuid = '4478f761-3ec8-43a4-9b69-adc7ae4a2045';

  const updatedDslAddGame = `WHEN ${routerQuestionUuid} IS ${optAddGame} THEN SHOW fad8f982-caed-4821-8d45-d13f5042fc73, SHOW 3835ee10-3aa7-4d02-b6a4-c22fec797d76, SHOW 4f8a815a-6c22-404a-8eca-363ef5ccd754, SHOW c9731c42-ede4-44a9-b85c-581a5ec5a433, SHOW 88877302-f340-4b81-883d-37d6a6912c2a, SHOW 8df9abf6-3ed4-4db4-923f-4727f0ea2fb0, SHOW a222bead-7b49-41d4-8b93-65244d0ed69b, SHOW 4db224df-2074-4052-a143-cee40792a04e, SHOW b0f20c91-abb7-4c8b-a857-bf470003a604, SHOW 1858840c-4d34-447f-8c42-69ef3f8639d8, SHOW 14dae930-104b-45fa-a265-7987756c0b3a, SHOW ${newQuestionUuid}, SHOW c4125a18-0cb5-475f-b159-9e254463e7e7`;

  const logicRes = await callTool('apply_logic', {
    operations: [
      {
        operation: 'update',
        blockUuid: logicRuleBlockUuid,
        dsl: updatedDslAddGame
      }
    ]
  });
  console.log('Apply logic response:', logicRes.structuredContent?.context?.feedback || 'Success');

  console.log('--- 6. Saving and Publishing form ---');
  const saveRes = await callTool('save_form', {
    formId: 'Gx49Zp',
    status: 'PUBLISHED'
  });
  console.log('Save result:', saveRes.structuredContent?.data ? 'Published successfully' : saveRes);

  console.log('--- 7. Verifying live form ---');
  const liveRes = await fetch('https://tally.so/r/Gx49Zp?_cb=' + Date.now());
  const html = await liveRes.text();

  const hasNewQuestion = html.includes('Video &amp; Social Showcase Permission') || html.includes('Video & Social Showcase Permission');
  const hasOpt1 = html.includes('feel free to feature trailer footage');
  console.log('Verification on live page:');
  console.log('  New question present:', hasNewQuestion);
  console.log('  Options present:', hasOpt1);

  console.log('--- ALL DONE! ---');
}

run().catch(console.error);
