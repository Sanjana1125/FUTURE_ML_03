// server.js — Dialogflow ES webhook (Node 18+) with Airtable ticket creation
require('dotenv').config();
const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');

const app = express();
app.use(express.json());

// Airtable config (Node 18+ has global fetch)
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Tickets';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;

async function createAirtableRecord(fields) {
  const res = await fetch(AIRTABLE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields }] })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data?.records?.[0];
}

// Healthcheck
app.get('/', (_, res) => res.status(200).send('CustomerSupportBot webhook up'));

app.post('/webhook', async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  const say = (msg) => agent.add(msg);

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
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Webhook listening on ${PORT}`));
