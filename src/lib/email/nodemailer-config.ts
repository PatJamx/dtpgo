import nodemailer, { Transporter } from 'nodemailer'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo?: string
}

const getEnv = (key: string, required = true): string | undefined => {
  const value = process.env[key]
  if (required && (!value || value.length === 0)) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function createSmtpConfig(): SmtpConfig {
  const host = 'smtp.gmail.com' as string
  const port =  587
  const secure = false
  const user = 'patrickjamila85@gmail.com' as string
  const pass = 'htyq soay cyva jjbb' as string
  const from = 'patrickjamila85@gmail.com' as string
  const replyTo ='patrickjamila85@gmail.com'

  return { host, port, secure, user, pass, from, replyTo }
}

export function createTransporter(config: SmtpConfig): Transporter {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  return transporter
}

export function getEmailDefaults() {
  const { from, replyTo } = createSmtpConfig()
  return { from, replyTo }
}


