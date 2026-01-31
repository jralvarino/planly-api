import "reflect-metadata";
import { container } from "tsyringe";
import { TodoRepository } from "./repositories/TodoRepository.js";
import { HabitRepository } from "./repositories/HabitRepository.js";
import { CategoryRepository } from "./repositories/CategoryRepository.js";
import { UserRepository } from "./repositories/UserRepository.js";
import { StatsRepository } from "./repositories/StatsRepository.js";
import { TodoService } from "./services/TodoService.js";
import { StatsService } from "./services/StatsService.js";
import { HabitService } from "./services/HabitService.js";
import { CategoryService } from "./services/CategoryService.js";
import { AuthService } from "./services/AuthService.js";
import { UserService } from "./services/UserService.js";

// Repositories are registered as singletons for connection reuse
container.registerSingleton(TodoRepository);
container.registerSingleton(HabitRepository);
container.registerSingleton(CategoryRepository);
container.registerSingleton(UserRepository);
container.registerSingleton(StatsRepository);

// Services - Tsyringe will resolve constructor dependencies
container.registerSingleton(TodoService);
container.registerSingleton(StatsService);
container.registerSingleton(HabitService);
container.registerSingleton(CategoryService);
container.registerSingleton(AuthService);
container.registerSingleton(UserService);

export { container };
