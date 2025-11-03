// api/webhook.js — Vercel serverless function (Node 18+) with Airtable
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { WebhookClient } = await import('dialogflow-fulfillment');
  const agent = new WebhookClient({ request: req, response: res });
  const say = (msg) => agent.add(msg);

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Tickets';
  const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;

  async function createAirtableRecord(fields) {
    const r = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: [{ fields }] })
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Airtable error ${r.status}: ${text}`);
    }
    const data = await r.json();
    return data?.records?.[0];
  }

  async function Create_Ticket() {
    const p = agent.parameters || {};
    const name = p.name;
    const email = p.email;
    const orderId = p.order_id;
    const issueType = p.issue_type;
    const description = p.description;

    if (!name || !email || !orderId || !issueType || !description) {
      say('I’m missing some details. Please provide name, email, order ID, issue type, and a brief description.');
      return;
    }
    try {
      const rec = await createAirtableRecord({
        Name: String(name),
        Email: String(email),
        OrderID: String(orderId),
        IssueType: String(issueType),
        Description: String(description),
        Status: 'New'
      });
      const ticketId = rec?.id || 'TICKET';
      say(`✅ Ticket created successfully!\n\nTicket ID: ${ticketId}\nWe’ve emailed a confirmation to ${email}. Our team will get back within 24 hours.`);
    } catch (e) {
      console.error(e);
      say('Sorry, something went wrong while creating your ticket. Please try again in a minute, or email support@example.com.');
    }
  }

  function Default_Fallback() {
    say("Sorry, I didn’t get that. You can say: ‘Create a ticket’, ‘Where is my order?’, or ‘Refund status’.");
  }

  const intentMap = new Map([
    ['Create_Ticket', Create_Ticket],
    ['Default Fallback Intent', Default_Fallback]
  ]);

  agent.handleRequest(intentMap);
}
