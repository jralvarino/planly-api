import type { ScheduledEvent, Context } from "aws-lambda";
import { StatsService } from "../../services/StatsService.js";
import { UserRepository } from "../../repositories/UserRepository.js";

const statsService = new StatsService();
const userRepository = new UserRepository();

/**
 * Job diário (00:01) que atualiza stats para o dia anterior:
 * hábitos elegíveis sem Todo ou não DONE são considerados não concluídos.
 */
export async function handler(event: ScheduledEvent, _context: Context): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split("T")[0];

    const userIds = await userRepository.findAllUserIds();
    await statsService.processDayWithoutActions(date, userIds);
}

export default handler;
