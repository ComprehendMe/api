import { Difficulty } from '@prisma/client';
import { afterAll, describe, expect, it } from 'bun:test';
import { prisma } from 'src/common/prisma';
import { PatientService } from './service';

describe('PatientService', () => {
	let patientId: bigint;

	afterAll(async () => {
		if (patientId) {
			try {
				await prisma.patient.delete({ where: { id: patientId } });
			} catch {}
		}
	});

	it('should create a patient', async () => {
		const patient = await PatientService.create({
			name: 'John Doe',
			problem: 'Anxiety',
			difficulty: Difficulty.EASY,
		});
		expect(patient).toBeDefined();
		expect(patient.name).toBe('John Doe');
		expect(patient.id).toBeDefined();
		patientId = patient.id;
	});

	it('should list patients', async () => {
		const patients = await PatientService.list();
		expect(patients).toBeArray();
		expect(patients.length).toBeGreaterThan(0);
		const found = patients.find((p) => p.id === patientId);
		expect(found).toBeDefined();
	});

	it('should get patient by id', async () => {
		const patient = await PatientService.getById(patientId);
		expect(patient).toBeDefined();
		expect(patient.id).toBe(patientId);
	});

	it('should update a patient', async () => {
		const updated = await PatientService.update({
			id: patientId,
			name: 'Jane Doe',
			difficulty: Difficulty.HARD,
		});
		expect(updated.name).toBe('Jane Doe');
		expect(updated.difficulty).toBe(Difficulty.HARD);
	});

	it('should remove a patient', async () => {
		const result = await PatientService.remove(patientId);
		expect(result.ok).toBe(true);

		try {
			await PatientService.getById(patientId);
		} catch (error: any) {
			expect(error).toBeDefined();
		}
	});
});
