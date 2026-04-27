# Gamification — Streak Trophies (API + Mobile)

## Context

Users need motivation to maintain daily habit streaks. This plan adds a trophy system that rewards consecutive days of completing all habits. Trophies accumulate permanently and are shown on every TodoCard and as a popup when earned. Trophy images are placeholders for now (keys only).

---

## 1. Milestone Table (5 → 120 days)

Trophies are earned at the **USER-level streak** (all active habits completed on same day, consecutive days). Each tier has a max quantity; after a streak break and rebuild, the same trophy type can be earned again — they always accumulate.

| Streak Day | Trophy Type | Trophy Name | Qty at milestone | Running total |
|-----------|-------------|-------------|-----------------|---------------|
| 5  | SPARK   | Spark   | 1 | 1  |
| 10 | SPARK   | Spark   | 2 | 2  |
| 15 | SPARK   | Spark   | 3 | 3  |
| 20 | SPARK   | Spark   | 4 | 4  |
| 25 | SPARK   | Spark   | 5 | 5  |
| 30 | FLAME   | Flame   | 1 | 6  |
| 35 | FLAME   | Flame   | 2 | 7  |
| 40 | FLAME   | Flame   | 3 | 8  |
| 45 | FLAME   | Flame   | 4 | 9  |
| 50 | FLAME   | Flame   | 5 | 10 |
| 55 | BLAZE   | Blaze   | 1 | 11 |
| 60 | BLAZE   | Blaze   | 2 | 12 |
| 65 | BLAZE   | Blaze   | 3 | 13 |
| 70 | BLAZE   | Blaze   | 4 | 14 |
| 75 | BLAZE   | Blaze   | 5 | 15 |
| 80 | INFERNO | Inferno | 1 | 16 |
| 90 | INFERNO | Inferno | 2 | 17 |
| 100| INFERNO | Inferno | 3 | 18 |
| 110| INFERNO | Inferno | 4 | 19 |
| 120| LEGEND  | Legend  | 1 | 20 |

**Max ever: 20 trophies** (achievable with a perfect 120-day streak, or accumulated over many shorter streaks).

Milestone days array (for code):
```
[5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,90,100,110,120]
```

---

## 2. DynamoDB Data Model

### New table: `planly-trophies`

| Attribute | Type | Example |
|-----------|------|---------|
| `PK` (HASH) | String | `USER#abc-123` |
| `SK` (RANGE) | String | `TROPHY#SPARK#1745704800000` |
| `userId` | String | `abc-123` |
| `trophyType` | String | `SPARK` |
| `trophyName` | String | `Spark` |
| `streakDay` | Number | `5` |
| `earnedAt` | String | `2026-04-26T03:00:00.000Z` |
| `createdAt` | String | ISO timestamp |

**Key design rationale:**
- SK = `TROPHY#<type>#<earnedAt_epoch_ms>` — sortable, unique, allows prefix queries by type (`begins_with TROPHY#SPARK`)
- No GSI needed — all queries are `PK = USER#userId` (list all) or `PK + SK begins_with TROPHY#TYPE` (count by type)
- A user can earn the same type again after a streak reset — multiple records with same `trophyType` but different timestamps
- No `habitId` — trophies are USER-scope (all habits must be done)

**SAM template additions** (`infrastructure/aws/template.yaml`):
```yaml
TrophiesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: planly-trophies
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: PK
        AttributeType: S
      - AttributeName: SK
        AttributeType: S
    KeySchema:
      - AttributeName: PK
        KeyType: HASH
      - AttributeName: SK
        KeyType: RANGE
```

---

## 3. API Changes (`arj-planly-api`)

### New Files

