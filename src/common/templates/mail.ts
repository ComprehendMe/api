type MagicLinkTemplateOptions = {
	actionLabel: string;
	intro: string;
	magicLink: string;
};

export const magicLinkTemplate = ({
	actionLabel,
	intro,
	magicLink,
}: MagicLinkTemplateOptions) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
        .wrapper { padding: 40px 20px; }
        .container { background-color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        h2 { color: #1a1a1a; margin-top: 0; }
        p { color: #4a4a4a; line-height: 1.6; font-size: 16px; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { background-color: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; }
        .footer { margin-top: 32px; font-size: 13px; color: #999; text-align: center; }
        .divider { border-top: 1px solid #eee; margin: 32px 0; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <h2>Comprehend Me</h2>
            <p>${intro}</p>
            
            <div class="button-container">
                <a href="${magicLink}" class="button">${actionLabel}</a>
            </div>
            
            <p>Este link expirará em <strong>5 minutos</strong>. Se você não solicitou este acesso, ignore este e-mail.</p>
            
            <div class="divider"></div>
            <p style="font-size: 14px; color: #888;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; font-size: 12px; color: #007bff;">${magicLink}</p>
        </div>
        <div class="footer">
            &copy; 2026 Comprehend Me.
        </div>
    </div>
</body>
</html>
`;

export const signupTemplate = (magicLink: string) =>
	magicLinkTemplate({
		actionLabel: 'Verificar E-mail',
		intro:
			'Olá! Para concluir sua conta, clique no botão abaixo para verificar seu endereço de e-mail.',
		magicLink,
	});

export const loginTemplate = (magicLink: string) =>
	magicLinkTemplate({
		actionLabel: 'Entrar na conta',
		intro:
			'Recebemos um pedido para entrar na sua conta. Use o botão abaixo para concluir o login com magic link.',
		magicLink,
	});
