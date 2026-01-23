import { UserRepository } from "../repositories/UserRepository.js";
import { User } from "../models/User.js";
import { NotFoundError } from "../errors/PlanlyError.js";

export class UserService {
    private userRepository = new UserRepository();

    async getProfile(userId: string): Promise<Omit<User, "password">> {
        const found = await this.userRepository.findByUser(userId);
        if (!found) {
            throw new NotFoundError(`User '${userId}' not found`);
        }
        const { password: _p, ...profile } = found;
        return profile;
    }
}
