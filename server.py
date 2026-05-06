from datetime import datetime
from flask import Flask, render_template, request   
from flask_socketio import SocketIO, emit, send, join_room, leave_room
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app) #habilita CORS para todo los origenes


socketio = SocketIO(app, cors_allowed_origins="*")
usuarios = {}

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
    join_room(room)
    print(f'Un usuario se ha conectado de forma anónima a la sala {room}') # Log protegido
    
    emit('login_success', {'username': username, 'room': room})
    emit('user_joined', {'username': username}, to=room, include_self=False)
    # Por simplicidad de la prueba, informamos a la sala
    emit('user_list', {'usuarios': list(usuarios.values())}, to=room)

@socketio.on('chat_message')
def handle_chat_message(data):
    username = usuarios.get(request.sid, 'Anonimo')
    room = data.get('room', 'General')
    message_content = data.get('message', '')
    msg_id = data.get('id', '')
    ttl = data.get('ttl', 0)
    
    # Log genérico en servidor (No expone contenido, evita captura)
    print(f"Mensaje temporal de {ttl}s transferido en sala {room}.")
    
    emit('chat_message', 
        {'id': msg_id, 'username': username,
         'message': message_content, 'ttl': ttl,
         'timestamp': datetime.now().strftime('%H:%M:%S')},
        to=room)

@socketio.on('message_read')
def handle_message_read(data):
    room = data.get('room', 'General')
    emit('message_read', {'id': data.get('id'), 'reader': usuarios.get(request.sid)}, to=room, include_self=False)

@socketio.on('disconnect')
def handle_disconnect():
    username = usuarios.pop(request.sid, 'Anonimo')
    print(f'Un usuario se ha desconectado.')  # Log protegido sin revelar identidades/IP
    # Como no almacenamos la sala a nivel de desconexión simple, podemos enviarlo global o emitir en general
    emit('user_left', {'username': username}, broadcast=True)
    emit('user_list', {'usuarios': list(usuarios.values())}, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host="127.0.0.1", port=5001,    debug=True)


    



 

