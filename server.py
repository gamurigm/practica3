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
    username = data.get('username', '').strip()
    room = data.get('room', 'General')
    
    if not username:
        emit('login_error', {'message': 'El nombre de usuario es obligatorio.'})
        return
        
    if username in usuarios.values():
        emit('login_error', {'message': 'El nombre de usuario ya está en uso. Por favor, elige otro.'})
        return
        
    usuarios[request.sid] = username
    print(f'El usuario {username} se unio a la sala {room}')
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
    ttl = int(data.get('ttl', 60))  # TTL enviado por el cliente (10, 60 o 300)
    
    print(f"Mensaje temporal transferido en sala {room}.")
    
    msg_data = {
        'id': msg_id, 'username': username,
        'message': message_content,
        'timestamp': datetime.now().strftime('%H:%M:%S'),
        'ttl': ttl
    }
    
    if room not in historial_salas:
        historial_salas[room] = []
    historial_salas[room].append(msg_data)
    
    emit('chat_message', msg_data, to=room)

@socketio.on('message_read')
def handle_message_read(data):
    room = data.get('room', 'General')
    msg_id = data.get('id')
    
    # Recuperar el TTL original del mensaje desde el historial
    ttl = 60
    if room in historial_salas:
        for msg in historial_salas[room]:
            if msg.get('id') == msg_id:
                ttl = int(msg.get('ttl', 60))
                break
    
    def purgar_mensaje(r_name, m_id, t):
        socketio.sleep(t)
        if r_name in historial_salas:
            historial_salas[r_name] = [m for m in historial_salas[r_name] if m.get('id') != m_id]
            print(f"Mensaje purgado del historial tras {t}s.")
            
    socketio.start_background_task(purgar_mensaje, room, msg_id, ttl)

    # Retransmitir confirmación con el TTL real a toda la sala
    emit('message_read', {'id': msg_id, 'reader': usuarios.get(request.sid), 'ttl': ttl}, to=room, include_self=True)

@socketio.on('disconnect')
def handle_disconnect():
    username = usuarios.pop(request.sid, 'Anonimo')
    print(f'Un usuario se ha desconectado.')  # Log protegido sin revelar identidades/IP
    # Como no almacenamos la sala a nivel de desconexión simple, podemos enviarlo global o emitir en general
    emit('user_left', {'username': username}, broadcast=True)
    emit('user_list', {'usuarios': list(usuarios.values())}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host="127.0.0.1", port=5001,    debug=True)


    



 

