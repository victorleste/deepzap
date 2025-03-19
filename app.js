// Configurações da aplicação
const API_URL = 'https://2d18-187-15-7-70.ngrok-free.app/api'; // URL do servidor Flask via Ngrok
const JS_API_URL = 'http://localhost:3000/api'; // URL do servidor JS (opcional)

// Estado da aplicação
let currentUser = null;
let authToken = null;
let qrCodeCheckInterval = null;
let qrCodeEventSource = null;

// Elementos DOM
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se há sessão salva
    checkSession();
    
    // Configurar listeners para os modais de login/registro
    setupAuthListeners();
    
    // Configurar listeners para o painel principal
    setupMainPanelListeners();
});

// Verificar se há uma sessão salva no localStorage
function checkSession() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        try {
            authToken = savedToken;
            currentUser = JSON.parse(savedUser);
            showMainPanel();
            updateUIWithUserData();
            checkWhatsAppStatus();
            console.log("Sessão restaurada com sucesso. Token:", authToken);
        } catch (error) {
            console.error("Erro ao restaurar sessão:", error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            showLoginModal();
        }
    } else {
        showLoginModal();
    }
}

// Configurar os listeners para os modais de autenticação
function setupAuthListeners() {
    // Botões de navegação entre modais
    document.getElementById('btnShowRegister').addEventListener('click', () => {
        document.getElementById('loginModal').classList.add('hidden');
        document.getElementById('registerModal').classList.remove('hidden');
    });
    
    document.getElementById('btnShowLogin').addEventListener('click', () => {
        document.getElementById('registerModal').classList.add('hidden');
        document.getElementById('loginModal').classList.remove('hidden');
    });
    
    // Login
    document.getElementById('btnLogin').addEventListener('click', handleLogin);
    
    // Registrar nova conta
    document.getElementById('btnRegister').addEventListener('click', handleRegister);
    
    // Tecla Enter nos campos de login
    document.getElementById('loginUsername').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') document.getElementById('loginPassword').focus();
    });
    
    document.getElementById('loginPassword').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Tecla Enter nos campos de registro
    document.getElementById('registerUsername').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') document.getElementById('registerPassword').focus();
    });
    
    document.getElementById('registerPassword').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') document.getElementById('confirmPassword').focus();
    });
    
    document.getElementById('confirmPassword').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

// Configurar listeners para o painel principal
function setupMainPanelListeners() {
    // Logout
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    
    // Iniciar WhatsApp
    document.getElementById('btnStartWhatsapp').addEventListener('click', initializeWhatsApp);
    
    // Salvar prompt
    document.getElementById('btnSavePrompt').addEventListener('click', savePrompt);
    
    // Toggle do bot
    document.getElementById('botToggle').addEventListener('change', toggleBot);
}

// Manipulador de login
async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorElement = document.getElementById('loginError');
    
    if (!username || !password) {
        errorElement.textContent = 'Por favor, preencha todos os campos';
        return;
    }
    
    errorElement.textContent = '';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        console.log("Resposta de login:", data);
        
        if (data.success) {
            // Verificar se o token foi recebido
            if (!data.token) {
                errorElement.textContent = 'Erro: Token de autenticação não recebido';
                return;
            }
            
            // Salvar dados da sessão
            authToken = data.token;
            currentUser = data.user;
            
            console.log("Token salvo:", authToken);
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Mostrar painel principal
            showMainPanel();
            updateUIWithUserData();
            
            // Verificar status do WhatsApp
            checkWhatsAppStatus();
        } else {
            errorElement.textContent = data.message || 'Erro ao fazer login';
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        errorElement.textContent = 'Erro de conexão ao servidor';
    }
}

// Manipulador de registro
async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const errorElement = document.getElementById('registerError');
    
    if (!username || !password || !confirmPassword) {
        errorElement.textContent = 'Por favor, preencha todos os campos';
        return;
    }
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'As senhas não coincidem';
        return;
    }
    
    errorElement.textContent = '';
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Retornar para o modal de login
            document.getElementById('registerModal').classList.add('hidden');
            document.getElementById('loginModal').classList.remove('hidden');
            
            // Limpar campos
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            // Mostrar mensagem de sucesso no modal de login
            document.getElementById('loginError').textContent = 'Conta criada com sucesso! Faça login.';
            document.getElementById('loginError').style.color = 'green';
            
            // Preencher o nome de usuário no login
            document.getElementById('loginUsername').value = username;
        } else {
            errorElement.textContent = data.message || 'Erro ao criar conta';
        }
    } catch (error) {
        console.error('Erro ao registrar:', error);
        errorElement.textContent = 'Erro de conexão ao servidor';
    }
}

