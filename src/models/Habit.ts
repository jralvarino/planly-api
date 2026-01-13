export interface Habit {
    id: string;
    userId: string;
    title: string;
    description?: string;
    color: string;
    emoji: string;
    unit: "count" | "pg" | "km" | "ml";
    value: string;
    period_type: "every_day" | "specific_days_week" | "specific_days_month";
    period_value?: string;
    categoryId: string;
    period: "Anytime" | "Morning" | "Afternoon" | "Evening";
    reminder_enabled: boolean;
    reminder_time?: string;
    start_date: string;
    end_date?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}
