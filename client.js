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

const askUsername = () => {
    return new Promise((resolve) => {
        rl.question('Ingresa tu nombre de usuario: ', (name) => {
            resolve(name.trim())
            username = name;
            socket.emit('set_username', { username });
            console.log(`Bienvenido ${username}`);
            resolve();
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
    socket.emit('chat_message', { username, message, timestamp: new Date().toLocaleTimeString() });
}

const displayMessage = (data, isOwn = false) => {
    const prefix = isOwn ? 'Tú' : data.username;
    const alignment = isOwn ? 'right' : 'left';
    console.log(`${data.timestamp} - ${prefix}: ${data.message}`);
}




socket.on('connect', () => {
    console.log('Conectado al servidor');
    askUsername().then((name) => {
        username = name
    });
    console.log(`Bienvenido ${username}, escribe tu mensaje ó /exit para salir`);
    rl.prompt();
})

socket.on('user_joined', (data) => {
    console.log(`Usuario ${data.username} se ha unido al chat`);
})

socket.on('user_left', (data) => {
    console.log(`Usuario ${data.username} ha abandonado el chat`);
})

socket.on('user_list', (data) => {
    console.log(`Usuarios en el chat: ${data.usuarios.join(', ') || 'Sólo tú'}`);
})

socket.on('chat_message', (data) => {
    const isOwn = data.username === username;
    displayMessage(data, isOwn);
    rl.prompt();
})

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
    rl.close();
    process.exit(0);
})

rl.on('line', (input) => {
    if (input.trim())
        sendMessage(input.trim());
    rl.prompt();
}).on('close', () => {
    console.log('Desconectando...');
    socket.disconnect();
    process.exit(0);
});

rl.setPrompt('>> ');








