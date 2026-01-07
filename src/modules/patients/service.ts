import { Difficulty } from '@prisma/client';
import { prisma } from '../../common/prisma';
import { exception, http, httpCodes } from '../../common/request';
import { genSnow } from '../../common/snow';

type CreatePatient = {
	name: string;
	problem: string;
	difficulty: Difficulty;
};

type UpdatePatient = {
	id: bigint;
	name?: string;
	problem?: string;
	difficulty?: Difficulty;
};

export class PatientService {
	public static async list() {
		return await prisma.patient.findMany();
	}

	public static async create(data: CreatePatient) {
		return await prisma.patient.create({
			data: {
				id: genSnow(),
				...data,
			},
		});
	}

	public static async getById(id: bigint) {
		const patient = await prisma.patient.findUnique({
			where: { id },
		});

		if (!patient) {
			throw exception(
				httpCodes[http.NotFound],
				http.NotFound,
				'Patient not found',
			);
		}

		return patient;
	}

	public static async remove(id: bigint) {
		try {
			await prisma.patient.delete({
				where: { id },
			});
			return { ok: true };
		} catch (error: any) {
			if (error.code === 'P2025') {
				throw exception(
					httpCodes[http.NotFound],
					http.NotFound,
					'Patient not found',
				);
			}
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				error.message,
			);
		}
	}

	public static async update(payload: UpdatePatient) {
		const { id, ...data } = payload;
		try {
			return await prisma.patient.update({
				where: { id },
				data,
			});
		} catch (error: any) {
			if (error.code === 'P2025') {
				throw exception(
					httpCodes[http.NotFound],
					http.NotFound,
					'Patient not found',
				);
			}
			throw exception(
				httpCodes[http.InternalServerError],
				http.InternalServerError,
				error.message,
			);
		}
	}
}