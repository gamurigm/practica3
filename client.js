const io = require('socket.io-client');
const readLine = require('readline');

const SERVER_URL = 'http://localhost:5001'


const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
})

const rl = readLine.createInterface({
    input: process.stdin,
    output: process.stdout
})

let username = '';
let room = '';

const askUsername = () => {
    rl.question('Ingresa tu nombre de usuario: ', (name) => {
        username = name.trim();
        if (!username) return askUsername();
        
        rl.question('Ingresa el nombre de la sala (Ej. General): ', (r) => {
            room = r.trim() || 'General';
            socket.emit('set_username', { username, room });
        });
    });
}

const sendMessage = (message) => {
    if (message === '/exit') {
        console.log('Desconectando...')
        socket.disconnect();
        rl.close();
        process.exit(0);
    }
    const msgId = Date.now().toString() + Math.floor(Math.random() * 1000);
    socket.emit('chat_message', { id: msgId, message, room });
}

const displayMessage = (data, isOwn = false) => {
    const prefix = isOwn ? 'Tú' : data.username;
    console.log(`\n${data.timestamp} - ${prefix}: ${data.message}${isOwn ? ' [✓]' : ''}`);
}

socket.on('connect', () => {
    console.log('Conectado al servidor');
    askUsername();
})

socket.on('login_error', (data) => {
    console.log(`Error: ${data.message}`);
    askUsername();
});

socket.on('login_success', (data) => {
    console.log(`\n==========================================`);
    console.log(`Bienvenido ${data.username} a la sala [${data.room}]`);
    console.log(`Escribe tu mensaje ó /exit para salir`);
    console.log(`==========================================\n`);
    rl.prompt();
});

socket.on('user_joined', (data) => {
    console.log(`\n[Info] Usuario ${data.username} se ha unido a la sala`);
    rl.prompt();
})

socket.on('user_left', (data) => {
    console.log(`\n[Info] Usuario ${data.username} ha abandonado la sala`);
    rl.prompt();
})

socket.on('user_list', (data) => {
    console.log(`\n[Info] Usuarios en la sala: ${data.usuarios.join(', ') || 'Sólo tú'}`);
    rl.prompt();
})

socket.on('chat_message', (data) => {
    const isOwn = data.username === username;
    displayMessage(data, isOwn);
    
    if (!isOwn) {
        // En un cliente de consola, asumimos lectura automática cuando se imprime en pantalla
        socket.emit('message_read', { id: data.id, room: room });
    }
    rl.prompt();
})

socket.on('message_read', (data) => {
    // Mostramos la confirmación de lectura y activamos el borrado virtual
    const shortId = data.id.toString().substring(data.id.length - 4);
    console.log(`\n[✓✓] Confirmación: El mensaje (id:${shortId}) fue leído. Autodestrucción en ${data.ttl || 60}s...`);
    rl.prompt();
    
    setTimeout(() => {
        console.log(`\n[🗑] El mensaje (id:${shortId}) ha expirado y se destruyó.`);
        rl.prompt();
    }, (data.ttl || 60) * 1000);
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
    rl.close();
    process.exit(0);
})

rl.on('line', (input) => {
    if (input.trim()) {
        sendMessage(input.trim());
    } else {
        rl.prompt();
    }
}).on('close', () => {
    console.log('Desconectando...');
    socket.disconnect();
    process.exit(0);
});

rl.setPrompt('>> ');








