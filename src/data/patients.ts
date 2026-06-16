import { Difficulty } from '@prisma/client';

export type CanonicalPatient = {
	name: string;
	gender: string;
	problem: string;
	age: number;
	nationality: string;
	difficulty: Difficulty;
};

/** Canonical virtual patients shipped with the product. */
export const CANONICAL_PATIENTS: CanonicalPatient[] = [
	{
		name: 'Emma Richardson',
		gender: 'Female',
		problem: 'Anxiety related to work stress and performance pressure',
		age: 28,
		nationality: 'United States',
		difficulty: Difficulty.MEDIUM,
	},
	{
		name: 'Lucas Mendes',
		gender: 'Male',
		problem: 'Difficulty sleeping and persistent insomnia',
		age: 34,
		nationality: 'Brazil',
		difficulty: Difficulty.EASY,
	},
	{
		name: 'Sofia Andersson',
		gender: 'Female',
		problem: 'Relationship issues with long-term partner',
		age: 26,
		nationality: 'Sweden',
		difficulty: Difficulty.MEDIUM,
	},
	{
		name: 'James Carter',
		gender: 'Male',
		problem: 'Social anxiety in public gatherings and group settings',
		age: 22,
		nationality: 'United Kingdom',
		difficulty: Difficulty.HARD,
	},
];
