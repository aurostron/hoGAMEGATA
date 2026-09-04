import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.TALLY_API_KEY || 'tly-yqLZQHLYj0qKzHxMCJxxz971ppG2XM8Q';

async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
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
      if (data.error) {
        throw new Error(`Tool ${name} error: ${JSON.stringify(data.error)}`);
      }
      return data.result;
    }
  }
  throw new Error(`No data returned from tool ${name}: ${text}`);
}

async function run() {
  console.log('--- Setting isRequired on core questions ---');
  await callTool('configure_blocks', {
    updates: [
      {
        blockUuid: '00890675-a555-47a8-a370-366c44680a1f',
        operation: 'input_settings',
        isRequired: true
      },
      {
        blockUuid: '3533cad0-ddcb-424a-8199-4163ebacdb59',
        operation: 'input_settings',
        isRequired: true
      },
      {
        blockUuid: '4b750e7a-066b-4757-bb12-c6b2802bf487',
        operation: 'input_settings',
        isRequired: true
      }
    ]
  });

  console.log('--- Applying Conditional Branching Logic Rules ---');

  const routerQuestionUuid = '0244b7e9-9efd-4998-8fbb-a1245fe4fb8a';

  // Option 1: Add a new game
  const optAddGame = '963e1c4f-4d80-4670-9f74-4ddf8b7a21f4';
  const dslAddGame = `WHEN ${routerQuestionUuid} IS ${optAddGame} THEN SHOW fad8f982-caed-4821-8d45-d13f5042fc73, SHOW 3835ee10-3aa7-4d02-b6a4-c22fec797d76, SHOW 4f8a815a-6c22-404a-8eca-363ef5ccd754, SHOW c9731c42-ede4-44a9-b85c-581a5ec5a433, SHOW 88877302-f340-4b81-883d-37d6a6912c2a, SHOW 8df9abf6-3ed4-4db4-923f-4727f0ea2fb0, SHOW a222bead-7b49-41d4-8b93-65244d0ed69b, SHOW 4db224df-2074-4052-a143-cee40792a04e, SHOW b0f20c91-abb7-4c8b-a857-bf470003a604, SHOW 1858840c-4d34-447f-8c42-69ef3f8639d8, SHOW 14dae930-104b-45fa-a265-7987756c0b3a, SHOW c4125a18-0cb5-475f-b159-9e254463e7e7`;

  // Option 2: Update existing info
  const optUpdateInfo = '347fe977-e111-4fe5-978a-5fda5826947d';
  const dslUpdateInfo = `WHEN ${routerQuestionUuid} IS ${optUpdateInfo} THEN SHOW 311833d0-ef2a-434b-b8a4-c1f075b92f91, SHOW 87be2265-d114-457c-a641-6d2763435c4f, SHOW 858152ba-00ff-4686-8d5d-f0a22b4d034c, SHOW ee7dbfcf-fe15-4923-a773-d32c19cf5d7f`;

  // Option 3: Claim developer ownership
  const optClaimDev = '7e53d7c9-4d83-4fe3-8155-9440e0e44a9a';
  const dslClaimDev = `WHEN ${routerQuestionUuid} IS ${optClaimDev} THEN SHOW 43403dcf-a4cc-4d84-8c62-bc47537219fc, SHOW 4d94ee3f-7639-4daa-8fee-ed12a21a09d7, SHOW 57b9bd4d-ceeb-4383-93a4-b7fe2ed3baab, SHOW 88708930-48d0-42fb-a922-25853b9449e6`;

  // Option 4: Request removal
  const optRemoval = '6af9a262-4fe3-42cb-9913-a19a77c115ef';
  const dslRemoval = `WHEN ${routerQuestionUuid} IS ${optRemoval} THEN SHOW 7d9ac253-7dd2-44e7-ba33-1ca14bc1168a, SHOW 8d5a7f66-8b06-4aa0-886b-6fbffff4895f, SHOW 5299178c-1357-4291-a34d-6cd4ad16575d, SHOW 4b7cf4a2-f384-4864-86d3-1a2591568881`;

  // Option 5: General inquiry
  const optInquiry = '264bbb79-8c9b-4c11-a132-ba5a474886e3';
  const dslInquiry = `WHEN ${routerQuestionUuid} IS ${optInquiry} THEN SHOW b586cd06-15bf-4efb-b965-dfd59278d112, SHOW 78eaac9a-f38e-407c-a95e-c43e76e0a4a7`;

  const logicRes = await callTool('apply_logic', {
    operations: [
      { operation: 'insert', dsl: dslAddGame },
      { operation: 'insert', dsl: dslUpdateInfo },
      { operation: 'insert', dsl: dslClaimDev },
      { operation: 'insert', dsl: dslRemoval },
      { operation: 'insert', dsl: dslInquiry }
    ]
  });
  console.log('Logic applied:', logicRes ? 'Success' : 'Error');

  console.log('--- Saving and Publishing Form ---');
  const saveRes = await callTool('save_form', { formId: 'Gx49Zp', status: 'PUBLISHED' });
  console.log('Final save:', saveRes.structuredContent?.data || saveRes);
}

run().catch(console.error);
