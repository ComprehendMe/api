import type { Elysia } from 'elysia';
import { t } from 'elysia';
import { ID_SCHEMA } from '../../common/snow';
import { PatientService } from './service';

const serializePatient = (patient: Awaited<ReturnType<typeof PatientService.getById>>) => ({
	...patient,
	id: patient.id.toString(),
});

export const route = (app: Elysia) => {
	app.group('/patients', (group) =>
		group
			.get(
				'/',
				async () => {
					const patients = await PatientService.list();
					return patients.map(serializePatient);
				},
				{
					detail: {
						tags: ['Patients'],
						summary: 'List available patients',
					},
				},
			)
			.get(
				'/:id',
				async ({ params: { id } }) => {
					const patient = await PatientService.getById(id);
					return serializePatient(patient);
				},
				{
					params: t.Object({ id: ID_SCHEMA }),
					detail: {
						tags: ['Patients'],
						summary: 'Get patient details',
					},
				},
			),
	);
};