// Manipulador de logout
function handleLogout() {
    // Fechar EventSource se estiver aberto
    if (qrCodeEventSource) {
        qrCodeEventSource.close();
        qrCodeEventSource = null;
    }
    
    // Parar checagem de QR code
    if (qrCodeCheckInterval) {
        clearInterval(qrCodeCheckInterval);
        qrCodeCheckInterval = null;
    }
    
    // Limpar localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    // Limpar estado
    authToken = null;
    currentUser = null;
    
    // Limpar campos
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginError').style.color = '';
    
    // Voltar para o modal de login
    hideMainPanel();
    showLoginModal();
    
    // Fazer logout no servidor
    fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    }).catch(error => console.error('Erro ao fazer logout no servidor:', error));
}

// Atualizar UI com dados do usuário
function updateUIWithUserData() {
    if (!currentUser) return;
    
    // Nome do usuário
    document.getElementById('userDisplay').textContent = `Olá, ${currentUser.username}`;
    
    // Status do bot
    document.getElementById('botToggle').checked = currentUser.botAtivo;
    
    // Prompt
    document.getElementById('promptText').value = currentUser.prompt || '';
    
    // Status do WhatsApp (será atualizado por checkWhatsAppStatus)
}

// Mostrar painel principal
function showMainPanel() {
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('registerModal').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');
}

// Esconder painel principal
function hideMainPanel() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('mainPanel').classList.add('hidden');
}

// Mostrar modal de login
function showLoginModal() {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('hidden');
}