#### `src/models/Trophy.ts`
```typescript
export type TrophyType = 'SPARK' | 'FLAME' | 'BLAZE' | 'INFERNO' | 'LEGEND';

export interface Trophy {
  PK: string;           // USER#userId
  SK: string;           // TROPHY#type#epochMs
  userId: string;
  trophyType: TrophyType;
  trophyName: string;
  streakDay: number;
  earnedAt: string;
  createdAt: string;
}

export interface EarnedTrophyResponse {
  trophyType: TrophyType;
  trophyName: string;
  streakDay: number;
  earnedAt: string;
  totalOfType: number;  // How many of this type the user now owns
}

export interface TrophySummary {
  trophyType: TrophyType;
  trophyName: string;
  count: number;
  lastEarnedAt: string;
}
```

#### `src/constants/trophyMilestones.ts`
```typescript
export const MILESTONE_MAP: Record<number, { type: TrophyType; name: string }> = {
  5:  { type: 'SPARK',   name: 'Spark'   },
  10: { type: 'SPARK',   name: 'Spark'   },
  15: { type: 'SPARK',   name: 'Spark'   },
  20: { type: 'SPARK',   name: 'Spark'   },
  25: { type: 'SPARK',   name: 'Spark'   },
  30: { type: 'FLAME',   name: 'Flame'   },
  35: { type: 'FLAME',   name: 'Flame'   },
  40: { type: 'FLAME',   name: 'Flame'   },
  45: { type: 'FLAME',   name: 'Flame'   },
  50: { type: 'FLAME',   name: 'Flame'   },
  55: { type: 'BLAZE',   name: 'Blaze'   },
  60: { type: 'BLAZE',   name: 'Blaze'   },
  65: { type: 'BLAZE',   name: 'Blaze'   },
  70: { type: 'BLAZE',   name: 'Blaze'   },
  75: { type: 'BLAZE',   name: 'Blaze'   },
  80: { type: 'INFERNO', name: 'Inferno' },
  90: { type: 'INFERNO', name: 'Inferno' },
  100:{ type: 'INFERNO', name: 'Inferno' },
  110:{ type: 'INFERNO', name: 'Inferno' },
  120:{ type: 'LEGEND',  name: 'Legend'  },
};
```

#### `src/repositories/TrophyRepository.ts`
- `save(trophy: Trophy): Promise<void>` — PutCommand
- `findAllByUser(userId: string): Promise<Trophy[]>` — Query PK = USER#userId
- `countByType(userId: string, trophyType: TrophyType): Promise<number>` — Query PK + SK begins_with

#### `src/services/TrophyService.ts`
- `checkAndAwardTrophy(userId: string, newStreak: number): Promise<EarnedTrophyResponse | null>`
  - Looks up `MILESTONE_MAP[newStreak]`
  - If milestone found: saves trophy record, counts total of that type, returns `EarnedTrophyResponse`
  - If not a milestone: returns `null`
- `getTrophySummaries(userId: string): Promise<TrophySummary[]>` — for GET /trophies endpoint

#### `src/controllers/TrophyController.ts`
- `GET /planly/trophies` handler — calls `trophyService.getTrophySummaries(userId)`

### Modified Files

#### `src/services/stats/UserStatsUpdater.ts`
- After updating `currentStreak`, call `trophyService.checkAndAwardTrophy(userId, newCurrentStreak)`
- Return `EarnedTrophyResponse | null` up the call chain

#### `src/services/StatsService.ts` (or `TodoService.ts`)
- `updateStatsOnTodoStatusChange()` return type changes to include `newTrophy?: EarnedTrophyResponse`
- Bubble up the trophy result from `UserStatsUpdater`

#### `src/controllers/TodoController.ts`
- `PATCH /planly/todo/{habitId}`: change response from `204` to `200` with body:
  ```json
  { "newTrophy": { ... } }   // null if no milestone hit
  ```

#### `infrastructure/aws/template.yaml`
- Add `planly-trophies` table (see above)
- Add `TrophiesTable` env var and IAM policy (`dynamodb:PutItem`, `dynamodb:Query`) to the planly-api Lambda
- Add GET /planly/trophies route to OpenAPI spec (`infrastructure/aws/openapi.yaml`)

