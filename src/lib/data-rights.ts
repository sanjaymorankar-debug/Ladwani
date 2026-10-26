import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { notifyUser } from '@/lib/notify'
import { deletePhotoObjects } from '@/lib/storage'
import { endMembership } from '@/lib/organisations'
import { removeAllFriendships } from '@/lib/friends'

/**
 * F40 — a person's own data, as one JSON document (never the password hash,
 * other people's contact details or internal storage keys).
 */
export async function exportOwnData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, mobile: true, status: true, createdAt: true, lastLoginAt: true, joinIntent: true },
  })
  const member = await prisma.member.findUnique({
    where: { userId },
    include: {
      addresses: true, education: true, employment: true, businesses: true, profileDetails: true, skills: { include: { skill: { select: { name: true } } } },
      memberAreas: { include: { area: { select: { name: true, type: true } } } },
      families: { include: { family: { select: { name: true, registrationNumber: true } } } },
      maritalHistory: true,
      matrimonialProfile: true,
    },
  })
  const memberId = member?.id ?? ''
  const [relationships, photos, posts, comments, consents, interests, friendships, organisations, idProofs] = await Promise.all([
    prisma.memberRelationship.findMany({ where: { fromMemberId: memberId }, select: { toMember: { select: { firstName: true, lastName: true } }, relationshipType: { select: { label: true } }, createdAt: true } }),
    prisma.photo.findMany({ where: { OR: [{ memberId }, { uploadedBy: userId }] }, select: { id: true, ownerType: true, caption: true, visibility: true, createdAt: true } }),
    prisma.post.findMany({ where: { authorId: userId }, select: { id: true, title: true, content: true, status: true, audienceType: true, createdAt: true, deletedAt: true } }),
    prisma.comment.findMany({ where: { authorId: userId }, select: { id: true, postId: true, content: true, createdAt: true, deletedAt: true } }),
    prisma.consentRecord.findMany({ where: { userId }, select: { consentType: true, granted: true, version: true, declarationText: true, grantedAt: true, revokedAt: true, ipAddress: true } }),
    prisma.matrimonialInterest.findMany({ where: { OR: [{ fromMemberId: memberId }, { toMemberId: memberId }] }, select: { status: true, createdAt: true, fromMemberId: true, toMemberId: true } }),
    prisma.friendship.findMany({ where: { OR: [{ requesterMemberId: memberId }, { addresseeMemberId: memberId }] }, select: { status: true, requesterMemberId: true, addresseeMemberId: true, createdAt: true } }),
    prisma.organisationMember.findMany({ where: { memberId }, select: { organisationId: true, designation: true, status: true, joinedAt: true, endedAt: true } }),
    prisma.idProof.findMany({ where: { memberId }, select: { idType: true, idLast4: true, status: true, createdAt: true } }),
  ])
  return {
    exportedAt: new Date().toISOString(),
    account: user, profile: member, relationships, photos, posts, comments, consents,
    marriageBureauInterests: interests, friendships, organisations,
    idProofs: idProofs.map((p) => ({ ...p, idLast4: p.idLast4 ? `XXXX${p.idLast4}` : null })),
  }
}

/**
 * F40 — anonymise a person on an Admin's decision. The person node stays
 * (as "Former member") so every family tree keeps its shape; everything that
 * identifies them is erased: contact details, addresses, documents, photos,
 * profile details, bureau listing, friendships, posts. The login is closed.
 * Consent records and the audit log are kept as legal records.
 * A Karta must hand over the family first.
 */
