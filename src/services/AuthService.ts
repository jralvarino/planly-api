import jwt from "jsonwebtoken";
import { UserRepository } from "../repositories/UserRepository.js";
import { User } from "../models/User.js";
import crypto from "crypto";
import { NotFoundError, UnauthorizedError } from "../errors/PlanlyError.js";
import { getJwtSecret } from "../utils/secretsManager.js";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface TokenPayload {
    userId: string;
    [key: string]: any;
}

export class AuthService {
    private userRepository = new UserRepository();

    async login(userId: string, password: string): Promise<string> {
        const user: User | null = await this.userRepository.findByUser(userId);

        if (!user) {
            throw new NotFoundError(`User '${userId}' not found`);
        }

        const passwordBuffer = Buffer.from(password);
        const userPasswordBuffer = Buffer.from(user.password);

        if (passwordBuffer.length !== userPasswordBuffer.length) {
            throw new UnauthorizedError(`Invalid password for user '${userId}'`);
        }

        if (!crypto.timingSafeEqual(passwordBuffer, userPasswordBuffer)) {
            throw new UnauthorizedError(`Invalid password for user '${userId}'`);
        }

        const token = await this.generateToken({
            userId: userId,
        });

        return token;
    }

    generateToken = async (payload: TokenPayload): Promise<string> => {
        const jwtSecret = await getJwtSecret();
        return jwt.sign(payload, jwtSecret, {
            expiresIn: JWT_EXPIRES_IN,
        } as jwt.SignOptions);
    };

    verifyToken = async (token: string): Promise<TokenPayload> => {
        try {
            const jwtSecret = await getJwtSecret();
            return jwt.verify(token, jwtSecret) as TokenPayload;
        } catch (error) {
            throw error;
        }
    };
}
