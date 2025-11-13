import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { Platform } from "@prisma/client"
import { queueWebhookProcessing } from "@/lib/queue/jobs"
import { prisma } from "@/lib/db/client"

// Webhook verification functions
function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET || ""
  const hash = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
  return hash === hmacHeader
}

function verifyEbayWebhook(body: string, signatureHeader: string): boolean {
  // eBay uses challenge-response for initial verification
  // and signature verification for actual webhooks
  const secret = process.env.EBAY_WEBHOOK_SECRET || ""
  const hash = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")
  return hash === signatureHeader
}

function verifyAmazonWebhook(body: string, signatureHeader: string): boolean {
  const secret = process.env.AMAZON_WEBHOOK_SECRET || ""
  const hash = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
  return hash === signatureHeader
}

export async function POST(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const platform = params.platform.toUpperCase() as Platform
    const body = await req.text()
    let payload: any

    try {
      payload = JSON.parse(body)
    } catch {
      payload = body
    }

    // Verify webhook signature based on platform
    let isValid = true

    switch (platform) {
      case Platform.SHOPIFY:
        const shopifyHmac = req.headers.get("X-Shopify-Hmac-SHA256")
        if (shopifyHmac) {
          isValid = verifyShopifyWebhook(body, shopifyHmac)
        }
        break

      case Platform.EBAY:
        // eBay challenge-response verification
        if (payload.challenge_code) {
          const challengeResponse = {
            challengeResponse: crypto
              .createHash("sha256")
              .update(payload.challenge_code + process.env.EBAY_VERIFICATION_TOKEN + process.env.EBAY_WEBHOOK_ENDPOINT)
              .digest("hex"),
          }
          return NextResponse.json(challengeResponse)
        }
        const ebaySignature = req.headers.get("X-EBAY-SIGNATURE")
        if (ebaySignature) {
          isValid = verifyEbayWebhook(body, ebaySignature)
        }
        break

      case Platform.AMAZON:
        const amazonSignature = req.headers.get("X-Amz-SNS-Signature")
        if (amazonSignature) {
          isValid = verifyAmazonWebhook(body, amazonSignature)
        }
        break

      case Platform.ETSY:
        // Etsy doesn't provide signature verification
        // Verify by checking expected payload structure
        isValid = payload && payload.event_type
        break

      case Platform.WOOCOMMERCE:
        const wooSignature = req.headers.get("X-WC-Webhook-Signature")
        if (wooSignature && process.env.WOOCOMMERCE_WEBHOOK_SECRET) {
          const hash = crypto
            .createHmac("sha256", process.env.WOOCOMMERCE_WEBHOOK_SECRET)
            .update(body)
            .digest("base64")
          isValid = hash === wooSignature
        }
        break

      case Platform.GOOGLE_SHOPPING:
        // Google Cloud Pub/Sub verification
        // Check if it's a push notification
        if (payload.message) {
          isValid = true // Additional verification can be added
        }
        break

      default:
        return NextResponse.json(
          { error: "Unsupported platform" },
          { status: 400 }
        )
    }

    if (!isValid) {
      console.warn(`Invalid webhook signature for ${platform}`)
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      )
    }

    // Extract event type and determine userId
    let event = "unknown"
    let userId = ""

    switch (platform) {
      case Platform.SHOPIFY:
        event = req.headers.get("X-Shopify-Topic") || "unknown"
        const shop = req.headers.get("X-Shopify-Shop-Domain")
        if (shop) {
          const connection = await prisma.platformConnection.findFirst({
            where: {
              platform: Platform.SHOPIFY,
              metadata: { path: ["shop"], equals: shop },
            },
          })
          userId = connection?.userId || ""
        }
        break

      case Platform.EBAY:
        event = payload.metadata?.topic || "unknown"
        // Extract userId from notification payload
        break

      case Platform.AMAZON:
        event = payload.NotificationType || "unknown"
        break

      case Platform.ETSY:
        event = payload.event_type || "unknown"
        break

      case Platform.WOOCOMMERCE:
        event = req.headers.get("X-WC-Webhook-Event") || "unknown"
        break

      case Platform.GOOGLE_SHOPPING:
        event = payload.message?.attributes?.eventType || "unknown"
        break
    }

    // Queue webhook for processing
    if (userId) {
      await queueWebhookProcessing({
        platform,
        event,
        payload,
        userId,
      })
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook verification (some platforms use this)
export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const searchParams = req.nextUrl.searchParams
  const platform = params.platform.toUpperCase()

  // Shopify verification
  if (platform === "SHOPIFY") {
    const hmac = searchParams.get("hmac")
    const shop = searchParams.get("shop")

    if (hmac && shop) {
      return NextResponse.json({ verified: true })
    }
  }

  // eBay verification
  if (platform === "EBAY") {
    const challenge = searchParams.get("challenge_code")
    if (challenge) {
      const response = crypto
        .createHash("sha256")
        .update(challenge + process.env.EBAY_VERIFICATION_TOKEN + process.env.EBAY_WEBHOOK_ENDPOINT)
        .digest("hex")

      return new NextResponse(response, {
        headers: { "Content-Type": "text/plain" },
      })
    }
  }

  return NextResponse.json({ status: "ok" })
}
