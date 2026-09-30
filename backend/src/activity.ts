import { prisma } from './prisma';

export type ActorType = 'admin' | 'judge' | 'system';

export interface LogActivityInput {
  competitionId: string;
  actorType: ActorType;
  actorLabel: string;
  action: string;
  detail?: string;
  /** ถ้าเป็น judge ให้ส่ง id เพื่อให้กรรมการ filter เห็นเฉพาะของตัวเอง */
  actorJudgeId?: string | null;
  /** object ใด ๆ จะถูก serialize เป็น JSON string */
  metadata?: unknown;
}

/**
 * บันทึก activity log กลาง — best-effort:
 * ถ้าเขียน log ล้มเหลว จะไม่ throw (กัน log ทำให้ business action พัง)
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        competitionId: input.competitionId,
        actorType: input.actorType,
        actorLabel: input.actorLabel,
        actorJudgeId: input.actorJudgeId ?? null,
        action: input.action,
        detail: input.detail ?? null,
        metadata: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (e) {
    console.error('logActivity failed:', e);
  }
}
