import { GetCommand, PutCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Todo } from "../models/Todo.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";
import { TODO_STATUS, TodoStatus } from "../constants/todo.constants.js";

export class TodoRepository {
    async createOrUpdate(todo: Todo): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.TODO,
                Item: {
                    PK: this.generatePK(todo.userId),
                    SK: this.generateSK(todo.date, todo.habitId),
                    userId: todo.userId,
                    habitId: todo.habitId,
                    date: todo.date,
                    status: todo.status,
                    progress: todo.progress,
                    target: todo.target,
                    notes: todo.notes,
                    createdAt: todo.createdAt,
                    updatedAt: new Date().toISOString(),
                },
            })
        );
    }

    async findByUserDateAndHabit(userId: string, date: string, habitId: string): Promise<Todo | null> {
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.TODO,
                Key: {
                    PK: this.generatePK(userId),
                    SK: this.generateSK(date, habitId),
                },
            })
        );

        return (result.Item as Todo) || null;
    }

    async delete(userId: string, date: string, habitId: string): Promise<void> {
        await ddb.send(
            new DeleteCommand({
                TableName: DYNAMO_TABLES.TODO,
                Key: {
                    PK: this.generatePK(userId),
                    SK: this.generateSK(date, habitId),
                },
            })
        );
    }

    async findAllByDateRange(userId: string, startDate: string, endDate: string): Promise<Todo[]> {
        const result = await ddb.send(
            new QueryCommand({
                TableName: DYNAMO_TABLES.TODO,
                IndexName: "userId-date-index",
                KeyConditionExpression: "userId = :userId AND #date BETWEEN :startDate AND :endDate",
                ExpressionAttributeNames: {
                    "#date": "date",
                },
                ExpressionAttributeValues: {
                    ":userId": userId,
                    ":startDate": startDate,
                    ":endDate": endDate,
                },
            })
        );

        return (result.Items as Todo[]) || [];
    }

    /**
     * Retorna a menor data em [startDate, endDate] em que o hábito não foi concluído:
     * - Dias sem Todo na tabela (considerados não concluídos)
     * - Dias com Todo com status diferente de DONE (PENDING ou SKIPPED)
     * Usado para iniciar o recálculo de stats a partir da primeira "lacuna" em vez do start_date do hábito.
     * 
     * @param endDate - Se não fornecido, usa a data atual (hoje)
     */
    async findMinDateByHabitWhereNotDone(
        userId: string,
        habitId: string,
        startDate: string,
        endDate?: string
    ): Promise<string | null> {
        const effectiveEndDate = endDate ?? new Date().toISOString().split("T")[0];
        const todos = await this.findAllByDateRange(userId, startDate, effectiveEndDate);
        const habitTodos = todos.filter((t) => t.habitId === habitId);
        const todoByDate = new Map(habitTodos.map((t) => [t.date, t]));

        // Gerar range de datas
        const start = new Date(startDate);
        const end = new Date(effectiveEndDate);
        const dates: string[] = [];
        const current = new Date(start);
        while (current <= end) {
            dates.push(current.toISOString().split("T")[0]);
            current.setDate(current.getDate() + 1);
        }

        // Encontrar a menor data que não está concluída, verificando do maior para o menor (mais recente para mais antigo)
        for (let i = dates.length - 1; i >= 0; i--) {
            const date = dates[i];
            const todo = todoByDate.get(date);
            if (!todo || todo.status !== TODO_STATUS.DONE) {
                return date;
            }
        }

        return null; // Todas as datas estão concluídas
    }

    async updateNotes(userId: string, date: string, habitId: string, notes: string): Promise<void> {
        await ddb.send(
            new UpdateCommand({
                TableName: DYNAMO_TABLES.TODO,
                Key: {
                    PK: this.generatePK(userId),
                    SK: this.generateSK(date, habitId),
                },
                UpdateExpression: "SET notes = :notes, updatedAt = :updatedAt",
                ExpressionAttributeValues: {
                    ":notes": notes,
                    ":updatedAt": new Date().toISOString(),
                },
            })
        );
    }

    // Gerar PK: USER#<userId>
    private generatePK(userId: string): string {
        return `USER#${userId}`;
    }

    // Gerar SK: DATE#YYYY-MM-DD#HABIT#<habitId>
    private generateSK(date: string, habitId: string): string {
        return `DATE#${date}#HABIT#${habitId}`;
    }
}
