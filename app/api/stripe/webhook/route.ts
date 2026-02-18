import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { headers } from "next/headers"

// Lazy-initialize Stripe to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia",
  })
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
  try {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get("stripe-signature")

    if (!signature) {
      logger.error("No Stripe signature found")
      return NextResponse.json({ error: "No signature" }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      logger.error("Webhook signature verification failed", { error: err.message })
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    logger.info("Stripe webhook received", { type: event.type, id: event.id })

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === "subscription") {
          await handleSubscriptionCheckout(session)
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancellation(subscription)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        logger.info("Payment succeeded", {
          subscriptionId: invoice.subscription,
          amount: invoice.amount_paid,
        })
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        logger.warn("Payment failed", {
          subscriptionId: invoice.subscription,
          customerId: invoice.customer,
        })
        break
      }

      default:
        logger.info("Unhandled webhook event", { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error("Webhook processing error", { error: error.message })
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId || session.client_reference_id
  const planId = session.metadata?.planId
  const billing = session.metadata?.billing as "monthly" | "yearly"

  if (!userId || !planId || !billing) {
    logger.error("Missing metadata in checkout session", { sessionId: session.id })
    return
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

  // Create or update subscription in database
  await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId,
      status: "ACTIVE",
      billingCycle: billing === "monthly" ? "MONTHLY" : "YEARLY",
      startDate: new Date(subscription.current_period_start * 1000),
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
    update: {
      planId,
      status: "ACTIVE",
      billingCycle: billing === "monthly" ? "MONTHLY" : "YEARLY",
      startDate: new Date(subscription.current_period_start * 1000),
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
  })

  logger.info("Subscription created from checkout", {
    userId,
    planId,
    subscriptionId: subscription.id,
  })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId

  if (!userId) {
    logger.error("No userId in subscription metadata", { subscriptionId: subscription.id })
    return
  }

  const status = subscription.status === "active" ? "ACTIVE" : 
                 subscription.status === "canceled" ? "CANCELLED" :
                 subscription.status === "past_due" ? "EXPIRED" : "INACTIVE"

  await db.subscription.update({
    where: { userId },
    data: {
      status,
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
  })

  logger.info("Subscription updated", {
    userId,
    subscriptionId: subscription.id,
    status,
  })
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId

  if (!userId) {
    logger.error("No userId in subscription metadata", { subscriptionId: subscription.id })
    return
  }

  await db.subscription.update({
    where: { userId },
    data: {
      status: "CANCELLED",
      endDate: new Date(),
    },
  })

  logger.info("Subscription cancelled", {
    userId,
    subscriptionId: subscription.id,
  })
}
