import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    var body = req.body;
    var action = body.action;

    // Create Stripe Checkout session for an invoice
    if (action === 'create-checkout') {
      var invoiceId = body.invoice_id;

      // Load invoice and items
      var invResp = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (invResp.error || !invResp.data) return res.status(404).json({ error: 'Invoice not found' });
      var invoice = invResp.data;

      if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

      var itemsResp = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('sort_order');
      var items = itemsResp.data || [];

      // Build Stripe line items
      var lineItems = items.map(function(item) {
        return {
          price_data: {
            currency: 'usd',
            product_data: { name: item.description },
            unit_amount: Math.round(item.unit_price * 100),
          },
          quantity: Math.round(item.quantity),
        };
      });

      // If no line items, create one from the total
      if (lineItems.length === 0) {
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: { name: invoice.title || 'Invoice ' + invoice.invoice_number },
            unit_amount: Math.round(invoice.total_amount * 100),
          },
          quantity: 1,
        }];
      }

      // Load client email
      var clientEmail = null;
      if (invoice.client_id) {
        var clientResp = await supabase.from('clients').select('email').eq('id', invoice.client_id).single();
        if (clientResp.data && clientResp.data.email) clientEmail = clientResp.data.email;
      }

      var origin = req.headers.origin || req.headers.referer || 'https://fcpc-health-card.vercel.app';
      origin = origin.replace(/\/$/, '');

      var sessionParams = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: origin + '?payment=success&invoice=' + invoiceId,
        cancel_url: origin + '?payment=cancelled&invoice=' + invoiceId,
        metadata: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number || '',
        },
      };

      if (clientEmail) sessionParams.customer_email = clientEmail;

      var session = await stripe.checkout.sessions.create(sessionParams);

      // Save checkout URL to invoice
      await supabase.from('invoices').update({
        stripe_checkout_url: session.url,
        updated_at: new Date().toISOString(),
      }).eq('id', invoiceId);

      return res.status(200).json({ url: session.url });
    }

    // Verify payment status
    if (action === 'verify-payment') {
      var invoiceId2 = body.invoice_id;
      var invResp2 = await supabase.from('invoices').select('stripe_payment_id').eq('id', invoiceId2).single();

      if (invResp2.data && invResp2.data.stripe_payment_id) {
        return res.status(200).json({ paid: true });
      }
      return res.status(200).json({ paid: false });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    console.error('Stripe API error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}