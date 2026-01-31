import { injectable } from "tsyringe";
import { UserRepository } from "../repositories/UserRepository.js";
import { User } from "../models/User.js";
import { NotFoundError } from "../errors/PlanlyError.js";
import { logger } from "../utils/logger.js";

@injectable()
export class UserService {
    constructor(private readonly userRepository: UserRepository) {}

    async getProfile(userId: string): Promise<Omit<User, "password">> {
        const found = await this.userRepository.findByUser(userId);
        if (!found) {
            logger.warn("User getProfile: not found", { userId });
            throw new NotFoundError(`User '${userId}' not found`);
        }
        const { password: _p, ...profile } = found;
        return profile;
    }
}
