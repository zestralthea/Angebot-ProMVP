import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';

export const stripeRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });

// POST /api/stripe/checkout — Erstelle Stripe Checkout Session
stripeRouter.post('/checkout', async (req: Request, res: Response) => {
  const { plan, email } = req.body as { plan: 'monthly' | 'annual'; email?: string };

  const priceId = plan === 'annual'
    ? process.env.STRIPE_PRICE_ID_ANNUAL
    : process.env.STRIPE_PRICE_ID_MONTHLY;

  if (!priceId) {
    return res.status(500).json({ code: 'CONFIG_ERROR', message: 'Stripe Price ID nicht konfiguriert' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      locale: 'de',
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/pricing`,
      subscription_data: {
        trial_period_days: 14,  // 14-day free trial
      },
    });
    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ code: 'STRIPE_ERROR', message: 'Fehler beim Erstellen der Checkout Session' });
  }
});

// POST /api/stripe/webhook — Stripe Webhook Handler
stripeRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Webhook signature missing');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return res.status(400).send('Webhook verification failed');
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`Subscription ${event.type}: ${sub.id} status=${sub.status}`);
      // TODO: persist subscription status to database
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`Subscription cancelled: ${sub.id}`);
      // TODO: revoke access in database
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`Payment failed for invoice: ${invoice.id}`);
      // TODO: send dunning email
      break;
    }
  }

  return res.json({ received: true });
});
