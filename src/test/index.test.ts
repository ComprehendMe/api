import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { FriendService } from '../modules/friends/service';
import { prisma } from '../common/prisma';
import { genSnow } from '../common/snow';
import { FriendshipStatus } from '@prisma/client';

const createUser = async (name: string, email: string) => {
	return prisma.user.create({
		data: {
			id: genSnow(),
			name,
			email,
		},
	});
};

import { PatientService } from '../modules/patients/service';
import { Difficulty } from '@prisma/client';
