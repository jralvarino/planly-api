export type StatsScope = 'HABIT' | 'CATEGORY' | 'USER'

export interface Stats {
    PK: string; // USER#<userId>
    SK: string; // STATS#HABIT#<habitId> | STATS#CATEGORY#<categoryId> | STATS#USER
    habitId: string;
    userId: string;
    categoryId: string; 
    scope: StatsScope;
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate?: string; 
    totalCompletions: number; 
    createdAt: string;
    updatedAt: string;    
}
