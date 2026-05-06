from datetime import datetime
from flask import Flask, render_template, request   
from flask_socketio import SocketIO, emit, send, join_room, leave_room
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app) #habilita CORS para todo los origenes


socketio = SocketIO(app, cors_allowed_origins="*")
usuarios = {}
historial_salas = {}

@app.route('/')
def index():
    return "<h1>Bienvenido a mi chat</h1>"

@socketio.on('connect')
def handle_connect():
    print(f'Nuevo usuario conectado: {request.sid}')

@socketio.on('set_username')
def handle_set_username(data):
    username = data.get('username', 'Anonimo')
    room = data.get('room', 'General')
    
    if username in usuarios.values():
        emit('login_error', {'message': 'El nombre de usuario ya está en uso. Por favor, elige otro.'})
        return
        
    usuarios[request.sid] = username
    print(f'Un usuario se ha conectado de forma {username} a la sala {room}') # Log protegido
    join_room(room)
    
    emit('login_success', {'username': username, 'room': room})
    emit('user_joined', {'username': username}, to=room, include_self=False)
    
    # Enviar historial de mensajes no expirados al nuevo usuario
    if room in historial_salas:
        for msg in historial_salas[room]:
            emit('chat_message', msg, to=request.sid)
            
    # Por simplicidad de la prueba, informamos a la sala
    emit('user_list', {'usuarios': list(usuarios.values())}, to=room)

@socketio.on('chat_message')
def handle_chat_message(data):
    username = usuarios.get(request.sid, 'Anonimo')
    room = data.get('room', 'General')
    message_content = data.get('message', '')
    msg_id = data.get('id', '')
    
    # Log genérico en servidor (No expone contenido, evita captura)
    print(f"Mensaje temporal transferido en sala {room}.")
    
    msg_data = {
        'id': msg_id, 'username': username,
        'message': message_content,
        'timestamp': datetime.now().strftime('%H:%M:%S')
    }
    
    if room not in historial_salas:
        historial_salas[room] = []
    historial_salas[room].append(msg_data)
    
    # EMITIR AL RESTO DE LA SALA SIN TTL AÚN, el TTL inicia con la lectura
    emit('chat_message', msg_data, to=room)

@socketio.on('message_read')
def handle_message_read(data):
    room = data.get('room', 'General')
    msg_id = data.get('id')
    
    # Iniciar la cuenta regresiva en el servidor para borrarlo del historial (TTL = 60s)
    def purgar_mensaje(r_name, m_id):
        socketio.sleep(60)
        if r_name in historial_salas:
            historial_salas[r_name] = [m for m in historial_salas[r_name] if m.get('id') != m_id]
            print(f"Mensaje purgado del historial del servidor tras 60s.")
            
    socketio.start_background_task(purgar_mensaje, room, msg_id)

    # Cuando alguien confirma lectura, emitimos con el TTL para que inicie la destrucción
    emit('message_read', {'id': msg_id, 'reader': usuarios.get(request.sid), 'ttl': 60}, to=room, include_self=True)

@socketio.on('disconnect')
def handle_disconnect():
    username = usuarios.pop(request.sid, 'Anonimo')
    print(f'Un usuario se ha desconectado.')  # Log protegido sin revelar identidades/IP
    # Como no almacenamos la sala a nivel de desconexión simple, podemos enviarlo global o emitir en general
    emit('user_left', {'username': username}, broadcast=True)
    emit('user_list', {'usuarios': list(usuarios.values())}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host="127.0.0.1", port=5001,    debug=True)


    



 

