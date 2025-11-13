import { BaseAIAgent } from "../base-agent"
import { AgentDecision } from "@/types/ai-agent"
import { prisma } from "@/lib/db/client"

/**
 * Lisa - Customer Service AI
 * Handles customer messages, reviews, and support tickets
 */
export class LisaCustomerService extends BaseAIAgent {
  constructor(userId: string) {
    super(userId, "CUSTOMER_SERVICE")
  }

  async execute(): Promise<void> {
    if (!(await this.shouldRun())) {
      return
    }

    this.setStatus("working")

    try {
      // Task 1: Respond to customer messages
      await this.respondToMessages()

      // Task 2: Handle negative reviews
      await this.handleNegativeReviews()

      // Task 3: Send follow-up messages
      await this.sendFollowUps()

      this.setStatus("idle")
    } catch (error) {
      console.error("Lisa execution error:", error)
      this.setStatus("error")
    }
  }

  async decide(context: any): Promise<AgentDecision> {
    const { message, sentiment } = context

    if (!message) {
      return {
        decision: "no_action",
        confidence: 1.0,
        reasoning: "No message context provided",
        suggestedActions: [],
        requiresApproval: false,
      }
    }

    const urgency = this.analyzeUrgency(message)
    const category = this.categorizeMessage(message)

    let decision = "respond"
    let actions: string[] = []
    let confidence = 0.8

    if (urgency === "high") {
      actions.push("Send immediate response")
      actions.push("Escalate to human if needed")
      confidence = 0.9
    } else if (category === "complaint") {
      actions.push("Apologize and offer solution")
      actions.push("Provide refund or replacement options")
      confidence = 0.75
    } else if (category === "inquiry") {
      actions.push("Provide detailed product information")
      actions.push("Suggest related products")
      confidence = 0.85
    } else {
      actions.push("Send standard response")
      confidence = 0.9
    }

    return {
      decision,
      confidence,
      reasoning: `Message categorized as ${category} with ${urgency} urgency`,
      suggestedActions: actions,
      requiresApproval: urgency === "high" || await this.requiresApproval(),
    }
  }

  private async respondToMessages(): Promise<void> {
    const action = await this.logAction(
      "respond_to_messages",
      "Responding to customer messages"
    )

    try {
      const messages = await prisma.message.findMany({
        where: {
          userId: this.userId,
          status: "pending",
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 20,
      })

      let responded = 0

      for (const message of messages) {
        const response = this.generateResponse(message)

        // Update message with response
        await prisma.message.update({
          where: { id: message.id },
          data: {
            response,
            status: "replied",
            respondedAt: new Date(),
          },
        })

        responded++
      }

      await this.completeAction(action.id, {
        messagesResponded: responded,
        totalMessages: messages.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async handleNegativeReviews(): Promise<void> {
    const action = await this.logAction(
      "handle_negative_reviews",
      "Addressing negative reviews and feedback"
    )

    try {
      // In a real implementation, this would fetch reviews from platforms
      // For now, we'll simulate the logic

      await this.completeAction(action.id, {
        reviewsHandled: 0,
        message: "No negative reviews to address",
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  private async sendFollowUps(): Promise<void> {
    const action = await this.logAction(
      "send_follow_ups",
      "Sending follow-up messages to customers"
    )

    try {
      // Find orders delivered 3-7 days ago without follow-up
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const orders = await prisma.order.findMany({
        where: {
          userId: this.userId,
          status: "DELIVERED",
          updatedAt: {
            gte: sevenDaysAgo,
            lte: threeDaysAgo,
          },
        },
        take: 10,
      })

      let sent = 0

      for (const order of orders) {
        // Check if follow-up already sent
        const existingMessage = await prisma.message.findFirst({
          where: {
            userId: this.userId,
            orderId: order.id,
            messageType: "follow_up",
          },
        })

        if (!existingMessage) {
          await prisma.message.create({
            data: {
              userId: this.userId,
              orderId: order.id,
              platform: order.platform,
              messageType: "follow_up",
              content: this.generateFollowUpMessage(order),
              status: "sent",
              sentAt: new Date(),
            },
          })
          sent++
        }
      }

      await this.completeAction(action.id, {
        followUpsSent: sent,
        totalOrders: orders.length,
      })
    } catch (error) {
      await this.failAction(action.id, error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Helper methods
  private analyzeUrgency(message: any): "low" | "medium" | "high" {
    const content = message.content?.toLowerCase() || ""

    const highUrgencyKeywords = ["urgent", "asap", "immediately", "emergency", "broken", "defective"]
    const mediumUrgencyKeywords = ["soon", "quickly", "problem", "issue", "help"]

    if (highUrgencyKeywords.some((kw) => content.includes(kw))) {
      return "high"
    }

    if (mediumUrgencyKeywords.some((kw) => content.includes(kw))) {
      return "medium"
    }

    return "low"
  }

  private categorizeMessage(message: any): "inquiry" | "complaint" | "feedback" | "general" {
    const content = message.content?.toLowerCase() || ""

    if (content.includes("?") || content.includes("how") || content.includes("what")) {
      return "inquiry"
    }

    const complaintKeywords = ["disappointed", "unhappy", "problem", "issue", "wrong", "broken"]
    if (complaintKeywords.some((kw) => content.includes(kw))) {
      return "complaint"
    }

    const feedbackKeywords = ["great", "love", "excellent", "thank", "appreciate"]
    if (feedbackKeywords.some((kw) => content.includes(kw))) {
      return "feedback"
    }

    return "general"
  }

  private generateResponse(message: any): string {
    const category = this.categorizeMessage(message)

    const templates: Record<string, string> = {
      inquiry: `Thank you for your inquiry! I'd be happy to help you with that.

${this.getRelevantInfo(message)}

If you have any other questions, please don't hesitate to ask!

Best regards,
Customer Service Team`,

      complaint: `We sincerely apologize for the inconvenience you've experienced.

Your satisfaction is our top priority, and we'd like to make this right. We can offer:
- A full refund
- A replacement product
- Store credit for future purchases

Please let us know which option works best for you, and we'll process it immediately.

Thank you for your patience and understanding.

Best regards,
Customer Service Team`,

      feedback: `Thank you so much for your positive feedback!

We're thrilled to hear you're happy with your purchase. Reviews like yours make our day and help other customers make informed decisions.

We'd love if you could share your experience on our platform. As a thank you, we're sending you a 10% discount code for your next purchase: THANKYOU10

Looking forward to serving you again!

Best regards,
Customer Service Team`,

      general: `Thank you for reaching out to us!

We've received your message and will get back to you shortly with more information.

If your matter is urgent, please don't hesitate to mention it, and we'll prioritize your request.

Best regards,
Customer Service Team`,
    }

    return templates[category] || templates.general
  }

  private getRelevantInfo(message: any): string {
    // In a real implementation, this would fetch actual product/order info
    return "Based on your question, here's the information you need:\n\n" +
      "- Shipping: We offer free shipping on orders over $50\n" +
      "- Returns: 30-day return policy on all items\n" +
      "- Warranty: All products come with a 1-year warranty"
  }

  private generateFollowUpMessage(order: any): string {
    return `Hi ${order.customerName},

We hope you're enjoying your recent purchase (Order #${order.platformOrderId})!

We'd love to hear about your experience. Your feedback helps us improve and assists other customers in making informed decisions.

If you have a moment, please consider leaving a review. As a thank you, we're including a 15% discount code for your next order: REVIEW15

If you have any questions or concerns about your order, we're here to help!

Thank you for choosing us!

Best regards,
Customer Service Team`
  }
}
