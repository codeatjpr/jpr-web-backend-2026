import { AuditLog } from '../models/AuditLog.js'
import type { AuthUser } from '../middleware/auth.js'

export async function writeAudit(input: {
  actor?: AuthUser
  action: string
  entity: string
  entityId?: string
  diff?: unknown
  ipHash?: string
}) {
  await AuditLog.create({
    actorId: input.actor?.id,
    actorEmail: input.actor?.email,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    diff: input.diff,
    ipHash: input.ipHash,
  })
}
