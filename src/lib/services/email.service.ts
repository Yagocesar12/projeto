/**
 * EmailService — Resend (server-side only)
 * API key NUNCA vai para o frontend
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@viibeapp.com'
const APP_NAME = 'VIIBE Panel'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://viibepanel.vercel.app'

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

async function sendEmail({ to, subject, html }: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[EmailService] RESEND_API_KEY not set — skipping email')
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: `${APP_NAME} <${FROM_EMAIL}>`, to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[EmailService] Send failed:', err)
      return false
    }

    return true
  } catch (err) {
    console.error('[EmailService] Exception:', err)
    return false
  }
}

// ── Shared layout ───────────────────────────────────────────
function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME}</title>
<style>
  body{margin:0;padding:0;background:#080C10;font-family:'Inter',Arial,sans-serif;color:#E8EDF3}
  .wrap{max-width:560px;margin:0 auto;padding:40px 20px}
  .card{background:#0F1721;border:1px solid #1A2433;border-radius:16px;padding:40px 36px}
  .logo{text-align:center;margin-bottom:32px}
  .logo-box{display:inline-flex;align-items:center;gap:10px;padding:10px 18px;background:#111D2E;border:1px solid #1A3CB5;border-radius:12px}
  .logo-text{font-size:18px;font-weight:700;color:#4D78FF;letter-spacing:0.5px}
  h1{font-size:22px;font-weight:700;color:#E8EDF3;margin:0 0 8px}
  p{font-size:15px;line-height:1.6;color:#8B9BB4;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 28px;background:#2D5AF5;color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;margin:8px 0}
  .info-box{background:#111D2E;border:1px solid #1A2433;border-radius:10px;padding:16px 20px;margin:16px 0}
  .info-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1A2433}
  .info-row:last-child{border-bottom:none}
  .info-label{color:#4A5A70;font-size:13px}
  .info-value{color:#E8EDF3;font-size:13px;font-weight:600}
  .warn{background:#2D1A00;border:1px solid #4D2E00;border-radius:10px;padding:14px 18px;margin:16px 0;color:#F59E0B;font-size:13px}
  .footer{text-align:center;margin-top:24px;color:#4A5A70;font-size:12px}
  .divider{border:none;border-top:1px solid #1A2433;margin:24px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <div class="logo-box">
      <span class="logo-text">${APP_NAME}</span>
    </div>
  </div>
  <div class="card">
    ${content}
  </div>
  <div class="footer">
    <p style="margin:0">&copy; ${new Date().getFullYear()} ${APP_NAME} · Não responda este e-mail</p>
  </div>
</div>
</body>
</html>`
}

// ── Templates ───────────────────────────────────────────────

export class EmailService {

  static async sendEmailConfirmation(to: string, username: string, confirmUrl: string): Promise<boolean> {
    const html = emailLayout(`
      <h1>Confirme sua conta</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>! Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${confirmUrl}" class="btn">Confirmar conta</a>
      </div>
      <p style="font-size:13px;color:#4A5A70">Se você não criou uma conta no ${APP_NAME}, ignore este e-mail.</p>
      <div class="warn">⏱ Este link expira em 24 horas.</div>
    `)
    return sendEmail({ to, subject: `Confirme sua conta — ${APP_NAME}`, html })
  }

  static async sendPasswordReset(to: string, username: string, resetUrl: string): Promise<boolean> {
    const html = emailLayout(`
      <h1>Redefinição de senha</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>! Recebemos uma solicitação para redefinir sua senha.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" class="btn">Redefinir senha</a>
      </div>
      <div class="warn">⚠️ Se não foi você, ignore este e-mail. Sua senha não foi alterada. Este link expira em 1 hora.</div>
    `)
    return sendEmail({ to, subject: `Redefinição de senha — ${APP_NAME}`, html })
  }

  static async sendPasswordChanged(to: string, username: string, ip?: string): Promise<boolean> {
    const html = emailLayout(`
      <h1>Senha alterada</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>. Sua senha foi alterada com sucesso.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Data</span><span class="info-value">${new Date().toLocaleString('pt-BR')}</span></div>
        ${ip ? `<div class="info-row"><span class="info-label">IP</span><span class="info-value">${ip}</span></div>` : ''}
      </div>
      <div class="warn">⚠️ Se não foi você, entre em contato com o suporte imediatamente.</div>
    `)
    return sendEmail({ to, subject: `Senha alterada — ${APP_NAME}`, html })
  }

  static async sendRechargeConfirmation(params: {
    to: string
    username: string
    amountBrl: number
    creditsGranted: number
    balanceAfter: number
    paymentId: string
  }): Promise<boolean> {
    const { to, username, amountBrl, creditsGranted, balanceAfter, paymentId } = params
    const html = emailLayout(`
      <h1>Recarga confirmada ✅</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>! Sua recarga foi processada e os créditos já estão disponíveis.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Valor pago</span><span class="info-value" style="color:#10B981">R$ ${amountBrl.toFixed(2).replace('.', ',')}</span></div>
        <div class="info-row"><span class="info-label">Créditos adicionados</span><span class="info-value" style="color:#4D78FF">+${creditsGranted.toLocaleString('pt-BR')}</span></div>
        <div class="info-row"><span class="info-label">Saldo atual</span><span class="info-value">${balanceAfter.toLocaleString('pt-BR')} créditos</span></div>
        <div class="info-row"><span class="info-label">ID do pagamento</span><span class="info-value" style="font-size:11px;font-family:monospace">${paymentId}</span></div>
        <div class="info-row"><span class="info-label">Data</span><span class="info-value">${new Date().toLocaleString('pt-BR')}</span></div>
      </div>
      <div style="text-align:center;margin:20px 0">
        <a href="${APP_URL}/dashboard/wallet" class="btn">Ver carteira</a>
      </div>
    `)
    return sendEmail({ to, subject: `Recarga de ${creditsGranted.toLocaleString('pt-BR')} créditos confirmada — ${APP_NAME}`, html })
  }

  static async sendCreditAdded(params: {
    to: string
    username: string
    amount: number
    balanceAfter: number
    reason?: string
  }): Promise<boolean> {
    const { to, username, amount, balanceAfter, reason } = params
    const html = emailLayout(`
      <h1>Créditos adicionados 💰</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>! Um administrador adicionou créditos à sua conta.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Créditos adicionados</span><span class="info-value" style="color:#10B981">+${amount.toLocaleString('pt-BR')}</span></div>
        <div class="info-row"><span class="info-label">Saldo atual</span><span class="info-value">${balanceAfter.toLocaleString('pt-BR')} créditos</span></div>
        ${reason ? `<div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${reason}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Data</span><span class="info-value">${new Date().toLocaleString('pt-BR')}</span></div>
      </div>
    `)
    return sendEmail({ to, subject: `+${amount.toLocaleString('pt-BR')} créditos adicionados — ${APP_NAME}`, html })
  }

  static async sendKeyGenerated(params: {
    to: string
    username: string
    keyLast4: string
    duration: string
  }): Promise<boolean> {
    const { to, username, keyLast4, duration } = params
    const html = emailLayout(`
      <h1>Key gerada 🔑</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${username}</strong>! Uma nova key foi gerada na sua conta.</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Identificação</span><span class="info-value" style="font-family:monospace">****${keyLast4}</span></div>
        <div class="info-row"><span class="info-label">Duração</span><span class="info-value">${duration}</span></div>
        <div class="info-row"><span class="info-label">Data</span><span class="info-value">${new Date().toLocaleString('pt-BR')}</span></div>
      </div>
      <p style="font-size:13px;color:#4A5A70">Se não foi você, entre em contato com o suporte.</p>
    `)
    return sendEmail({ to, subject: `Key ****${keyLast4} gerada — ${APP_NAME}`, html })
  }

  static async sendAccountBlocked(params: {
    to: string
    username: string
    reason?: string
  }): Promise<boolean> {
    const html = emailLayout(`
      <h1>Conta bloqueada</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${params.username}</strong>. Sua conta foi bloqueada por um administrador.</p>
      ${params.reason ? `<div class="info-box"><div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${params.reason}</span></div></div>` : ''}
      <p>Entre em contato com o suporte para mais informações.</p>
    `)
    return sendEmail({ to: params.to, subject: `Conta bloqueada — ${APP_NAME}`, html })
  }

  static async sendDeviceBanned(params: {
    to: string
    username: string
    reason?: string
  }): Promise<boolean> {
    const html = emailLayout(`
      <h1>Dispositivo banido</h1>
      <p>Olá, <strong style="color:#E8EDF3">@${params.username}</strong>. Um dos seus dispositivos foi banido da plataforma.</p>
      ${params.reason ? `<div class="info-box"><div class="info-row"><span class="info-label">Motivo</span><span class="info-value">${params.reason}</span></div></div>` : ''}
      <p>Entre em contato com o suporte para mais informações.</p>
    `)
    return sendEmail({ to: params.to, subject: `Dispositivo banido — ${APP_NAME}`, html })
  }
}
