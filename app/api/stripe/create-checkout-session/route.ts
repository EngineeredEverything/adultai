import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { currentUser } from "@/utils/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

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
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { planId, billing } = body

    if (!planId || !billing) {
      return NextResponse.json({ error: "Missing planId or billing" }, { status: 400 })
    }

    // Get plan details
    const plan = await db.plan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Calculate price
    const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice
    if (!price) {
      return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.name} - ${billing === "monthly" ? "Monthly" : "Yearly"}`,
              description: plan.description || undefined,
            },
            unit_amount: price, // price is in cents
            recurring: {
              interval: billing === "monthly" ? "month" : "year",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.APP_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/subscription?canceled=true`,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: {
        bot: "adultai", // Required for fleet revenue tracking
        userId: user.id,
        planId: plan.id,
        billing,
      },
      subscription_data: {
        metadata: {
          bot: "adultai",
          userId: user.id,
          planId: plan.id,
          billing,
        },
      },
    })

    logger.info("Stripe checkout session created", {
      userId: user.id,
      planId,
      billing,
      sessionId: session.id,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error: any) {
    logger.error("Error creating Stripe checkout session", {
      error: error.message,
    })
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
