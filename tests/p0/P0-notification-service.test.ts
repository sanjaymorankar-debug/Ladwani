import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const sendEmail = vi.fn()
vi.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))

import { prisma } from '@/lib/prisma'
import { p0Fixtures } from './fixtures'
import { notifyUser, sendSms } from '@/lib/notify'

const fx = p0Fixtures('p0ntf')
let user: Awaited<ReturnType<typeof fx.person>>

beforeAll(async () => {
  user = await fx.person('u', { mobile: '9822200002' })
})
afterAll(() => fx.cleanup())

describe('P0 Notification service (in-app + email + SMS)', () => {
  it('P0 always records the in-app notification', async () => {
    const r = await notifyUser({ userId: user.userId, type: 'SYSTEM', title: 'Hello', body: 'In-app only' })
    const n = await prisma.notification.findUniqueOrThrow({ where: { id: r!.notificationId } })
    expect(n).toMatchObject({ recipientId: user.userId, title: 'Hello', isRead: false, emailSent: false, smsSent: false })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('P0 emails when asked and flags the delivery; HTML in the text is escaped', async () => {
    sendEmail.mockResolvedValueOnce({ messageId: 'ok' })
    const r = await notifyUser({ userId: user.userId, type: 'SYSTEM', title: 'Role <b>set</b>', also: ['EMAIL'] })
    expect(r!.emailSent).toBe(true)
    expect(sendEmail.mock.calls[0][0].html).toContain('Role &lt;b&gt;set&lt;/b&gt;')
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: r!.notificationId } })).emailSent).toBe(true)
  })

  it('P0 a failed email never throws and is recorded as not sent', async () => {
    sendEmail.mockRejectedValueOnce(new Error('SMTP down'))
    const r = await notifyUser({ userId: user.userId, type: 'SYSTEM', title: 'Still saved', also: ['EMAIL'] })
    expect(r!.emailSent).toBe(false)
    expect(await prisma.notification.count({ where: { id: r!.notificationId } })).toBe(1)
  })

  it('P0 SMS uses the LOG driver until a DLT gateway exists (OP-10) and never claims delivery', async () => {
    expect(await sendSms('9822200002', 'test')).toBe(false)
    const r = await notifyUser({ userId: user.userId, type: 'SYSTEM', title: 'Text me', also: ['SMS'] })
    expect(r!.smsSent).toBe(false)
  })

  it('P0 an unknown recipient returns null instead of throwing', async () => {
    expect(await notifyUser({ userId: 'no-such-user', type: 'SYSTEM', title: 'x' })).toBeNull()
  })
})
