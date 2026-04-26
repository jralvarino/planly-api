import "reflect-metadata";
import { container } from "tsyringe";
import { TodoRepository } from "./repositories/TodoRepository.js";
import { HabitRepository } from "./repositories/HabitRepository.js";
import { CategoryRepository } from "./repositories/CategoryRepository.js";
import { UserService } from "@arj/common-utils-layer/service";
import { StatsRepository } from "./repositories/StatsRepository.js";
import { TodoService } from "./services/TodoService.js";
import { StatsService } from "./services/StatsService.js";
import { HabitService } from "./services/HabitService.js";
import { CategoryService } from "./services/CategoryService.js";

container.registerSingleton(TodoRepository);
container.registerSingleton(HabitRepository);
container.registerSingleton(CategoryRepository);
container.registerSingleton(UserService);
container.registerSingleton(StatsRepository);

container.registerSingleton(TodoService);
container.registerSingleton(StatsService);
container.registerSingleton(HabitService);
container.registerSingleton(CategoryService);

export { container };
