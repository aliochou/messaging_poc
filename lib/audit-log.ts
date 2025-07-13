import { prisma } from '@/lib/prisma'

// Audit log event types
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // User management events
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  
  // Conversation events
  CONVERSATION_CREATED = 'CONVERSATION_CREATED',
  CONVERSATION_UPDATED = 'CONVERSATION_UPDATED',
  CONVERSATION_DELETED = 'CONVERSATION_DELETED',
  PARTICIPANT_ADDED = 'PARTICIPANT_ADDED',
  PARTICIPANT_REMOVED = 'PARTICIPANT_REMOVED',
  
  // Message events
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  
  // Media events
  MEDIA_UPLOADED = 'MEDIA_UPLOADED',
  MEDIA_DOWNLOADED = 'MEDIA_DOWNLOADED',
  MEDIA_DELETED = 'MEDIA_DELETED',
  
  // Security events
  CSRF_TOKEN_GENERATED = 'CSRF_TOKEN_GENERATED',
  CSRF_TOKEN_VALIDATED = 'CSRF_TOKEN_VALIDATED',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  
  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  CONFIGURATION_CHANGED = 'CONFIGURATION_CHANGED'
}

// Audit log severity levels
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Audit log entry interface
export interface AuditLogEntry {
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, any>
  timestamp: Date
}

// Create audit log entry
export async function createAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: entry.eventType,
        severity: entry.severity,
        userId: entry.userId,
        userEmail: entry.userEmail,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: JSON.stringify(entry.details),
        timestamp: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to create audit log entry:', error)
    // Don't throw - audit logging should not break the application
  }
}

// Log authentication events
export async function logAuthEvent(
  eventType: AuditEventType.LOGIN_SUCCESS | AuditEventType.LOGIN_FAILURE | AuditEventType.LOGOUT,
  userEmail: string,
  ipAddress?: string,
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    eventType,
    severity: eventType === AuditEventType.LOGIN_FAILURE ? AuditSeverity.WARNING : AuditSeverity.INFO,
    userEmail,
    ipAddress,
    userAgent,
    details: {
      ...details,
      timestamp: new Date().toISOString()
    }
  })
}

// Log security events
export async function logSecurityEvent(
  eventType: AuditEventType,
  userEmail?: string,
  ipAddress?: string,
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    eventType,
    severity: AuditSeverity.WARNING,
    userEmail,
    ipAddress,
    userAgent,
    details: {
      ...details,
      timestamp: new Date().toISOString()
    }
  })
}

// Log media events
export async function logMediaEvent(
  eventType: AuditEventType.MEDIA_UPLOADED | AuditEventType.MEDIA_DOWNLOADED | AuditEventType.MEDIA_DELETED,
  userEmail: string,
  conversationId: string,
  filename: string,
  fileSize?: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    eventType,
    severity: AuditSeverity.INFO,
    userEmail,
    ipAddress,
    userAgent,
    details: {
      conversationId,
      filename,
      fileSize,
      timestamp: new Date().toISOString()
    }
  })
}

// Log suspicious activity
export async function logSuspiciousActivity(
  activity: string,
  userEmail?: string,
  ipAddress?: string,
  userAgent?: string,
  details?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
    severity: AuditSeverity.WARNING,
    userEmail,
    ipAddress,
    userAgent,
    details: {
      activity,
      ...details,
      timestamp: new Date().toISOString()
    }
  })
}

// Get audit logs with filtering
export async function getAuditLogs(
  filters: {
    eventType?: AuditEventType
    severity?: AuditSeverity
    userEmail?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  } = {}
): Promise<any[]> {
  const where: any = {}
  
  if (filters.eventType) where.eventType = filters.eventType
  if (filters.severity) where.severity = filters.severity
  if (filters.userEmail) where.userEmail = filters.userEmail
  if (filters.startDate || filters.endDate) {
    where.timestamp = {}
    if (filters.startDate) where.timestamp.gte = filters.startDate
    if (filters.endDate) where.timestamp.lte = filters.endDate
  }
  
  return await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: filters.limit || 100
  })
}

// Clean up old audit logs (retention policy)
export async function cleanupOldAuditLogs(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  
  const result = await prisma.auditLog.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate
      }
    }
  })
  
  return result.count
} 