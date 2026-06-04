import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    where,
    getDocs,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// BANCO DE DADOS
const firebaseConfig = {
    apiKey: "AIzaSyC5xXm9T2nzh6xxZ5-zrMHfCNdqQOG8SZI",
    authDomain: "studio-nogueira-e07bb.firebaseapp.com",
    projectId: "studio-nogueira-e07bb",
    storageBucket: "studio-nogueira-e07bb.firebasestorage.app",
    messagingSenderId: "150077330983",
    appId: "1:150077330983:web:a49838c4cde9df4e1de002",
    measurementId: "G-WX477KDZQC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let isAdminLogout = false;

// CONFIGURAÇÃO DO FORMSUBMIT
// IMPORTANTE: Substitua este e-mail pelo seu e-mail real onde deseja receber as solicitações
const FORM_SUBMIT_EMAIL = "softpowersolucoesdigitais@gmail.com"; // E-mail para receber as solicitações

// Verificar se o sistema já foi configurado
async function verificarConfiguracaoSistema() {
    try {
        const configRef = doc(db, "configuracoes", "sistema");
        const configDoc = await getDoc(configRef);
        
        if (!configDoc.exists() || configDoc.data().configurado !== true) {
            console.log("⚠️ Sistema não configurado. Redirecionando para configuração inicial...");
            window.location.href = 'configuracao-inicial.html';
            return false;
        }
        return true;
    } catch (error) {
        console.error("Erro ao verificar configuração:", error);
        return true;
    }
}

// Função para buscar a senha do administrador no Firebase (várias fontes)
async function buscarSenhaAdmin(email) {
    try {
        console.log("🔍 Buscando e-mail:", email);
        
        // 1. Buscar na coleção de configurações
        const configRef = doc(db, "configuracoes", "sistema");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            const configData = configDoc.data();
            console.log("📦 Configuração encontrada:", configData.emailAdmin);
            
            // Verificar se o e-mail corresponde ao admin configurado
            if (configData.emailAdmin && configData.emailAdmin.toLowerCase() === email.toLowerCase()) {
                // Se tiver a senha salva, retorna ela
                if (configData.senhaAdmin) {
                    return {
                        encontrado: true,
                        senha: configData.senhaAdmin,
                        nomeBarbearia: configData.nomeBarbearia || "Studio Nogueira",
                        metodo: "configuracoes"
                    };
                }
            }
        }
        
        // 2. Buscar na coleção de usuários
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            console.log("👤 Usuário encontrado na coleção usuarios");
            
            if (userData.senha) {
                return {
                    encontrado: true,
                    senha: userData.senha,
                    nomeBarbearia: userData.nomeBarbearia || "Studio Nogueira",
                    metodo: "usuarios"
                };
            }
        }
        
        // 3. Buscar na coleção de admins
        const adminsRef = collection(db, "admins");
        const qAdmin = query(adminsRef, where("email", "==", email));
        const adminSnapshot = await getDocs(qAdmin);
        
        if (!adminSnapshot.empty) {
            const adminDoc = adminSnapshot.docs[0];
            const adminData = adminDoc.data();
            console.log("👑 Admin encontrado na coleção admins");
            
            if (adminData.senha) {
                return {
                    encontrado: true,
                    senha: adminData.senha,
                    nomeBarbearia: adminData.nomeBarbearia || "Studio Nogueira",
                    metodo: "admins"
                };
            }
        }
        
        // 4. Verificar se o e-mail existe no Firebase Authentication
        try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, email);
            if (signInMethods && signInMethods.length > 0) {
                console.log("✅ E-mail encontrado no Firebase Authentication");
                
                // E-mail existe no Auth, mas não temos a senha armazenada
                // Neste caso, vamos usar o sendPasswordResetEmail
                return {
                    encontrado: true,
                    usarResetLink: true,
                    email: email,
                    nomeBarbearia: "Studio Nogueira",
                    metodo: "authentication"
                };
            }
        } catch (authError) {
            console.log("E-mail não encontrado no Authentication:", authError.message);
        }
        
        console.log("❌ E-mail não encontrado em nenhuma fonte");
        return { encontrado: false };
        
    } catch (error) {
        console.error("Erro ao buscar senha do admin:", error);
        return { encontrado: false, erro: error.message };
    }
}