#### `src/container.ts`
- Register `TrophyRepository` and `TrophyService` in TSyringe DI container

### Midnight Job (`src/handlers/stats-midnight/index.ts`)
- **No change needed** — midnight job breaks streaks; trophies are only awarded when streaks increase (handled in `UserStatsUpdater` during normal todo completion flow)

---

## 4. Mobile Changes (`arj-planly-mobile`)

### New Files

#### `src/models/Trophy.ts`
```typescript
export type TrophyType = 'SPARK' | 'FLAME' | 'BLAZE' | 'INFERNO' | 'LEGEND';

export interface TrophySummary {
  trophyType: TrophyType;
  trophyName: string;
  count: number;
  lastEarnedAt: string;
}

export interface EarnedTrophy {
  trophyType: TrophyType;
  trophyName: string;
  streakDay: number;
  earnedAt: string;
  totalOfType: number;
}

export interface TrophiesResponse {
  trophies: TrophySummary[];
  total: number;
}
```

#### `src/service/trophy.service.ts`
```typescript
export const getTrophies = async (): Promise<TrophiesResponse> => {
  const { data } = await planlyApiClient.get<TrophiesResponse>('/trophies');
  return data;
};
```

#### `src/stores/trophyStore.ts`
```typescript
interface TrophyState {
  trophies: TrophySummary[];
  totalTrophies: number;
  fetchTrophies: () => Promise<void>;
  addTrophy: (earned: EarnedTrophy) => void;
}

export const useTrophyStore = create<TrophyState>((set, get) => ({
  trophies: [],
  totalTrophies: 0,
  fetchTrophies: async () => {
    const { trophies, total } = await getTrophies();
    set({ trophies, totalTrophies: total });
  },
  addTrophy: (earned) => {
    // Optimistically update count for the type
    set((state) => {
      const existing = state.trophies.find(t => t.trophyType === earned.trophyType);
      if (existing) {
        return {
          trophies: state.trophies.map(t =>
            t.trophyType === earned.trophyType
              ? { ...t, count: earned.totalOfType, lastEarnedAt: earned.earnedAt }
              : t
          ),
          totalTrophies: state.totalTrophies + 1,
        };
      }
      return {
        trophies: [...state.trophies, {
          trophyType: earned.trophyType,
          trophyName: earned.trophyName,
          count: earned.totalOfType,
          lastEarnedAt: earned.earnedAt,
        }],
        totalTrophies: state.totalTrophies + 1,
      };
    });
  },
}));
```

#### `src/components/TrophyModal.tsx`
- `BottomSheetModal` at `snapPoints={[screenHeight * 0.55]}`
- Props: `ref`, `trophy: EarnedTrophy | null`, `onDismiss`
- Content:
  - Placeholder trophy icon (image placeholder, `MaterialIcons` "emoji-events" in gold until images are defined)
  - Animated spring scale on appear (0 → 1.3 → 1) + rotation wiggle
  - Text: `"🏆 Trophy Unlocked!"` title
  - Trophy name (large, bold)
  - `"Day {streakDay} Streak — {trophyName} #{totalOfType}"`
  - "Awesome!" dismiss button
