class ChatApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this.socket = null;
        this.username = '';
        this.room = '';
        this.users = [];
        this.messages = [];
        
        this.render();
    }

    connectedCallback() {
        const serverUrl = this.getAttribute('server-url') || 'http://localhost:5001';
        this.setupSocket(serverUrl);
        this.addEventListeners();
    }

    disconnectedCallback() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    setupSocket(serverUrl) {
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            this.updateStatus('Conectado');
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('Desconectado');
        });

        this.socket.on('login_success', (data) => {
            this.username = data.username;
            this.room = data.room;
            const shadow = this.shadowRoot;
            shadow.getElementById('login-screen').style.display = 'none';
            shadow.getElementById('chat-screen').style.display = 'flex';
            this.addSystemMessage(`Bienvenido a la sala ${this.room}, ${this.username}`);
        });

        this.socket.on('login_error', (data) => {
            const errorEl = this.shadowRoot.getElementById('login-error');
            if (errorEl) {
                errorEl.textContent = data.message;
                errorEl.style.display = 'block';
            }
        });

        this.socket.on('user_joined', (data) => {
            this.addSystemMessage(`${data.username} se ha unido a la sala`);
        });

        this.socket.on('user_left', (data) => {
            this.addSystemMessage(`${data.username} ha abandonado la sala`);
        });

        this.socket.on('message_read', (data) => {
            const checkEl = this.shadowRoot.getElementById(`check-${data.id}`);
            if (checkEl) {
                checkEl.textContent = "✓✓"; // Doble check
                checkEl.style.color = "#34b7f1"; // Color azul (leído)
            }
            
            // Iniciar cuenta regresiva SOLAMENTE cuando recibimos lectura
            const msgDiv = this.shadowRoot.getElementById(`msg-${data.id}`);
            if (msgDiv && !msgDiv.dataset.started) {
                msgDiv.dataset.started = 'true';
                
                let timeLeft = data.ttl || 60; // 60 segundos por defecto del servidor
                
                // Mostrar o crear el timer en el HTML
                let timerSpan = msgDiv.querySelector('.countdown');
                if (!timerSpan) {
                    const footer = msgDiv.querySelector('.msg-footer');
                    if (footer) {
                        footer.insertAdjacentHTML('afterbegin', `<span class="timer">⏱ <span class="countdown">${timeLeft}</span>s</span>`);
                        timerSpan = msgDiv.querySelector('.countdown');
                    }
                }
                
                const intervalId = setInterval(() => {
                    timeLeft--;
                    if (timerSpan) timerSpan.textContent = timeLeft;
                    
                    if (timeLeft <= 0) {
                        clearInterval(intervalId);
                        if (msgDiv.parentNode) {
                            msgDiv.remove();
                        }
                    }
                }, 1000);
            }
        });

        this.socket.on('user_list', (data) => {
            this.users = data.usuarios;
            this.updateUsersList();
        });

        this.socket.on('chat_message', (data) => {
            this.addMessage(data);
        });
    }

    addEventListeners() {
        const shadow = this.shadowRoot;
        
        shadow.getElementById('login-btn').addEventListener('click', () => {
            const usernameInput = shadow.getElementById('username-input').value.trim();
            const roomInput = shadow.getElementById('room-input').value.trim() || 'General';
            const errorEl = shadow.getElementById('login-error');
            if (errorEl) errorEl.style.display = 'none'; // Ocultar error previo
            
            if (usernameInput) {
                this.socket.emit('set_username', { username: usernameInput, room: roomInput });
                // Ya no pasamos directamente al chat, esperamos respuesta del server
            }
        });

        const sendBtn = shadow.getElementById('send-btn');
        const messageInput = shadow.getElementById('message-input');

        const sendMessage = () => {
            const message = messageInput.value.trim();
            const msgId = Date.now().toString() + Math.floor(Math.random()*1000); // Generar ID único
            
            if (message === '/exit') {
                this.socket.disconnect();
                
                // Limpiar inputs y volver a la pantalla de login
                shadow.getElementById('chat-screen').style.display = 'none';
                shadow.getElementById('login-screen').style.display = 'flex';
                shadow.getElementById('username-input').value = '';
                shadow.getElementById('room-input').value = '';
                messageInput.value = '';
                
                // Reconectar el socket por si el usuario quiere volver a entrar
                this.socket.connect();
                return;
            }

            if (message) {
                // Ya no pasamos TTL, el servidor dictamina que será 1 minuto
                this.socket.emit('chat_message', { id: msgId, message, room: this.room });
                messageInput.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    updateStatus(status) {
        const statusEl = this.shadowRoot.getElementById('status');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.style.color = status === 'Conectado' ? 'green' : 'red';
        }
    }

    updateUsersList() {
        const usersEl = this.shadowRoot.getElementById('users-list');
        if (usersEl) {
            usersEl.innerHTML = '<strong>Usuarios en la sala:</strong> ' + (this.users.join(', ') || 'Sólo tú');
        }
    }

    addSystemMessage(text) {
        this.addMessage({ system: true, message: text });
    }

    addMessage(data) {
        const messagesContainer = this.shadowRoot.getElementById('messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        // Asignamos el id del mensaje para poder eliminarlo después o buscarlo
        if (data.id) msgDiv.id = `msg-${data.id}`;
        
        if (data.system) {
            msgDiv.classList.add('system');
            msgDiv.textContent = data.message;
        } else {
            const isOwn = data.username === this.username;
            if (isOwn) {
                msgDiv.classList.add('own');
            } else {
                // Observador para verificar si el usuario ve el mensaje en pantalla
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const markAsRead = () => {
                                this.socket.emit('message_read', { id: data.id, room: this.room });
                                observer.disconnect();
                            };
                            
                            // Si el documento tiene foco, marcar como leído. Caso contrario, esperar al foco.
                            if (document.hasFocus()) {
                                markAsRead();
                            } else {
                                const focusHandler = () => {
                                    markAsRead();
                                    window.removeEventListener('focus', focusHandler);
                                };
                                window.addEventListener('focus', focusHandler);
                            }
                        }
                    });
                }, { root: messagesContainer });
                
                // Iniciar la observación del mensaje
                requestAnimationFrame(() => observer.observe(msgDiv));
            }
            
            // Construir el contenido del mensaje
            msgDiv.innerHTML = `
                <span class="meta">${data.timestamp || new Date().toLocaleTimeString()} - ${isOwn ? 'Tú' : data.username}:</span> 
                ${data.message}
                <div class="msg-footer">
                    ${isOwn ? `<span id="check-${data.id}" class="check">✓</span>` : ''}
                </div>
            `;
            
            // Ya no disparamos el TTL y eliminacion al llegar el chat_message. Esperamos el message_read.
        }

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    overflow: hidden;
                    height: 500px;
                    display: flex;
                    flex-direction: column;
                }
                .header {
                    background: #0078d4;
                    color: white;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                }
                .container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #f9f9f9;
                }
                #login-screen {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                #login-screen input {
                    padding: 10px;
                    font-size: 16px;
                    margin-bottom: 10px;
                    width: 80%;
                    max-width: 300px;
                }
                #login-screen button {
                    padding: 10px 20px;
                    font-size: 16px;
                    cursor: pointer;
                    background: #0078d4;
                    color: white;
                    border: none;
                    border-radius: 4px;
                }
                #chat-screen {
                    display: none;
                    flex-direction: column;
                    flex: 1;
                }
                #messages {
                    flex: 1;
                    padding: 15px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .message {
                    padding: 8px 12px;
                    border-radius: 6px;
                    background: white;
                    max-width: 80%;
                    align-self: flex-start;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .message.own {
                    background: #dcf8c6;
                    align-self: flex-end;
                }
                .message.system {
                    background: transparent;
                    color: #888;
                    font-style: italic;
                    font-size: 0.9em;
                    align-self: center;
                    box-shadow: none;
                }
                .message .meta {
                    font-size: 0.8em;
                    color: #555;
                    font-weight: bold;
                    display: block;
                    margin-bottom: 3px;
                }
                .msg-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 5px;
                    font-size: 0.8em;
                }
                .timer {
                    color: #d9534f;
                    font-weight: bold;
                }
                .check {
                    color: #999;
                    font-weight: bold;
                }
                #users-list {
                    padding: 10px 15px;
                    background: #eee;
                    font-size: 0.9em;
                    color: #333;
                    border-bottom: 1px solid #ddd;
                }
                .input-area {
                    display: flex;
                    padding: 10px;
                    background: white;
                    border-top: 1px solid #ccc;
                }
                .input-area input {
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                }
                .input-area button {
                    margin-left: 10px;
                    padding: 10px 20px;
                    background: #0078d4;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
            </style>
            
            <div class="header">
                <div>Chat Web</div>
                <div id="status">Conectando...</div>
            </div>
            
            <div class="container">
                <!-- Pantalla de Login -->
                <div id="login-screen">
                    <h2>Bienvenido al Chat Privado</h2>
                    <input type="text" id="username-input" placeholder="Nombre de usuario" />
                    <!-- Input del código de la sala que se muestra en la UI -->
                    <input type="text" id="room-input" placeholder="Código de la Sala (ej. 1234)" />
                    <button id="login-btn">Entrar</button>
                    <p id="login-error" style="color: red; display: none; margin-top: 10px; font-size: 14px; text-align: center; font-weight: bold;"></p>
                </div>

                <!-- Pantalla de Chat -->
                <div id="chat-screen">
                    <div id="users-list"><strong>Usuarios en la sala:</strong> </div>
                    <div id="messages"></div>
                    
                    <div class="input-area">
                        <!-- Selector de TTL eliminado, el servidor lo controla -->
                        <input type="text" id="message-input" placeholder="Escribe tu mensaje temporal..." />
                        <button id="send-btn">Enviar</button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('chat-app', ChatApp);