// Inicializar WhatsApp
async function initializeWhatsApp() {
    if (!currentUser || !authToken) {
        showNotification('Erro de autenticação. Faça login novamente.', 'error');
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        hideMainPanel();
        showLoginModal();
        return;
    }
    
    console.log("Iniciando WhatsApp com token:", authToken);
    
    try {
        // Limpar área de QR Code
        document.getElementById('qrcode').innerHTML = '';
        document.getElementById('qrcode').classList.add('hidden');
        document.querySelector('.instruction').textContent = 'Gerando QR Code...';
        
        // Desabilitar botão durante a inicialização
        const btnStart = document.getElementById('btnStartWhatsapp');
        btnStart.disabled = true;
        btnStart.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
        
        // Resetar status de conexão
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = 'Iniciando...';
        statusElement.className = 'status-badge'; // Remove classes online/offline
        
        // Fechar EventSource existente se houver
        if (qrCodeEventSource) {
            qrCodeEventSource.close();
            qrCodeEventSource = null;
        }
        
        // Primeira tentativa - verificar se o token ainda é válido
        const testResponse = await fetch(`${API_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Se o token não for válido, fazer login novamente
        if (testResponse.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            hideMainPanel();
            showLoginModal();
            return;
        }
        
        // Se chegou aqui, o token é válido - iniciar WhatsApp
        const response = await fetch(`${API_URL}/whatsapp/init`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username: currentUser.username })
        });
        
        // Verificar resposta
        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            hideMainPanel();
            showLoginModal();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('WhatsApp iniciado. Aguarde o QR Code.', 'success');
            
            // Iniciar monitoramento de QR Code
            startQRCodeMonitoring();
        } else {
            showNotification(data.message || 'Erro ao iniciar WhatsApp', 'error');
            
            // Atualizar UI para mostrar erro
            document.querySelector('.instruction').textContent = 'Erro ao iniciar WhatsApp. Tente novamente.';
            
            // Atualizar status
            statusElement.textContent = 'Erro';
            statusElement.className = 'status-badge offline';
        }
        
        // Reabilitar botão
        btnStart.disabled = false;
        btnStart.innerHTML = '<i class="fab fa-whatsapp"></i> Iniciar WhatsApp';
    } catch (error) {
        console.error('Erro ao iniciar WhatsApp:', error);
        showNotification('Erro de conexão ao servidor', 'error');
        
        // Reabilitar botão
        document.getElementById('btnStartWhatsapp').disabled = false;
        document.getElementById('btnStartWhatsapp').innerHTML = '<i class="fab fa-whatsapp"></i> Iniciar WhatsApp';
        
        // Atualizar UI para mostrar erro
        document.querySelector('.instruction').textContent = 'Erro de conexão. Tente novamente.';
    }
}

// Monitorar QR Code
function startQRCodeMonitoring() {
    console.log("Iniciando monitoramento de QR Code...");
    
    // Parar checagem anterior se existir
    if (qrCodeCheckInterval) {
        clearInterval(qrCodeCheckInterval);
    }
    
    // Fechar EventSource existente se houver
    if (qrCodeEventSource) {
        qrCodeEventSource.close();
    }
    
    // Usar o endpoint -stream em vez de -sse
    const eventSourceUrl = `${API_URL}/whatsapp/qrcode-stream/${currentUser.username}?token=${encodeURIComponent(authToken)}`;
    console.log("Conectando ao EventSource:", eventSourceUrl);
    
    // Limitar tentativas a 3
    let attemptCount = 0;
    const maxAttempts = 3;
    
    function tryConnectEventSource() {
        if (attemptCount >= maxAttempts) {
            console.log("Número máximo de tentativas atingido. Desistindo de conectar.");
            document.querySelector('.instruction').textContent = 'Falha ao conectar após várias tentativas. Por favor, tente novamente mais tarde.';
            return;
        }
        
        attemptCount++;
        
        qrCodeEventSource = new EventSource(eventSourceUrl);
        
        qrCodeEventSource.onopen = function() {
            console.log("EventSource conectado com sucesso");
        };
        
        qrCodeEventSource.onmessage = function(event) {
            console.log("Mensagem recebida do EventSource:", event.data);
            
            try {
                const data = JSON.parse(event.data);
                
                // Verificar se temos um QR code
                if (data.qr) {
                    console.log("QR Code recebido, gerando imagem...");
                    // Gerar e mostrar QR Code
                    generateQRCode(data.qr);
                } 
                // Verificar mensagens de status
                else if (data.status) {
                    if (data.status === "waiting") {
                        // Atualizar mensagem com número de tentativas, se disponível
                        const waitMessage = data.attempts 
                            ? `Aguardando QR Code... (Tentativa ${data.attempts})`
                            : 'Aguardando QR Code...';
                        document.querySelector('.instruction').textContent = waitMessage;
                    }
                }
                // Verificar erros
                else if (data.error) {
                    console.error("Erro recebido do servidor:", data.error);
                    document.querySelector('.instruction').textContent = `Erro: ${data.error}`;
                    
                    // Fechar EventSource em caso de erro fatal
                    qrCodeEventSource.close();
                    qrCodeEventSource = null;
                }
            } catch (error) {
                console.error("Erro ao processar dados do QR code:", error);
                document.querySelector('.instruction').textContent = 'Erro ao processar QR Code. Tente novamente.';
            }
        };
        
        qrCodeEventSource.onerror = function(error) {
            console.error("Erro na conexão EventSource:", error);
            
            // Fechar e tentar reconectar após um tempo
            qrCodeEventSource.close();
            qrCodeEventSource = null;
            
            document.querySelector('.instruction').textContent = `Erro na conexão. Tentativa ${attemptCount} de ${maxAttempts}...`;
            
            // Tentar reconectar após 5 segundos (até o limite de tentativas)
            if (attemptCount < maxAttempts) {
                setTimeout(tryConnectEventSource, 5000);
            } else {
                document.querySelector('.instruction').textContent = 'Falha ao conectar após várias tentativas. Por favor, tente novamente mais tarde.';
            }
        };
    }
    
    // Iniciar a primeira tentativa
    tryConnectEventSource();
    
    // Atualizar status a cada 5 segundos
    qrCodeCheckInterval = setInterval(checkWhatsAppStatus, 5000);
}

// Gerar QR Code
function generateQRCode(qrData) {
    console.log("Gerando QR Code...");
    
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    
    try {
        // Usar biblioteca qrcode-generator
        const qr = qrcode(0, 'L');
        qr.addData(qrData);
        qr.make();
        
        // Adicionar QR Code ao container
        const qrImg = qr.createImgTag(6, 10);
        qrContainer.innerHTML = qrImg;
        
        // Mostrar QR Code
        document.querySelector('.instruction').textContent = 'Escaneie este QR Code com seu WhatsApp';
        qrContainer.classList.remove('hidden');
        
        console.log("QR Code gerado e exibido com sucesso");
    } catch (error) {
        console.error("Erro ao gerar QR Code:", error);
        document.querySelector('.instruction').textContent = 'Erro ao gerar QR Code. Tente novamente.';
    }
}

// Verificar status do WhatsApp
async function checkWhatsAppStatus() {
    if (!currentUser || !authToken) return;
    
    try {
        const response = await fetch(`${API_URL}/whatsapp/status/${currentUser.username}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        // Se token expirou, fazer logout
        if (response.status === 401) {
            if (qrCodeEventSource) {
                qrCodeEventSource.close();
                qrCodeEventSource = null;
            }
            
            if (qrCodeCheckInterval) {
                clearInterval(qrCodeCheckInterval);
                qrCodeCheckInterval = null;
            }
            
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            
            authToken = null;
            currentUser = null;
            
            hideMainPanel();
            showLoginModal();
            
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            return;
        }
        
        const data = await response.json();
        
        if (data.success && data.status) {
            // Atualizar indicador de status
            const statusElement = document.getElementById('connectionStatus');
            const numberElement = document.getElementById('phoneNumber');
            
            if (data.status.connected) {
                statusElement.textContent = 'Conectado';
                statusElement.className = 'status-badge online';
                
                // Verificar número de WhatsApp válido antes de fechar EventSource
                if (data.status.phoneNumber && data.status.phoneNumber !== 'Não conectado') {
                    // Se acabou de conectar e havia um EventSource aberto, fechar
                    if (qrCodeEventSource) {
                        console.log("WhatsApp conectado, fechando EventSource");
                        qrCodeEventSource.close();
                        qrCodeEventSource = null;
                    }
                    
                    // Esconder QR Code e mostrar mensagem
                    document.getElementById('qrcode').classList.add('hidden');
                    document.querySelector('.instruction').textContent = 'WhatsApp conectado com sucesso!';
                }
            } else {
                statusElement.textContent = 'Desconectado';
                statusElement.className = 'status-badge offline';
            }
            
            // Atualizar número de telefone
            numberElement.textContent = data.status.phoneNumber || 'Não conectado';
            
            // Atualizar status do bot
            document.getElementById('botToggle').checked = data.status.botActive;
        }
    } catch (error) {
        console.error('Erro ao verificar status do WhatsApp:', error);
    }
}

// Salvar prompt
async function savePrompt() {
    if (!currentUser || !authToken) {
        showNotification('Erro de autenticação. Faça login novamente.', 'error');
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        hideMainPanel();
        showLoginModal();
        return;
    }
    
    const promptText = document.getElementById('promptText').value;
    
    if (!promptText.trim()) {
        showNotification('O prompt não pode estar vazio', 'warning');
        return;
    }
    
    try {
        // Desabilitar botão durante o salvamento
        const btnSave = document.getElementById('btnSavePrompt');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        const response = await fetch(`${API_URL}/whatsapp/update-prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                username: currentUser.username,
                prompt: promptText
            })
        });
        
        // Verificar token expirado
        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            hideMainPanel();
            showLoginModal();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Prompt salvo com sucesso!', 'success');
            
            // Atualizar no currentUser local
            currentUser.prompt = promptText;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            showNotification(data.message || 'Erro ao salvar prompt', 'error');
        }
        
        // Reabilitar botão
        btnSave.disabled = false;
        btnSave.innerHTML = 'Salvar Prompt';
    } catch (error) {
        console.error('Erro ao salvar prompt:', error);
        showNotification('Erro de conexão ao servidor', 'error');
        
        // Reabilitar botão
        document.getElementById('btnSavePrompt').disabled = false;
        document.getElementById('btnSavePrompt').innerHTML = 'Salvar Prompt';
    }
}

// Alternar status do bot (ativar/desativar)
async function toggleBot(event) {
    if (!currentUser || !authToken) {
        showNotification('Erro de autenticação. Faça login novamente.', 'error');
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        hideMainPanel();
        showLoginModal();
        return;
    }
    
    const isActive = event.target.checked;
    
    try {
        const response = await fetch(`${API_URL}/whatsapp/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                username: currentUser.username,
                active: isActive
            })
        });
        
        // Verificar token expirado
        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            hideMainPanel();
            showLoginModal();
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Bot ${isActive ? 'ativado' : 'desativado'} com sucesso!`, 'success');
            
            // Atualizar no currentUser local
            currentUser.botAtivo = isActive;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            // Reverter toggle se falhar
            event.target.checked = !isActive;
            showNotification(data.message || `Erro ao ${isActive ? 'ativar' : 'desativar'} bot`, 'error');
        }
    } catch (error) {
        console.error('Erro ao alternar status do bot:', error);
        
        // Reverter toggle se falhar
        event.target.checked = !isActive;
        showNotification('Erro de conexão ao servidor', 'error');
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    // Verificar se já existe uma notificação
    let notification = document.querySelector('.notification');
    
    if (!notification) {
        // Criar elemento de notificação
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    // Definir tipo e mensagem
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Mostrar notificação
    notification.classList.add('show');
    
    // Ocultar após 3 segundos
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Adicionar classe .hidden para os elementos que precisam começar ocultos
document.addEventListener('DOMContentLoaded', () => {
    // Adicionar CSS para a classe .hidden
    const style = document.createElement('style');
    style.textContent = `
        .hidden {
            display: none !important;
        }
        
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            opacity: 0;
            transform: translateY(100%);
            transition: all 0.3s ease;
            z-index: 9999;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        }
        
        .notification.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .notification.success {
            background-color: var(--success-color);
        }
        
        .notification.error {
            background-color: var(--danger-color);
        }
        
        .notification.warning {
            background-color: var(--warning-color);
        }
        
        .notification.info {
            background-color: var(--secondary-color);
        }
    `;
    document.head.appendChild(style);
});