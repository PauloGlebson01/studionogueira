import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    where,
    getDocs
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
const FORM_SUBMIT_EMAIL = "softpowersolucoesdigitais@gmail.com"; // ALTERE PARA SEU E-MAIL REAL

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

// Função para buscar a senha do administrador no Firebase
async function buscarSenhaAdmin(email) {
    try {
        // Buscar na coleção de configurações
        const configRef = doc(db, "configuracoes", "sistema");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            const configData = configDoc.data();
            // Verificar se o e-mail corresponde ao admin configurado
            if (configData.emailAdmin === email) {
                return {
                    encontrado: true,
                    senha: configData.senhaAdmin || "Senha não encontrada no sistema",
                    nomeBarbearia: configData.nomeBarbearia || "Studio Nogueira"
                };
            }
        }
        
        // Buscar na coleção de usuários
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            return {
                encontrado: true,
                senha: userData.senha || "Senha não encontrada",
                nomeBarbearia: userData.nomeBarbearia || "Studio Nogueira"
            };
        }
        
        return { encontrado: false };
        
    } catch (error) {
        console.error("Erro ao buscar senha do admin:", error);
        return { encontrado: false, erro: error.message };
    }
}

// Função para enviar e-mail via FormSubmit
async function enviarSenhaPorEmail(emailDestino, dadosAdmin) {
    const formData = new FormData();
    formData.append("email", FORM_SUBMIT_EMAIL);
    formData.append("subject", `Recuperação de Senha - ${dadosAdmin.nomeBarbearia}`);
    formData.append("_captcha", "false");
    formData.append("_template", "table");
    
    // Conteúdo do e-mail
    const conteudoEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f4f4;">
            <div style="background: linear-gradient(135deg, #2199EF, #1a7fcc); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h2 style="color: white; margin: 0;">🔐 Recuperação de Senha</h2>
                <p style="color: white; margin: 5px 0 0;">${dadosAdmin.nomeBarbearia}</p>
            </div>
            <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px;">
                <h3 style="color: #333;">Olá Administrador,</h3>
                <p style="color: #555;">Sua senha foi solicitada através do sistema de recuperação.</p>
                <div style="background: #f0f2f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>📧 E-mail:</strong> ${emailDestino}</p>
                    <p style="margin: 5px 0;"><strong>🔑 Senha:</strong> <span style="background: #2199EF; color: white; padding: 4px 12px; border-radius: 5px; font-family: monospace;">${dadosAdmin.senha}</span></p>
                </div>
                <p style="color: #555;">Por segurança, recomendamos alterar sua senha após o login.</p>
                <hr style="margin: 20px 0; border-color: #e0e0e0;">
                <p style="color: #777; font-size: 12px; text-align: center;">
                    Este e-mail foi enviado automaticamente pelo sistema.<br>
                    Se você não solicitou a recuperação, ignore esta mensagem.
                </p>
            </div>
        </div>
    `;
    
    formData.append("message", conteudoEmail);
    formData.append("_replyto", emailDestino);
    
    try {
        const response = await fetch("https://formsubmit.co/ajax/" + FORM_SUBMIT_EMAIL, {
            method: "POST",
            body: formData
        });
        
        if (response.ok) {
            return { sucesso: true };
        } else {
            return { sucesso: false, erro: "Erro ao enviar e-mail" };
        }
    } catch (error) {
        console.error("Erro no FormSubmit:", error);
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
                // Buscar a senha do admin no Firebase
                const resultadoBusca = await buscarSenhaAdmin(email);
                
                if (!resultadoBusca.encontrado) {
                    mostrarMensagemReset(
                        "❌ E-mail não encontrado no sistema.\n\n" +
                        "Verifique se você digitou o e-mail correto ou realize a configuração inicial.",
                        false
                    );
                    setResetLoading(false);
                    return;
                }
                
                mostrarMensagemReset("📧 Enviando senha para seu e-mail...", false);
                
                // Enviar e-mail via FormSubmit
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
                        mensagemErro = "❌ Usuário não encontrado. Faça a configuração inicial primeiro.";
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