- Haptics: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` on open
- Sound: reuse existing `todo-completed.mp3` or add `trophy-unlocked.mp3`

#### `src/components/TrophyBadge.tsx`
- Small inline badge for TodoCard tags row
- Props: `totalTrophies: number`
- Layout: `MaterialIcons "emoji-events"` (gold, 12px) + count text
- Same tag styling as streak tag (rounded pill, gold background tint)
- Only renders if `totalTrophies > 0`

### Modified Files

#### `src/viewmodels/todo/useTodoViewModel.ts`
- `updateTodoStatus` response now typed as `{ newTrophy?: EarnedTrophy }`
- After successful update:
  ```typescript
  if (response.newTrophy) {
    useTrophyStore.getState().addTrophy(response.newTrophy);
    onTrophyEarned?.(response.newTrophy);  // callback to open modal
  }
  ```
- Expose `onTrophyEarned` callback or return `earnedTrophy` from `handleToggleTodo`

#### `src/components/TodoCard.tsx`
- Import `TrophyBadge` and `useTrophyStore`
- Add `<TrophyBadge totalTrophies={totalTrophies} />` in the tags row (after streak tag)
- `const { totalTrophies } = useTrophyStore()`

#### `src/app/(tabs)/index.tsx`
- Add `TrophyModal` ref and state: `const [earnedTrophy, setEarnedTrophy] = useState<EarnedTrophy | null>(null)`
- Pass `onTrophyEarned` callback to `useTodoViewModel` → calls `trophyModalRef.current?.present()`
- Render `<TrophyModal ref={trophyModalRef} trophy={earnedTrophy} onDismiss={...} />`
- On mount: `useTrophyStore.getState().fetchTrophies()`

---

## 5. Critical Files Summary

### API (`arj-planly-api`)
| Action | File |
|--------|------|
| Create | `src/models/Trophy.ts` |
| Create | `src/constants/trophyMilestones.ts` |
| Create | `src/repositories/TrophyRepository.ts` |
| Create | `src/services/TrophyService.ts` |
| Create | `src/controllers/TrophyController.ts` |
| Modify | `src/services/stats/UserStatsUpdater.ts` |
| Modify | `src/services/StatsService.ts` |
| Modify | `src/controllers/TodoController.ts` (response 204→200 + newTrophy) |
| Modify | `src/container.ts` (register new services) |
| Modify | `infrastructure/aws/template.yaml` (new table + IAM) |
| Modify | `infrastructure/aws/openapi.yaml` (new route) |

### Mobile (`arj-planly-mobile`)
| Action | File |
|--------|------|
| Create | `src/models/Trophy.ts` |
| Create | `src/service/trophy.service.ts` |
| Create | `src/stores/trophyStore.ts` |
| Create | `src/components/TrophyModal.tsx` |
| Create | `src/components/TrophyBadge.tsx` |
| Modify | `src/viewmodels/todo/useTodoViewModel.ts` |
| Modify | `src/components/TodoCard.tsx` |
| Modify | `src/app/(tabs)/index.tsx` |

---

## 6. Data Flow Summary

```
User marks last habit DONE
  → TodoController PATCH /todo/{habitId}
  → TodoService.createOrUpdate()
  → StatsService.updateStatsOnTodoStatusChange()
    → UserStatsUpdater.updateIncremental()   ← USER streak +1
      → TrophyService.checkAndAwardTrophy(userId, newStreak)
        → MILESTONE_MAP[newStreak] hit?
          YES → TrophyRepository.save() + count total
               → return EarnedTrophyResponse
          NO  → return null
    → return { newTrophy }
  → TodoController returns 200 { newTrophy }

Mobile useTodoViewModel receives response
  → newTrophy present?
    YES → trophyStore.addTrophy()
         → TrophyModal.present()  ← popup shown
         → play trophy sound + haptic
    NO  → normal flow
```

---

## 7. Verification Plan

### API
1. Unit test `TrophyService.checkAndAwardTrophy()` with each milestone day (5, 30, 80, 120) and a non-milestone (7)
2. Unit test `MILESTONE_MAP` covers all 20 milestones
3. Integration: Mark todos as done until streak = 5 → confirm `PATCH /todo` response includes `newTrophy`
4. Integration: `GET /planly/trophies` returns grouped summaries after earning 2 SPARKs
5. Run `sam build && sam local invoke` on the planly-api function

### Mobile
1. Mock `updateTodoStatus` to return `{ newTrophy: { trophyType: 'SPARK', ... } }` → confirm modal appears
2. Confirm `TrophyBadge` renders in TodoCard when `totalTrophies > 0`, hidden when 0
3. Confirm `trophyStore.addTrophy()` correctly increments count for existing type
4. Manual: complete all daily habits on day 5 → trophy popup → close → trophy badge visible on cards
