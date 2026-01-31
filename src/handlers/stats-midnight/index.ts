import type { ScheduledHandler } from "aws-lambda";
import { addDays, todayISO } from "../../utils/util.js";
import { UserRepository } from "../../repositories/UserRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { TodoService } from "../../services/TodoService.js";
import { StatsService } from "../../services/StatsService.js";
import { logger } from "../../utils/logger.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";

const userRepository = new UserRepository();
const todoRepository = new TodoRepository();
const todoService = new TodoService();
const statsService = new StatsService();

/**
 * Lambda triggered daily at 00:01 (EventBridge Schedule).
 * Lists users first, then for each user uses getTodoListByDate(userId, yesterday) to get all habits of the previous day.
 * For each habit in that list, if no TODO row exists (user took no action), recalculate streaks.
 */
export const handler: ScheduledHandler = async (): Promise<void> => {
    const today = todayISO();
    const yesterday = addDays(today, -1);

    logger.info("Stats midnight job started", { today, yesterday });

    const users = await userRepository.findAll();
    if (users.length === 0) {
        logger.info("Stats midnight job: no users found, exiting");
        return;
    }

    logger.info("Stats midnight job: listed users", { userCount: users.length });

    let recalcCount = 0;

    for (const user of users) {
        try {
            const todoListYesterday = await todoService.getTodoListByDate(user.userId, yesterday);
            if (todoListYesterday.length === 0) {
                logger.info("Stats midnight job: no habits had yesterday for user", { userId: user.userId });
                continue;
            }

            const isAllCompleted =
                todoListYesterday.length > 0 && todoListYesterday.every((t) => t.status === TODO_STATUS.DONE);
            if (isAllCompleted) {
                logger.info("Stats midnight: all habits completed for user", { userId: user.userId });
                continue;
            }

            for (const item of todoListYesterday) {
                const todo = await todoRepository.findByUserDateAndHabit(user.userId, yesterday, item.id);
                if (todo !== null) {
                    continue;
                }
                logger.info("Stats midnight: no TODO action for habit on yesterday, recalculating streaks", {
                    userId: user.userId,
                    habitId: item.id,
                    categoryId: item.categoryId,
                    yesterday,
                });
                try {
                    await statsService.recalculateStreaksAfterMidnight(user.userId, item.id, item.categoryId || "");
                    recalcCount++;
                } catch (error) {
                    logger.error("Stats midnight: recalculate failed for habit", {
                        userId: user.userId,
                        habitId: item.id,
                        categoryId: item.categoryId,
                        yesterday,
                        error,
                    });
                    throw error;
                }
            }
        } catch (error) {
            logger.error("Stats midnight: failed for user", {
                userId: user.userId,
                yesterday,
                error,
            });
            throw error;
        }
    }

    logger.info("Stats midnight job finished", {
        yesterday,
        recalcCount,
    });
};

export default handler;
