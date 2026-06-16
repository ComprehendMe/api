import { PrismaClient } from '@prisma/client';
import { CANONICAL_PATIENTS } from '../src/data/patients';
import { genSnow } from '../src/common/snow';

const prisma = new PrismaClient();

async function main() {
	console.log('Starting seed...');

	await prisma.message.deleteMany();
	await prisma.report.deleteMany();
	await prisma.userDailyStat.deleteMany();
	await prisma.friendship.deleteMany();
	await prisma.session.deleteMany();
	await prisma.chat.deleteMany();
	await prisma.user.deleteMany();
	await prisma.patient.deleteMany();

	console.log('Creating patients...');
	for (const patient of CANONICAL_PATIENTS) {
		await prisma.patient.create({
			data: {
				id: genSnow(),
				...patient,
			},
		});
	}

	console.log('Seed completed successfully!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
