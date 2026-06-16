import { prisma } from '../../common/prisma';
import { getSnowCreation } from '../../common/snow';

const MINUTES_PER_MESSAGE = 1;
const DAILY_GOAL_MINUTES = 15;

const lastActivityTimestamps = new Map<string, number>();
const ACTIVITY_COOLDOWN_MS = 55_000;

function startOfUtcDay(date = new Date()) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(a: Date, b: Date) {
	const ms = startOfUtcDay(a).getTime() - startOfUtcDay(b).getTime();
	return Math.round(ms / 86_400_000);
}

export class StatsService {
	public static async recordMessage(userId: bigint) {
		const today = startOfUtcDay();

		await prisma.userDailyStat.upsert({
			where: {
				userId_date: { userId, date: today },
			},
			create: {
				userId,
				date: today,
				minutes: MINUTES_PER_MESSAGE,
				messaged: true,
			},
			update: {
				minutes: { increment: MINUTES_PER_MESSAGE },
				messaged: true,
			},
		});

		await this.updateStreak(userId, today);
	}

	public static async recordPresence(userId: bigint, minutes = 1) {
		const now = Date.now();
		const key = userId.toString();
		const lastTime = lastActivityTimestamps.get(key);
		if (lastTime && now - lastTime < ACTIVITY_COOLDOWN_MS) {
			return;
		}
		lastActivityTimestamps.set(key, now);

		const today = startOfUtcDay();

		await prisma.userDailyStat.upsert({
			where: {
				userId_date: { userId, date: today },
			},
			create: {
				userId,
				date: today,
				minutes,
				messaged: false,
			},
			update: {
				minutes: { increment: minutes },
			},
		});
	}

	private static async updateStreak(userId: bigint, today: Date) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { streakCount: true, lastStreakDate: true },
		});

		if (!user) return;

		const last = user.lastStreakDate ? startOfUtcDay(user.lastStreakDate) : null;
		let nextStreak = 1;

		if (last) {
			const gap = daysBetween(today, last);
			if (gap === 0) {
				nextStreak = user.streakCount || 1;
			} else if (gap === 1) {
				nextStreak = (user.streakCount || 0) + 1;
			} else {
				nextStreak = 1;
			}
		}

		await prisma.user.update({
			where: { id: userId },
			data: {
				streakCount: nextStreak,
				lastStreakDate: today,
			},
		});
	}

	public static getEffectiveStreak(
		streakCount: number,
		lastStreakDate: Date | null,
	): number {
		if (!streakCount || !lastStreakDate) return 0;

		const today = startOfUtcDay();
		const last = startOfUtcDay(lastStreakDate);
		const gap = daysBetween(today, last);

		if (gap <= 1) return streakCount;
		return 0;
	}

	public static async getDashboardStats(userId: bigint, allowBackfill = true) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { streakCount: true, lastStreakDate: true },
		});

		if (!user) {
			return {
				streak: 0,
				todayMinutes: 0,
				dailyGoalMinutes: DAILY_GOAL_MINUTES,
				ringProgress: 0,
				weeklyMinutes: this.emptyWeek(),
			};
		}

		const today = startOfUtcDay();
		const weekStart = new Date(today);
		weekStart.setUTCDate(weekStart.getUTCDate() - 6);

		let stats = await prisma.userDailyStat.findMany({
			where: {
				userId,
				date: { gte: weekStart },
			},
		});

		if (allowBackfill && stats.length === 0) {
			const messageCount = await prisma.message.count({
				where: { role: 'user', chat: { userId } },
			});
			if (messageCount > 0) {
				await this.backfillFromMessages(userId);
				return this.getDashboardStats(userId, false);
			}
		}

		const todayStat = stats.find(
			(s) => startOfUtcDay(s.date).getTime() === today.getTime(),
		);
		const todayMinutes = todayStat?.minutes ?? 0;

		const weeklyMinutes = this.buildWeek(stats);
		const streak = this.getEffectiveStreak(
			user.streakCount,
			user.lastStreakDate,
		);

		return {
			streak,
			todayMinutes,
			dailyGoalMinutes: DAILY_GOAL_MINUTES,
			ringProgress: Math.min(100, Math.round((todayMinutes / DAILY_GOAL_MINUTES) * 100)),
			weeklyMinutes,
		};
	}

	public static async backfillFromMessages(userId: bigint) {
		const messages = await prisma.message.findMany({
			where: {
				role: 'user',
				chat: { userId },
			},
			select: { id: true },
		});

		const byDay = new Map<string, number>();

		for (const msg of messages) {
			const day = startOfUtcDay(new Date(getSnowCreation(msg.id)));
			const key = day.toISOString();
			byDay.set(key, (byDay.get(key) ?? 0) + 1);
		}

		for (const [key, count] of byDay) {
			const date = new Date(key);
			await prisma.userDailyStat.upsert({
				where: { userId_date: { userId, date } },
				create: {
					userId,
					date,
					minutes: count * MINUTES_PER_MESSAGE,
					messaged: true,
				},
				update: {
					minutes: count * MINUTES_PER_MESSAGE,
					messaged: true,
				},
			});
		}

		if (byDay.size > 0) {
			const daySet = new Set(
				[...byDay.keys()].map((k) => k.slice(0, 10)),
			);
			let streak = 0;
			const cursor = startOfUtcDay();

			while (daySet.has(cursor.toISOString().slice(0, 10))) {
				streak++;
				cursor.setUTCDate(cursor.getUTCDate() - 1);
			}

			const lastActive = new Date();
			lastActive.setUTCDate(lastActive.getUTCDate() - 1);

			await prisma.user.update({
				where: { id: userId },
				data: {
					streakCount: streak,
					lastStreakDate: streak > 0 ? startOfUtcDay() : null,
				},
			});
		}
	}

	private static emptyWeek() {
		const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
		const today = startOfUtcDay();
		return labels.map((day, index) => {
			const d = new Date(today);
			d.setUTCDate(d.getUTCDate() - (6 - index));
			return {
				day,
				minutes: 0,
				isToday: index === 6,
			};
		});
	}

	private static buildWeek(
		stats: { date: Date; minutes: number }[],
	) {
		const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
		const today = startOfUtcDay();

		return labels.map((day, index) => {
			const d = new Date(today);
			d.setUTCDate(d.getUTCDate() - (6 - index));
			const match = stats.find(
				(s) => startOfUtcDay(s.date).getTime() === d.getTime(),
			);
			return {
				day,
				minutes: match?.minutes ?? 0,
				isToday: index === 6,
			};
		});
	}
}
