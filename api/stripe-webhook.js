import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  var chunks = [];
  return new Promise(function(resolve, reject) {
    req.on('data', function(chunk) { chunks.push(chunk); });
    req.on('end', function() { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read body' });
  }

  var sig = req.headers['stripe-signature'];
  var webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // If no webhook secret configured, just parse the event directly
  var event;
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    try {
      event = JSON.parse(rawBody.toString());
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  if (event.type === 'checkout.session.completed') {
    var session = event.data.object;
    var invoiceId = session.metadata && session.metadata.invoice_id;

    if (invoiceId) {
      await supabase.from('invoices').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_id: session.payment_intent || session.id,
        updated_at: new Date().toISOString(),
      }).eq('id', invoiceId);

      console.log('Invoice marked paid:', invoiceId);
    }
  }

  return res.status(200).json({ received: true });
}