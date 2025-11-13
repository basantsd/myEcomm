import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex")

// Ensure key is 32 bytes
const KEY = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex")

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)

    let encrypted = cipher.update(text, "utf8", "hex")
    encrypted += cipher.final("hex")

    const authTag = cipher.getAuthTag()

    // Return: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt data")
  }
}

export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(":")
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format")
    }

    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
  } catch (error) {
    console.error("Decryption error:", error)
    throw new Error("Failed to decrypt data")
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