export async function anonymise(requestId: string, adminId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const request = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } })
  if (!request || request.status !== 'PENDING') return { ok: false, message: 'This request is not pending' }
  const member = await prisma.member.findUnique({ where: { userId: request.userId } })
  if (member && (await prisma.familyMember.findFirst({ where: { memberId: member.id, isKarta: true, leftAt: null } }))) {
    return { ok: false, message: 'This person is a Karta. Hand the family over to a new Karta first (F16).' }
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: request.userId } })
  // Confirmation goes out while the email address still exists.
  await notifyUser({ userId: user.id, type: 'DATA_DELETION', title: 'Your account is being deleted', body: 'Your personal data is being erased as you asked. Family trees keep an anonymous entry.', data: { requestId }, also: ['EMAIL'] })

  const M = member?.id ?? null
  const photos = await prisma.photo.findMany({ where: { OR: [...(M ? [{ memberId: M }] : []), { uploadedBy: user.id }] } })
  const proofs = M ? await prisma.idProof.findMany({ where: { memberId: M } }) : []
  if (M) {
    for (const o of await prisma.organisationMember.findMany({ where: { memberId: M, status: { in: ['ACTIVE', 'INVITED', 'REQUESTED'] } } })) {
      await endMembership(o.organisationId, M, 'ACCOUNT_DELETED', adminId)
    }
    await removeAllFriendships(M)
  }

  await prisma.$transaction(async (tx) => {
    if (M) {
      await tx.member.updateMany({ where: { profilePhotoId: { in: photos.map((p) => p.id) } }, data: { profilePhotoId: null } })
      await tx.address.deleteMany({ where: { memberId: M } })
      await tx.educationRecord.deleteMany({ where: { memberId: M } })
      await tx.employmentRecord.deleteMany({ where: { memberId: M } })
      await tx.business.deleteMany({ where: { memberId: M } })
      await tx.memberProfileDetail.deleteMany({ where: { memberId: M } })
      await tx.memberFieldVisibility.deleteMany({ where: { memberId: M } })
      await tx.memberSkill.deleteMany({ where: { memberId: M } })
      await tx.memberArea.deleteMany({ where: { memberId: M } })
      await tx.matrimonialInterest.deleteMany({ where: { OR: [{ fromMemberId: M }, { toMemberId: M }] } })
      await tx.matrimonialSave.deleteMany({ where: { OR: [{ memberId: M }, { savedMemberId: M }] } })
      const mp = await tx.matrimonialProfile.findUnique({ where: { memberId: M }, select: { id: true } })
      if (mp) await tx.matrimonialPreference.deleteMany({ where: { matrimonialProfileId: mp.id } })
      await tx.matrimonialProfile.deleteMany({ where: { memberId: M } })
      await tx.profileChangeRequest.deleteMany({ where: { memberId: M } })
      await tx.memberInvitation.deleteMany({ where: { memberId: M } })
      await tx.idProof.deleteMany({ where: { memberId: M } })
      const birthYear = member!.dateOfBirth ? new Date(Date.UTC(member!.dateOfBirth.getUTCFullYear(), 0, 1)) : null
      await tx.member.update({
        where: { id: M },
        data: {
          userId: null, firstName: 'Former member', middleName: null, lastName: null,
          dateOfBirth: birthYear, dateOfBirthApprox: !!birthYear,
          mobilePrimary: null, mobileAlternate: null, email: null, biography: null, bloodGroup: null, physicalDisability: null, bodyType: null,
          heightCm: null, weightKg: null, currentCity: null, currentState: null, currentCountry: null,
          nativeVillage: null, nativeDistrict: null, nativeState: null, employmentStatus: null, occupationCategory: null,
          deceasedPlace: null, deceasedNotes: null,
          status: member!.status === 'DECEASED' ? 'DECEASED' : 'INACTIVE', deletedAt: new Date(), updatedBy: adminId,
        },
      })
    }
    await tx.photo.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } })
    await tx.post.updateMany({ where: { authorId: user.id, deletedAt: null }, data: { deletedAt: new Date() } })
    await tx.comment.updateMany({ where: { authorId: user.id, deletedAt: null }, data: { deletedAt: new Date() } })
    await tx.userRole.deleteMany({ where: { userId: user.id } })
    await tx.verificationToken.deleteMany({ where: { userId: user.id } })
    await tx.notification.deleteMany({ where: { recipientId: user.id } })
    await tx.user.update({
      where: { id: user.id },
      data: { email: null, mobile: null, passwordHash: await hash(randomBytes(32).toString('hex'), 10), status: 'DEACTIVATED', deletedAt: new Date() },
    })
    await tx.dataDeletionRequest.update({ where: { id: requestId }, data: { status: 'COMPLETED', processedBy: adminId, processedAt: new Date(), memberId: M } })
    await recordAudit({
      actorId: adminId, actorRole: 'ADMIN', action: 'data.deletion.complete', entityType: 'user', entityId: user.id,
      oldValue: { status: user.status }, newValue: { status: 'DEACTIVATED', anonymisedMemberId: M, photos: photos.length, idProofs: proofs.length },
      metadata: { requestId },
    }, undefined, tx)
  })
  // Files go after the rows (a failed transaction must not lose files).
  for (const p of photos) await deletePhotoObjects([p.storageKey, p.optimizedKey, p.thumbnailKey])
  for (const p of proofs) await deletePhotoObjects([p.proofKey, p.selfSignedKey])
  return { ok: true }
}
