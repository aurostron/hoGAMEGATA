import * as fs from 'fs';
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

async function getLedger(): Promise<string> {
  const r = await callTool('list_blocks', {});
  const text = r.content?.[1]?.text;
  if (!text) return '';
  const data = JSON.parse(text);
  return data.context?.ledger || '';
}

async function run() {
  console.log('--- Loading form Gx49Zp ---');
  await callTool('load_form', { formId: 'Gx49Zp' });

  console.log('--- Updating Intro Text ---');
  await callTool('update_text', {
    updates: [
      {
        blockUuid: 'e7b00928-c789-45ee-99c1-4e7d9a1e11d9',
        html: '<b>Preserving 107,000+ horror games.</b><br>Zero ads. 100% creator & community focused archive. Submit a new title, report corrections, or claim developer ownership.'
      }
    ]
  });

  console.log('--- Creating Question Groups ---');

  // Group 1: Affiliation question
  console.log('1. Affiliation Question...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'TITLE', html: 'What is your relationship to this game?' },
          { type: 'TEXT', html: '<i>Select the option that best describes your role.</i>' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Solo Developer or Studio Team Member' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Publisher or PR Representative' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Horror Fan / Community Member (Tip-off)' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Other', isOtherOption: true }
        ]
      }
    ]
  });

  // Group 2: Branch 1 - Add a Game fields (Part 1: Basic Info)
  console.log('2. Add a Game: Basic Info...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'HEADING_2', html: '<b>➕ New Game Submission</b>' },
          { type: 'TITLE', html: 'Game Title' },
          { type: 'TEXT', html: '<i>Enter the exact title as it appears on storefronts.</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. Crow Country, MADiSON, Iron Lung' },
          { type: 'TITLE', html: 'Developer / Studio Name' },
          { type: 'TEXT', html: '<i>Official developer name or creator handle.</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. BLOODIOUS GAMES, Frictional Games' },
          { type: 'TITLE', html: 'Publisher Name' },
          { type: 'TEXT', html: '<i>Leave blank if self-published or solo developer.</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. Raw Fury, DreadXP, or Self-published' }
        ]
      }
    ]
  });

  // Group 3: Add a Game (Part 2: Status & Links)
  console.log('3. Add a Game: Release Status & Links...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'TITLE', html: 'Release Status' },
          { type: 'TEXT', html: '<i>What is the current development stage of this game?</i>' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Fully Released (Complete Game)' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Early Access' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Free Demo / Prototype / Game Jam Entry' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'In Development (Upcoming / Wishlist Only)' },
          { type: 'TITLE', html: 'Release Date or Target Year' },
          { type: 'TEXT', html: '<i>When was it released or when is it expected?</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. October 2024 or Q1 2025' },
          { type: 'TITLE', html: 'Primary Store / Download URL' },
          { type: 'TEXT', html: '<i>Official Steam, itch.io, GOG, or Epic Games page.</i>' },
          { type: 'INPUT_LINK', placeholder: 'https://store.steampowered.com/app/... or https://dev.itch.io/game' },
          { type: 'TITLE', html: 'Additional Store Links' },
          { type: 'TEXT', html: '<i>Available on other storefronts? Paste them here (one per line).</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 4: Add a Game (Part 3: Tags & Subgenres)
  console.log('4. Add a Game: Horror Subgenres & Tags...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'TITLE', html: 'Horror Subgenres & Themes' },
          { type: 'TEXT', html: '<i>Select all subgenres that apply to help horror fans discover your game.</i>' },
          { type: 'CHECKBOX', text: 'Retro & PS1 / Low-Poly Horror' },
          { type: 'CHECKBOX', text: 'Psychological Horror' },
          { type: 'CHECKBOX', text: 'Survival Horror (Inventory & Scarcity)' },
          { type: 'CHECKBOX', text: 'Found Footage & Analog Horror' },
          { type: 'CHECKBOX', text: 'Mascot & Liminal Space Horror' },
          { type: 'CHECKBOX', text: 'Cosmic & Body Horror' },
          { type: 'CHECKBOX', text: 'Folk & Atmospheric Horror' },
          { type: 'CHECKBOX', text: 'VR Horror' },
          { type: 'CHECKBOX', text: 'Narrative / Walking Simulator' },
          { type: 'CHECKBOX', text: 'Free Game Jam Prototype' },
          { type: 'CHECKBOX', text: 'Other Subgenre', isOtherOption: true }
        ]
      }
    ]
  });

  // Group 5: Add a Game (Part 4: Media & Pitch)
  console.log('5. Add a Game: Media & Pitch...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'TITLE', html: 'Vertical Key Art / Poster' },
          { type: 'TEXT', html: '<i>Upload official portrait poster / capsule art (2:3 aspect ratio recommended, max 10MB).</i>' },
          { type: 'FILE_UPLOAD' },
          { type: 'TITLE', html: 'Official Trailer URL' },
          { type: 'TEXT', html: '<i>YouTube or Vimeo trailer link for instant video preview on gamegata.</i>' },
          { type: 'INPUT_LINK', placeholder: 'https://www.youtube.com/watch?v=...' },
          { type: 'TITLE', html: 'Elevator Pitch / Summary' },
          { type: 'TEXT', html: '<i>1-2 sentences describing the core horror experience and hook.</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 6: Branch 2 - Update Existing Info
  console.log('6. Branch: Update Existing Info...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'HEADING_2', html: '<b>✏️ Update Existing Game Info</b>' },
          { type: 'TITLE', html: 'Game Title or Gamegata Listing URL' },
          { type: 'TEXT', html: '<i>Link to the listing on gamegata.xyz (or exact title).</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. gamegata.xyz/game/visage or Visage' },
          { type: 'TITLE', html: 'What information needs to be updated?' },
          { type: 'TEXT', html: '<i>Select all that apply.</i>' },
          { type: 'CHECKBOX', text: 'Store link is broken, dead, or missing' },
          { type: 'CHECKBOX', text: 'Price / Deal tracking issue' },
          { type: 'CHECKBOX', text: 'Cover art or screenshots are outdated' },
          { type: 'CHECKBOX', text: 'Subgenre tags are missing or inaccurate' },
          { type: 'CHECKBOX', text: 'Developer / Publisher attribution error' },
          { type: 'CHECKBOX', text: 'Release status or date changed' },
          { type: 'CHECKBOX', text: 'Other correction', isOtherOption: true },
          { type: 'TITLE', html: 'Details of Correction' },
          { type: 'TEXT', html: '<i>Please describe what needs to be changed and provide the correct links or values.</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 7: Branch 3 - Claim Developer Ownership
  console.log('7. Branch: Claim Developer Ownership...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'HEADING_2', html: '<b>🛡️ Claim Developer Page / Verification</b>' },
          { type: 'TITLE', html: 'Developer Page or Game(s) on Gamegata' },
          { type: 'TEXT', html: '<i>Enter your developer page link or game titles.</i>' },
          { type: 'INPUT_TEXT', placeholder: 'e.g. gamegata.xyz/developer/bloodious-games' },
          { type: 'TITLE', html: 'Verification Link / Proof of Ownership' },
          { type: 'TEXT', html: '<i>Link proving your identity (studio website, official Twitter/X profile, itch.io account, or press kit).</i>' },
          { type: 'INPUT_LINK', placeholder: 'https://x.com/yourstudio or https://yourstudio.com/press' },
          { type: 'TITLE', html: 'Developer Profile Additions' },
          { type: 'TEXT', html: '<i>Official website, Discord link, Twitter handle, or studio bio to feature on your page.</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 8: Branch 4 - Request Removal
  console.log('8. Branch: Request Removal...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'HEADING_2', html: '<b>🗑️ Listing Removal / Duplicate Report</b>' },
          { type: 'TITLE', html: 'Game Title & Gamegata URL to Remove' },
          { type: 'TEXT', html: '<i>Paste the exact link to the listing you are requesting removal for.</i>' },
          { type: 'INPUT_TEXT', placeholder: 'https://gamegata.xyz/game/...' },
          { type: 'TITLE', html: 'Reason for Removal' },
          { type: 'TEXT', html: '<i>Select the primary reason for this request.</i>' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'I am the copyright holder / rights owner requesting removal' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'The game has been officially cancelled or permanently delisted' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Duplicate entry (needs to be merged with another listing)' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Malicious, stolen, or deceptive content' },
          { type: 'MULTIPLE_CHOICE_OPTION', text: 'Other reason', isOtherOption: true },
          { type: 'TITLE', html: 'Additional Context or Removal Details' },
          { type: 'TEXT', html: '<i>Provide any additional explanation or proof.</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 9: Branch 5 - General Inquiry
  console.log('9. Branch: General Inquiry...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'HEADING_2', html: '<b>💬 General Inquiry / Feedback</b>' },
          { type: 'TITLE', html: 'How can we help?' },
          { type: 'TEXT', html: '<i>Share your feedback, feature suggestion, or database question.</i>' },
          { type: 'TEXTAREA' }
        ]
      }
    ]
  });

  // Group 10: Contact Information (Common)
  console.log('10. Contact Information (Common)...');
  await callTool('create_blocks', {
    groups: [
      {
        blocks: [
          { type: 'DIVIDER' },
          { type: 'HEADING_2', html: '<b>📬 Your Contact Info</b>' },
          { type: 'TITLE', html: 'Contact Email' },
          { type: 'TEXT', html: '<i>We will only use this to send a confirmation when your request has been reviewed.</i>' },
          { type: 'INPUT_EMAIL', placeholder: 'dev@studio.com or yourname@gmail.com' },
          { type: 'TITLE', html: 'Discord or Social Handle (Optional)' },
          { type: 'TEXT', html: '<i>Optional: In case we need a quick clarification regarding your request.</i>' },
          { type: 'INPUT_TEXT', placeholder: '@username on Discord / Twitter' }
        ]
      }
    ]
  });

  console.log('--- Fetching updated ledger ---');
  const ledger = await getLedger();
  fs.writeFileSync('scratch/tally_ledger_after_insert.txt', ledger);
  console.log('Saved ledger to scratch/tally_ledger_after_insert.txt');

  console.log('--- Updating Styling to Gamegata Theme ---');
  await callTool('update_styling', {
    appearance: {
      theme: 'CUSTOM',
      backgroundColor: '#030305',
      textColor: '#ffffff',
      accentColor: '#e50914',
      buttonBackgroundColor: '#e50914',
      buttonTextColor: '#ffffff',
      fontFamily: 'Plus Jakarta Sans',
      submitButtonText: 'Submit Request 🩸'
    },
    advanced: {
      baseFontSize: 16,
      inputHeight: 42,
      inputHorizontalPadding: 14,
      inputMarginBottom: 14,
      inputBorderRadius: 10,
      inputBorderWidth: 1,
      inputBackground: '#0a0b10',
      inputBorder: '#27272a',
      buttonBorderRadius: 10,
      buttonHeight: 46
    }
  });

  console.log('--- Saving and Publishing Form ---');
  const saveRes = await callTool('save_form', {
    formId: 'Gx49Zp',
    status: 'PUBLISHED'
  });
  console.log('Save result:', JSON.stringify(saveRes, null, 2));

  console.log('--- ALL DONE! ---');
}

run().catch(console.error);
