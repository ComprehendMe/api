import { prisma } from '../../common/prisma';

type SearchResult = {
	patients: Array<{ id: string; name: string; problem: string; difficulty: string }>;
	chats: Array<{ id: string; patientId: string; patientName: string; title: string }>;
	friends: Array<{ id: string; name: string | null; avatar: string | null }>;
};

export class SearchService {
	public static async search(userId: bigint, query: string): Promise<SearchResult> {
		const q = query.trim().toLowerCase();
		if (!q || q.length < 2) return { patients: [], chats: [], friends: [] };

		const [patients, chats, friends] = await Promise.all([
			prisma.patient.findMany({
				where: { name: { contains: q, mode: 'insensitive' } },
				select: { id: true, name: true, problem: true, difficulty: true },
			}),

			prisma.chat.findMany({
				where: {
					userId,
					patient: { name: { contains: q, mode: 'insensitive' } },
				},
				include: { patient: { select: { id: true, name: true } } },
				orderBy: { updatedAt: 'desc' },
				take: 10,
			}),

			prisma.friendship.findMany({
				where: {
					status: 'ACCEPTED',
					OR: [
						{ requesterId: userId, addressee: { name: { contains: q, mode: 'insensitive' } } },
						{ addresseeId: userId, requester: { name: { contains: q, mode: 'insensitive' } } },
					],
				},
				include: {
					requester: { select: { id: true, name: true, avatar: true } },
					addressee: { select: { id: true, name: true, avatar: true } },
				},
				take: 10,
			}),
		]);

		return {
			patients: patients.map((p) => ({ ...p, id: p.id.toString() })),
			chats: chats.map((c) => ({
				id: c.id.toString(),
				patientId: c.patientId.toString(),
				patientName: c.patient.name,
				title: c.title,
			})),
			friends: friends.map((f) => {
				const peer = f.requesterId === userId ? f.addressee : f.requester;
				return { id: peer.id.toString(), name: peer.name, avatar: peer.avatar };
			}),
		};
	}
}
