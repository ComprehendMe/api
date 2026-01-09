import { faker } from '@faker-js/faker';
import { Difficulty, FriendshipStatus, PrismaClient } from '@prisma/client';
import { genSnow } from '../src/common/snow';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Starting seed...');

	await prisma.message.deleteMany();
	await prisma.chat.deleteMany();
	await prisma.friendship.deleteMany();
	await prisma.session.deleteMany();
	await prisma.user.deleteMany();
	await prisma.patient.deleteMany();

	const users = [];
	console.log('Creating users...');
	for (let i = 0; i < 10; i++) {
		const firstName = faker.person.firstName();
		const lastName = faker.person.lastName();

		const user = await prisma.user.create({
			data: {
				id: genSnow(),
				name: `${firstName} ${lastName}`,
				email: faker.internet.email({ firstName, lastName }),
				avatar: faker.image.avatar(),
				googleId: faker.string.numeric(21),
			},
		});
		users.push(user);
	}

	const patients = [];
	console.log('Creating patients...');
	const problems = [
		'Anxiety related to work stress',
		'Difficulty sleeping and insomnia',
		'Relationship issues with partner',
		'Social anxiety in public gatherings',
		'Depression symptoms and lack of motivation',
	];

	for (let i = 0; i < 5; i++) {
		const patient = await prisma.patient.create({
			data: {
				id: genSnow(),
				name: faker.person.fullName(),
				problem: problems[i] || faker.lorem.sentence(),
				age: faker.number.int({ min: 18, max: 70 }),
				nationality: faker.location.country(),
				difficulty: faker.helpers.arrayElement(Object.values(Difficulty)),
			},
		});
		patients.push(patient);
	}

	console.log('Creating friendships...');
	for (const user of users) {
		const potentialFriends = users.filter((u) => u.id !== user.id);
		const friends = faker.helpers.arrayElements(potentialFriends, 2);

		for (const friend of friends) {
			const exists = await prisma.friendship.findFirst({
				where: {
					OR: [
						{ requesterId: user.id, addresseeId: friend.id },
						{ requesterId: friend.id, addresseeId: user.id },
					],
				},
			});

			if (!exists) {
				await prisma.friendship.create({
					data: {
						id: genSnow(),
						requesterId: user.id,
						addresseeId: friend.id,
						status: faker.helpers.arrayElement(Object.values(FriendshipStatus)),
					},
				});
			}
		}
	}

	console.log('Creating chats...');
	for (const user of users) {
		const patient = faker.helpers.arrayElement(patients);

		const chat = await prisma.chat.create({
			data: {
				id: genSnow(),
				userId: user.id,
				patientId: patient.id,
				title: `Session with ${patient.name}`,
			},
		});

		const numMessages = faker.number.int({ min: 2, max: 10 });
		for (let m = 0; m < numMessages; m++) {
			await prisma.message.create({
				data: {
					id: genSnow(),
					chatId: chat.id,
					role: m % 2 === 0 ? 'user' : 'model',
					content:
						m % 2 === 0 ? faker.lorem.sentence() : faker.lorem.paragraph(),
				},
			});
		}
	}

	console.log('✅ Seed completed successfully!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