// Função para cadastrar/atualizar o admin no sistema
async function cadastrarAdminSistema(email, senha, nomeBarbearia = "Studio Nogueira") {
    try {
        // Salvar na coleção de configurações
        const configRef = doc(db, "configuracoes", "sistema");
        await setDoc(configRef, {
            emailAdmin: email,
            senhaAdmin: senha,
            nomeBarbearia: nomeBarbearia,
            configurado: true,
            atualizadoEm: new Date()
        }, { merge: true });
        
        // Salvar na coleção de admins
        const adminRef = doc(db, "admins", email.replace(/[^a-zA-Z0-9]/g, "_"));
        await setDoc(adminRef, {
            email: email,
            senha: senha,
            nomeBarbearia: nomeBarbearia,
            criadoEm: new Date()
        });
        
        console.log("✅ Admin cadastrado com sucesso!");
        return true;
    } catch (error) {
        console.error("Erro ao cadastrar admin:", error);
        return false;
    }
}

// Função para enviar e-mail via FormSubmit
async function enviarSenhaPorEmail(emailDestino, dadosAdmin) {
    const formData = new FormData();
    formData.append("email", FORM_SUBMIT_EMAIL);
    formData.append("subject", `Recuperação de Senha - ${dadosAdmin.nomeBarbearia}`);
    formData.append("_captcha", "false");
    formData.append("_template", "table");
    formData.append("_replyto", emailDestino);
    
    // Conteúdo do e-mail
    const conteudoEmail = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f4f4; }
                .header { background: linear-gradient(135deg, #2199EF, #1a7fcc); padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .header h2 { color: white; margin: 0; }
                .header p { color: white; margin: 5px 0 0; }
                .content { background: white; padding: 20px; border-radius: 0 0 10px 10px; }
                .info-box { background: #f0f2f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .senha-box { background: #2199EF; color: white; padding: 10px 20px; border-radius: 5px; font-family: monospace; font-size: 18px; display: inline-block; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
                hr { margin: 20px 0; border-color: #e0e0e0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔐 Recuperação de Senha</h2>
                    <p>${dadosAdmin.nomeBarbearia}</p>
                </div>
                <div class="content">
                    <h3 style="color: #333;">Olá Administrador,</h3>
                    <p style="color: #555;">Solicitamos o envio da sua senha conforme solicitado.</p>
                    <div class="info-box">
                        <p style="margin: 5px 0;"><strong>📧 E-mail:</strong> ${emailDestino}</p>
                        <p style="margin: 5px 0;"><strong>🔑 Sua senha de acesso:</strong></p>
                        <p style="text-align: center; margin: 15px 0;">
                            <span class="senha-box">${dadosAdmin.senha}</span>
                        </p>
                    </div>
                    <p style="color: #555;">⚠️ <strong>Importante:</strong> Por segurança, recomendamos alterar sua senha após o login.</p>
                    <hr>
                    <p style="color: #777; font-size: 12px; text-align: center;">
                        Este e-mail foi enviado automaticamente pelo sistema.<br>
                        Se você não solicitou a recuperação, ignore esta mensagem.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    formData.append("message", conteudoEmail);
    
    try {
        const response = await fetch("https://formsubmit.co/ajax/" + FORM_SUBMIT_EMAIL, {
            method: "POST",
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log("✅ E-mail enviado com sucesso:", result);
            return { sucesso: true };
        } else {
            const erro = await response.text();
            console.error("Erro no FormSubmit:", erro);
            return { sucesso: false, erro: "Erro ao enviar e-mail" };
        }
    } catch (error) {
        console.error("Erro no FormSubmit:", error);
        return { sucesso: false, erro: error.message };
    }
}

// Função para enviar link de redefinição (fallback)
async function enviarLinkRedefinicao(email) {
    try {
        await sendPasswordResetEmail(auth, email, {
            url: window.location.origin + window.location.pathname.replace('login.html', ''),
            handleCodeInApp: false
        });
        return { sucesso: true };
    } catch (error) {
        console.error("Erro ao enviar link de redefinição:", error);
        return { sucesso: false, erro: error.message };
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const configurado = await verificarConfiguracaoSistema();
    if (!configurado) return;
    
    // Elementos do DOM
    const loginPanel = document.getElementById('loginPanel');
    const resetPanel = document.getElementById('resetPanel');
    const loginForm = document.getElementById('loginForm');
    const resetForm = document.getElementById('resetForm');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const btnLogin = document.getElementById('btnLogin');
    const btnReset = document.getElementById('btnReset');
    const resetEmail = document.getElementById('resetEmail');
    const loginErro = document.getElementById('loginErro');
    const resetMensagem = document.getElementById('resetMensagem');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');

    // Função para mostrar erro no login
    function mostrarErro(mensagem) {
        if (loginErro) {
            loginErro.textContent = mensagem;
            loginErro.style.display = 'block';
            loginErro.classList.remove('sucesso');
            setTimeout(() => {
                if (loginErro) loginErro.style.display = 'none';
            }, 5000);
        }
    }

    // Função para limpar erro do login
    function limparErro() {
        if (loginErro) {
            loginErro.style.display = 'none';
            loginErro.textContent = '';
        }
    }

    // Função para mostrar mensagem na recuperação
    function mostrarMensagemReset(mensagem, isSucesso = false) {
        if (resetMensagem) {
            resetMensagem.textContent = mensagem;
            resetMensagem.style.display = 'block';
            if (isSucesso) {
                resetMensagem.classList.add('sucesso');
            } else {
                resetMensagem.classList.remove('sucesso');
            }
            setTimeout(() => {
                if (resetMensagem) resetMensagem.style.display = 'none';
            }, 8000);
        }
    }

    // Função para mostrar loading no login
    function setLoading(loading) {
        if (btnLogin) {
            if (loading) {
                btnLogin.disabled = true;
                btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
            } else {
                btnLogin.disabled = false;
                btnLogin.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Entrar';
            }
        }
    }

    // Função para mostrar loading na recuperação
    function setResetLoading(loading) {
        if (btnReset) {
            if (loading) {
                btnReset.disabled = true;
                btnReset.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
            } else {
                btnReset.disabled = false;
                btnReset.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar senha por e-mail';
            }
        }
    }

    // Alternar para tela de recuperação
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginPanel) loginPanel.style.display = 'none';
            if (resetPanel) resetPanel.style.display = 'block';
            if (resetEmail) resetEmail.focus();
        });
    }

    // Voltar para tela de login
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (resetPanel) resetPanel.style.display = 'none';
            if (loginPanel) loginPanel.style.display = 'block';
            if (resetMensagem) resetMensagem.style.display = 'none';
            if (loginErro) loginErro.style.display = 'none';
        });
    }

    // FUNÇÃO DE RECUPERAÇÃO DE SENHA COM FORMSUBMIT
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = resetEmail ? resetEmail.value.trim() : '';
            
            if (!email) {
                mostrarMensagemReset("❌ Digite seu e-mail para recuperar a senha.", false);
                return;
            }
            
            setResetLoading(true);
            mostrarMensagemReset("🔍 Verificando e-mail no sistema...", false);
            
            try {
                // Buscar informações do admin no Firebase
                const resultadoBusca = await buscarSenhaAdmin(email);
                
                if (!resultadoBusca.encontrado) {
                    mostrarMensagemReset(
                        "❌ E-mail não encontrado no sistema.\n\n" +
                        "Verifique se você digitou o e-mail correto.\n\n" +
                        "💡 Dica: O e-mail cadastrado é: softpowersolucoesdigitais@gmail.com\n\n" +
                        "Se o problema persistir, entre em contato com o suporte.",
                        false
                    );
                    setResetLoading(false);
                    return;
                }
                
                // Se o e-mail existe no Auth mas não temos a senha, usar link de redefinição
                if (resultadoBusca.usarResetLink) {
                    mostrarMensagemReset("📧 Enviando link de redefinição...", false);
                    const linkResultado = await enviarLinkRedefinicao(email);
                    
                    if (linkResultado.sucesso) {
                        mostrarMensagemReset(
                            "✅ Link de redefinição enviado!\n\n" +
                            "Verifique sua caixa de entrada ou pasta de spam.\n" +
                            "Clique no link para criar uma nova senha.",
                            true
                        );
                        
                        setTimeout(() => {
                            if (resetPanel) resetPanel.style.display = 'none';
                            if (loginPanel) loginPanel.style.display = 'block';
                            if (resetMensagem) resetMensagem.style.display = 'none';
                            mostrarErro("📧 Link de redefinição enviado! Verifique seu e-mail.");
                        }, 4000);
                    } else {
                        mostrarMensagemReset(
                            "❌ Erro ao enviar link de redefinição.\n\n" +
                            "Tente novamente em alguns instantes.",
                            false
                        );
                    }
                    setResetLoading(false);
                    return;
                }
                
                // Se temos a senha, enviar por e-mail
                mostrarMensagemReset("📧 Enviando senha para seu e-mail...", false);
                
                const resultadoEnvio = await enviarSenhaPorEmail(email, {
                    senha: resultadoBusca.senha,
                    nomeBarbearia: resultadoBusca.nomeBarbearia
                });
                
                if (resultadoEnvio.sucesso) {
                    mostrarMensagemReset(
                        "✅ Senha enviada com sucesso!\n\n" +
                        "Verifique sua caixa de entrada ou pasta de spam.\n" +
                        "Caso não receba em alguns minutos, entre em contato com o suporte.",
                        true
                    );
                    
                    // Limpar campo de e-mail
                    if (resetEmail) resetEmail.value = '';
                    
                    // Voltar para tela de login após 4 segundos
                    setTimeout(() => {
                        if (resetPanel) resetPanel.style.display = 'none';
                        if (loginPanel) loginPanel.style.display = 'block';
                        if (resetMensagem) resetMensagem.style.display = 'none';
                        mostrarErro("📧 Senha enviada! Verifique seu e-mail.");
                    }, 4000);
                } else {
                    mostrarMensagemReset(
                        "❌ Erro ao enviar e-mail.\n\n" +
                        "Tente novamente em alguns instantes.\n" +
                        `Erro: ${resultadoEnvio.erro || 'Desconhecido'}`,
                        false
                    );
                }
                
            } catch (error) {
                console.error("Erro na recuperação:", error);
                mostrarMensagemReset(
                    "❌ Erro ao processar sua solicitação.\n\n" +
                    "Tente novamente mais tarde.",
                    false
                );
            } finally {
                setResetLoading(false);
            }
        });
    }

    // FUNÇÃO DE LOGIN
    onAuthStateChanged(auth, (user) => {
        if (isAdminLogout) return;
        
        const isAdminSession = sessionStorage.getItem('admin_active') === 'true';
        const adminId = sessionStorage.getItem('admin_session_id');
        
        if (user && isAdminSession && adminId) {
            console.log("Admin autenticado nesta aba");
            window.location.href = 'dashboard.html';
        } else if (!user && isAdminSession) {
            sessionStorage.clear();
            window.location.reload();
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            limparErro();
            
            const email = emailInput ? emailInput.value.trim() : '';
            const senha = senhaInput ? senhaInput.value : '';
            
            if (!email || !senha) {
                mostrarErro("Preencha todos os campos!");
                return;
            }
            
            setLoading(true);
            
            try {
                isAdminLogout = false;
                sessionStorage.clear();
                
                const sessionId = Math.random().toString(36).substring(2, 15) + Date.now().toString();
                
                if (auth.currentUser) {
                    await signOut(auth);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
                const userCredential = await signInWithEmailAndPassword(auth, email, senha);
                
                sessionStorage.setItem('admin_active', 'true');
                sessionStorage.setItem('admin_session_id', sessionId);
                sessionStorage.setItem('admin_email', userCredential.user.email);
                sessionStorage.setItem('admin_login_time', Date.now().toString());
                
                console.log("✅ Admin logado com sucesso:", userCredential.user.email);
                window.location.href = 'dashboard.html';
                
            } catch (error) {
                console.error("Erro na autenticação:", error.code);
                sessionStorage.clear();
                
                let mensagemErro = "";
                
                switch (error.code) {
                    case 'auth/invalid-email':
                        mensagemErro = "❌ E-mail inválido.";
                        break;
                    case 'auth/user-not-found':
                        mensagemErro = "❌ Usuário não encontrado. Clique em 'Esqueceu sua senha?' para recuperar o acesso.";
                        break;
                    case 'auth/wrong-password':
                        mensagemErro = "❌ Senha incorreta. Clique em 'Esqueceu sua senha?' para recuperar.";
                        break;
                    case 'auth/too-many-requests':
                        mensagemErro = "⚠️ Muitas tentativas. Aguarde alguns minutos.";
                        break;
                    default:
                        mensagemErro = `❌ Erro: ${error.message}`;
                }
                
                mostrarErro(mensagemErro);
                setLoading(false);
            }
        });
    }

    // Cadastrar o admin padrão se necessário
    async function configurarAdminPadrao() {
        try {
            const emailPadrao = "softpowersolucoesdigitais@gmail.com";
            const senhaPadrao = "admin123"; // Senha padrão - o usuário deve alterar depois
            
            // Verificar se o admin já existe
            const configRef = doc(db, "configuracoes", "sistema");
            const configDoc = await getDoc(configRef);
            
            if (!configDoc.exists() || !configDoc.data().emailAdmin) {
                console.log("📝 Configurando admin padrão...");
                await cadastrarAdminSistema(emailPadrao, senhaPadrao, "Studio Nogueira");
                console.log("✅ Admin padrão configurado!");
            }
        } catch (error) {
            console.error("Erro ao configurar admin padrão:", error);
        }
    }
    
    // Executar configuração do admin padrão
    await configurarAdminPadrao();

    // Enter para enviar formulário
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (loginPanel && loginPanel.style.display !== 'none' && loginForm) {
                e.preventDefault();
                loginForm.dispatchEvent(new Event('submit'));
            } else if (resetPanel && resetPanel.style.display !== 'none' && resetForm) {
                e.preventDefault();
                resetForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Limpar erros ao digitar
    if (emailInput) emailInput.addEventListener('input', limparErro);
    if (senhaInput) senhaInput.addEventListener('input', limparErro);
    if (resetEmail) resetEmail.addEventListener('input', () => {
        if (resetMensagem) resetMensagem.style.display = 'none';
    });
});