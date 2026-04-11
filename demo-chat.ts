import chalk from 'chalk';

const BASE_URL = 'http://localhost:8080';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readline = await import('node:readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q: string): Promise<string> =>
	new Promise((resolve) => rl.question(q, resolve));

const separator = () => console.log(chalk.gray('─'.repeat(50)));

const defaultHeaders = (): HeadersInit => ({
	'User-Agent': USER_AGENT,
});

function extractAccessCookie(res: Response): string | null {
	const h = res.headers as unknown as { getSetCookie?: () => string[] };
	const parts =
		typeof h.getSetCookie === 'function'
			? h.getSetCookie()
			: res.headers.get('set-cookie')
				? [res.headers.get('set-cookie') as string]
				: [];
	for (const line of parts) {
		const start = line.match(/^access=([^;]+)/);
		if (start) return `access=${start[1]}`;
	}
	return null;
}

function difficultyColor(d: string): string {
	const u = d.toUpperCase();
	if (u === 'EASY') return chalk.green(d);
	if (u === 'MEDIUM') return chalk.yellow(d);
	if (u === 'HARD') return chalk.red(d);
	return chalk.gray(d);
}

type PatientRow = {
	id: string;
	name: string;
	problem: string;
	difficulty: string;
};

const waitForResponse = async (
	chatId: string,
	previousModelCount: number,
	cookieHeader: string,
): Promise<string | null> => {
	for (let i = 0; i < 10; i++) {
		await sleep(2000);
		const res = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
			headers: {
				...defaultHeaders(),
				Cookie: cookieHeader,
			},
		});
		if (!res.ok) continue;
		const messages = (await res.json()) as { role: string; content: string }[];
		const modelMessages = messages.filter((m) => m.role === 'model');
		if (modelMessages.length > previousModelCount) {
			return modelMessages[modelMessages.length - 1].content;
		}
	}
	return null;
};

async function main() {
	console.clear();
	console.log(chalk.blue.bold('ComprehendMe'));
	console.log(chalk.blue.bold('Backend Demo'));
	separator();

	const email = (await question(chalk.white('Email: '))).trim();
	const loginRes = await fetch(`${BASE_URL}/sessions/login`, {
		method: 'POST',
		headers: {
			...defaultHeaders(),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ email }),
	});

	if (!loginRes.ok) {
		console.log(chalk.red('  Erro no login. Verifica se o backend esta a correr.'));
		rl.close();
		return;
	}

	console.log(chalk.gray('  Magic link enviado. Verifica o teu email.'));
	const token = (await question(chalk.white('Token: '))).trim();

	const verifyRes = await fetch(
		`${BASE_URL}/sessions/verify?token=${encodeURIComponent(token)}`,
		{ headers: defaultHeaders() },
	);

	if (!verifyRes.ok) {
		console.log(chalk.red('  Token invalido ou expirado.'));
		rl.close();
		return;
	}

	const cookieHeader = extractAccessCookie(verifyRes);
	if (!cookieHeader) {
		console.log(chalk.red('  Token invalido ou expirado.'));
		rl.close();
		return;
	}

	console.log(chalk.gray('  Sessao iniciada.'));
	separator();

	const patientsRes = await fetch(`${BASE_URL}/patients`, {
		headers: {
			...defaultHeaders(),
			Cookie: cookieHeader,
		},
	});

	if (!patientsRes.ok) {
		console.log(chalk.red('  Erro ao carregar pacientes.'));
		rl.close();
		return;
	}

	const patients = (await patientsRes.json()) as PatientRow[];
	console.log(chalk.blue.bold('\n  Pacientes disponiveis\n'));

	const nameW = 22;
	const probW = 42;
	for (let i = 0; i < patients.length; i++) {
		const p = patients[i];
		const idx = String(i + 1).padEnd(3);
		const name = chalk.white.bold(p.name.padEnd(nameW));
		const prob = chalk.gray(p.problem.padEnd(probW));
		const diff = difficultyColor(p.difficulty);
		console.log(`  ${idx}${name}${prob}${diff}`);
	}

	separator();
	const choiceRaw = await question(
		chalk.white(`Escolhe um paciente (1-${patients.length}): `),
	);
	const choice = Number.parseInt(choiceRaw.trim(), 10);
	if (
		Number.isNaN(choice) ||
		choice < 1 ||
		choice > patients.length
	) {
		console.log(chalk.red('  Escolha invalida.'));
		rl.close();
		return;
	}

	const selectedPatient = patients[choice - 1];
	const chatRes = await fetch(`${BASE_URL}/chats`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: cookieHeader,
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
		},
		body: JSON.stringify({ patientId: selectedPatient.id }),
	});

	if (!chatRes.ok) {
		const err = await chatRes.text();
		console.log(chalk.red(`  Erro ao criar chat: ${err}`));
		rl.close();
		process.exit(1);
	}

	const chatText = await chatRes.text();
	let chatData: any = null;

	if (chatText) {
		chatData = JSON.parse(chatText);
	}

	if (!chatData || !chatData.id) {
		// tenta buscar o chat mais recente
		const chatsRes = await fetch(`${BASE_URL}/chats`, {
			headers: {
				Cookie: cookieHeader,
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
			},
		});
		const chats = (await chatsRes.json()) as any[];
		chatData = chats[0];
	}

	const chatId = chatData?.id;

	if (!chatId) {
		console.log(chalk.red('  Erro ao obter chat.'));
		rl.close();
		process.exit(1);
	}

	separator();
	console.log(
		chalk.gray('  Sessao iniciada com ') +
			chalk.white.bold(selectedPatient.name),
	);
	console.log(chalk.gray('  Escreve "sair" para terminar.'));
	separator();

	for (;;) {
		const line = await question(chalk.white('\nTu: '));
		const msg = line.trim();
		if (!msg) continue;
		if (msg.toLowerCase() === 'sair' || msg.toLowerCase() === 'exit') {
			console.log(chalk.gray('\n  Sessao terminada.'));
			break;
		}

		const historyBefore = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
			headers: {
				...defaultHeaders(),
				Cookie: cookieHeader,
			},
		});
		let previousModelCount = 0;
		if (historyBefore.ok) {
			const arr = (await historyBefore.json()) as { role: string }[];
			previousModelCount = arr.filter((m) => m.role === 'model').length;
		}

		const sendRes = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
			method: 'POST',
			headers: {
				...defaultHeaders(),
				Cookie: cookieHeader,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ content: msg }),
		});

		if (!sendRes.ok) {
			console.log(chalk.red('  Erro ao enviar mensagem.'));
			continue;
		}

		console.log(chalk.gray('  A aguardar resposta...'));

		const reply = await waitForResponse(chatId, previousModelCount, cookieHeader);
		if (reply === null) {
			console.log(chalk.gray('  Sem resposta. Tenta novamente.'));
		} else {
			console.log(
				'\n' +
					chalk.blue.bold(`${selectedPatient.name}: `) +
					chalk.cyan(reply),
			);
		}
	}

	rl.close();
}

try {
	await main();
} catch (e: unknown) {
	const message = e instanceof Error ? e.message : String(e);
	console.error(chalk.red(`  Erro: ${message}`));
	rl.close();
	process.exitCode = 1;
}
