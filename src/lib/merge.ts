import { Prisma } from '@prisma/client'

/**
 * One person = one record (rule 1, F17, F22). Folds `retireId` into `keepId`
 * inside the caller's transaction: every row that points at the retired
 * record is moved, duplicates that would collide are dropped, and the
 * retired record is soft-deleted (kept for history, never shown).
 *
 * `values` are chosen field values (conflict resolution, F22); otherwise the
 * kept record's own values win and the retired one only fills blanks.
 * The login moves to the kept record when only the retired one has one.
 */
export const MERGE_FIELDS = ['firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth'] as const
export type MergeField = (typeof MERGE_FIELDS)[number]

export async function mergePersons(
  tx: Prisma.TransactionClient,
  keepId: string,
  retireId: string,
  actorId: string,
  values: Partial<Record<MergeField, unknown>> = {},
) {
  if (keepId === retireId) throw new Error('Cannot merge a person into themselves')
  const [k, r] = await Promise.all([
    tx.member.findUniqueOrThrow({ where: { id: keepId } }),
    tx.member.findUniqueOrThrow({ where: { id: retireId } }),
  ])
  if (k.userId && r.userId) throw new Error('Both records have their own login; an Admin must decide')
  const K = k.id
  const R = r.id

  // The login moves first (members.userId is unique).
  await tx.member.update({ where: { id: R }, data: { userId: null, deletedAt: new Date(), status: 'INACTIVE', profilePhotoId: null } })

  const fill = <F extends keyof typeof k>(f: F, empty: unknown = null) =>
    (k[f] === null || k[f] === empty) && r[f] !== null && r[f] !== empty ? { [f]: r[f] } : {}
  const chosen: Record<string, unknown> = {}
  for (const f of MERGE_FIELDS) if (values[f] !== undefined) chosen[f] = f === 'dateOfBirth' && values[f] ? new Date(String(values[f])) : values[f]
  const deceased = k.status === 'DECEASED' || r.status === 'DECEASED'
  await tx.member.update({
    where: { id: K },
    data: {
      userId: k.userId ?? r.userId,
      ...fill('gender', 'NOT_STATED'), ...fill('dateOfBirth'), ...fill('mobilePrimary'), ...fill('email'),
      ...fill('nativeVillage'), ...fill('nativeDistrict'), ...fill('nativeState'), ...fill('middleName'), ...fill('lastName'),
      ...fill('employmentStatus'), ...fill('currentCity'), ...fill('currentState'), ...fill('profilePhotoId'),
      ...fill('deceasedAt'), ...fill('deceasedPlace'),
      ...(deceased ? { status: 'DECEASED' as const } : {}),
      ...chosen,
      updatedBy: actorId,
    },
  })

  // Mul Gaon / areas
  const kAreas = await tx.memberArea.findMany({ where: { memberId: K } })
  for (const a of await tx.memberArea.findMany({ where: { memberId: R } })) {
    await tx.memberArea.delete({ where: { memberId_areaId: { memberId: R, areaId: a.areaId } } })
    if (!kAreas.some((x) => x.areaId === a.areaId)) {
      await tx.memberArea.create({ data: { memberId: K, areaId: a.areaId, isPrimary: a.isPrimary && !kAreas.some((x) => x.isPrimary) } })
    }
  }
  // Addresses: one per type; the kept record keeps any it already has.
  const kTypes = new Set((await tx.address.findMany({ where: { memberId: K }, select: { addressType: true } })).map((a) => a.addressType))
  for (const a of await tx.address.findMany({ where: { memberId: R } })) {
    if (kTypes.has(a.addressType)) await tx.address.delete({ where: { id: a.id } })
    else await tx.address.update({ where: { id: a.id }, data: { memberId: K } })
  }
  // One-per-member rows.
  if (await tx.memberProfileDetail.findUnique({ where: { memberId: K } })) await tx.memberProfileDetail.deleteMany({ where: { memberId: R } })
  else await tx.memberProfileDetail.updateMany({ where: { memberId: R }, data: { memberId: K } })
  if (await tx.matrimonialProfile.findUnique({ where: { memberId: K } })) await tx.matrimonialProfile.deleteMany({ where: { memberId: R } })
  else await tx.matrimonialProfile.updateMany({ where: { memberId: R }, data: { memberId: K } })
  await tx.memberFieldVisibility.deleteMany({ where: { memberId: R } })

  // Plain child rows move across.
  const move = { where: { memberId: R }, data: { memberId: K } }
  await tx.educationRecord.updateMany(move)
  await tx.employmentRecord.updateMany(move)
  await tx.business.updateMany(move)
  await tx.idProof.updateMany(move)
  await tx.photo.updateMany(move)
  await tx.profileChangeRequest.updateMany(move)
  await tx.maritalStatusHistory.updateMany(move)
  await tx.memberInvitation.updateMany(move)
  await tx.booking.updateMany(move)
  await tx.feeInvoice.updateMany(move)
  await tx.payment.updateMany(move)
  await tx.matrimonialSave.updateMany(move)
  await tx.matrimonialSave.updateMany({ where: { savedMemberId: R }, data: { savedMemberId: K } })
  await tx.matrimonialInterest.updateMany({ where: { fromMemberId: R }, data: { fromMemberId: K } })
  await tx.matrimonialInterest.updateMany({ where: { toMemberId: R }, data: { toMemberId: K } })
  await tx.approvalTask.updateMany({ where: { subjectMemberId: R }, data: { subjectMemberId: K } })
  await tx.asset.updateMany({ where: { ownerMemberId: R }, data: { ownerMemberId: K } })
  await tx.communityGroup.updateMany({ where: { convenerMemberId: R }, data: { convenerMemberId: K } })
  const kGroups = new Set((await tx.communityGroupMember.findMany({ where: { memberId: K }, select: { groupId: true } })).map((g) => g.groupId))
  for (const g of await tx.communityGroupMember.findMany({ where: { memberId: R } })) {
    if (kGroups.has(g.groupId)) await tx.communityGroupMember.delete({ where: { id: g.id } })
    else await tx.communityGroupMember.update({ where: { id: g.id }, data: { memberId: K } })
  }
  const kSkills = new Set((await tx.memberSkill.findMany({ where: { memberId: K }, select: { skillId: true } })).map((s) => s.skillId))
  for (const s of await tx.memberSkill.findMany({ where: { memberId: R } })) {
    await tx.memberSkill.delete({ where: { memberId_skillId: { memberId: R, skillId: s.skillId } } })
    if (!kSkills.has(s.skillId)) await tx.memberSkill.create({ data: { memberId: K, skillId: s.skillId, level: s.level } })
  }

  // Marriages.
  await tx.marriageRecord.updateMany({ where: { memberId1: R }, data: { memberId1: K } })
  await tx.marriageRecord.updateMany({ where: { memberId2: R }, data: { memberId2: K } })

  // Relationships: rewrite both ends; drop rows that would duplicate one the
  // kept record already has, or that would link the person to themselves.
  for (const rel of await tx.memberRelationship.findMany({ where: { OR: [{ fromMemberId: R }, { toMemberId: R }] } })) {
    const from = rel.fromMemberId === R ? K : rel.fromMemberId
    const to = rel.toMemberId === R ? K : rel.toMemberId
    const clash = from === to || await tx.memberRelationship.findUnique({
      where: { fromMemberId_toMemberId_relationshipTypeId: { fromMemberId: from, toMemberId: to, relationshipTypeId: rel.relationshipTypeId } },
    })
    if (clash) await tx.memberRelationship.delete({ where: { id: rel.id } })
    else await tx.memberRelationship.update({ where: { id: rel.id }, data: { fromMemberId: from, toMemberId: to } })
  }

  // Family memberships: the kept record joins every family the retired one
  // was in (this is how one person shows in both trees).
  const kFamilies = new Map((await tx.familyMember.findMany({ where: { memberId: K } })).map((f) => [f.familyId, f]))
  for (const fm of await tx.familyMember.findMany({ where: { memberId: R } })) {
    const existing = kFamilies.get(fm.familyId)
    if (existing) {
      await tx.familyMember.update({ where: { id: fm.id }, data: { leftAt: fm.leftAt ?? new Date(), leftReason: 'MERGED', status: 'ENDED', isKarta: false } })
      if (fm.isKarta && !fm.leftAt && !existing.leftAt) await tx.familyMember.update({ where: { id: existing.id }, data: { isKarta: true } })
    } else {
      await tx.familyMember.update({ where: { id: fm.id }, data: { memberId: K } })
    }
  }
  await tx.familyMember.updateMany({ where: { relativeToMemberId: R }, data: { relativeToMemberId: K } })
  await tx.family.updateMany({ where: { kartaMemberId: R }, data: { kartaMemberId: K } })
  await tx.familyJoinRequest.updateMany({ where: { memberId: R }, data: { memberId: K } })
  await tx.familyJoinRequest.updateMany({ where: { relatedToMemberId: R }, data: { relatedToMemberId: K } })
  await tx.kartaTransfer.updateMany({ where: { fromMemberId: R }, data: { fromMemberId: K } })
  await tx.kartaTransfer.updateMany({ where: { toMemberId: R }, data: { toMemberId: K } })
  await tx.kartaTransfer.updateMany({ where: { suggestedMemberId: R }, data: { suggestedMemberId: K } })
  await tx.treeLinkRequest.updateMany({ where: { fromMemberId: R, status: { in: ['PLACEHOLDER', 'PENDING', 'OPERATOR_REVIEW'] } }, data: { fromMemberId: K } })
  await tx.treeLinkRequest.updateMany({ where: { toMemberId: R, status: { in: ['PLACEHOLDER', 'PENDING', 'OPERATOR_REVIEW'] } }, data: { toMemberId: K } })

  return { keepId: K, retiredId: R, old: { keep: pick(k), retired: pick(r) } }
}

function pick(m: Record<string, any>) {
  return Object.fromEntries(MERGE_FIELDS.map((f) => [f, m[f] instanceof Date ? m[f].toISOString().slice(0, 10) : m[f]]))
}
