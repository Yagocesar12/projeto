import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { EmailService } from '@/lib/services/email.service'

// Verificar assinatura Mercado Pago
async function verifyMercadoPagoSignature(
  body: string,
  xSignature: string | null,
  xRequestId: string | null,
  secret: string
): Promise<boolean> {
  if (!xSignature || !xRequestId) return false
  try {
    const parts = xSignature.split(',')
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
    const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1]
    if (!ts || !v1) return false

    const manifest = `id:;request-id:${xRequestId};ts:${ts};`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return computed === v1
  } catch { return false }
}

// Verificar assinatura Efí
async function verifyEfiSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    return computed === signature
  } catch { return false }
}

async function processApprovedPayment(externalPaymentId: string, service: Awaited<ReturnType<typeof createServiceClient>>) {
  // RPC atômica — idempotente
  const { data } = await service.rpc('approve_payment_atomic', {
    p_payment_id: externalPaymentId,
    p_idempotency_key: externalPaymentId,
  })

  if (!data?.success) {
    if (data?.already_processed) return { ok: true, alreadyProcessed: true }
    return { ok: false, error: data?.error }
  }

  // Buscar dados do usuário para email
  const { data: profile } = await service
    .from('profiles')
    .select('username, email')
    .eq('id', data.user_id)
    .single()

  if (profile) {
    EmailService.sendRechargeConfirmation({
      to: profile.email,
      username: profile.username,
      amountBrl: data.amount_brl,
      creditsGranted: data.credits_granted,
      balanceAfter: data.balance_after,
      paymentId: externalPaymentId,
    }).catch(console.error)
  }

  return { ok: true, alreadyProcessed: false }
}

// POST /api/webhooks/mercadopago
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider

  try {
    const rawBody = await request.text()
    const service = await createServiceClient()

    if (provider === 'mercadopago') {
      const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || ''
      const xSig = request.headers.get('x-signature')
      const xReqId = request.headers.get('x-request-id')

      // Em produção, sempre verificar assinatura
      if (secret && !(await verifyMercadoPagoSignature(rawBody, xSig, xReqId, secret))) {
        console.warn('[webhook/mercadopago] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      const body = JSON.parse(rawBody)

      // Log do webhook recebido — registrado apenas se a tabela existir
      try {
        await service.from('payment_transactions').update({
          webhook_received_at: new Date().toISOString(),
          webhook_payload: body,
        } as any).eq('payment_id', body.data?.id || body.id || '')
      } catch { /* tabela pode não existir ainda */ }

      // Processar apenas pagamentos aprovados
      if (body.type === 'payment' && body.action === 'payment.updated') {
        const paymentId = body.data?.id?.toString() || body.id?.toString()
        if (!paymentId) return NextResponse.json({ ok: true })

        // Buscar status real no MP
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
        })
        if (!mpRes.ok) return NextResponse.json({ ok: true })

        const mpData = await mpRes.json()
        if (mpData.status !== 'approved') return NextResponse.json({ ok: true })

        const result = await processApprovedPayment(paymentId, service)
        if (!result.ok) {
          console.error('[webhook/mercadopago] processApprovedPayment failed:', result.error)
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (provider === 'efi') {
      const secret = process.env.EFI_WEBHOOK_SECRET || ''
      const signature = request.headers.get('x-gn-signature')

      if (secret && !(await verifyEfiSignature(rawBody, signature, secret))) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }

      const body = JSON.parse(rawBody)

      if (body.event === 'OPENPIX:CHARGE_COMPLETED') {
        const paymentId = body.charge?.correlationID || body.charge?.txid
        if (paymentId) {
          await processApprovedPayment(paymentId, service)
        }
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  } catch (error) {
    console.error(`[webhook/${provider}]`, error)
    // Sempre retornar 200 para evitar reenvios desnecessários
    return NextResponse.json({ ok: true })
  }
}
