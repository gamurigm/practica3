# Servidor Websocket con privacidad Avanzada

Nombres: Gabriel López, Gabriel Murillo

## Funcionalidades
* Chat en tiempo real
* Implementación Web sockets
* Confirmación de envio y recepción de mensajes
* Mensajes temporales con tiempo de vida de 1 minuto
* Implementación de seguridad por nombres y acceso por código de sala
* Interfaz visual con:
    * Pantalla de ingreso
    * Chat visual
    * Lista de usuarios en la sala  

# Instrucciones de ejecución
1. Inicializar servidor ejecutando el comando **python server.py**
2. Inicializar servidor front ejecutando **node main.js**

# Explicación de implementación

## Eventos principales

### Cliente → Servidor
- `set_username`: Registra usuario en sala con código único
- `chat_message`: Envía mensaje con ID único y sala destino
- `message_read`: Notifica lectura de mensaje (inicia TTL)

### Servidor → Cliente
- `login_success`: Confirmación de acceso exitoso
- `login_error`: Error de autenticación
- `user_joined/user_left`: Notificaciones de entrada/salida
- `user_list`: Lista actualizada de usuarios
- `chat_message`: Distribución de mensajes a la sala
- `message_read`: Confirmación de lectura + TTL de 60s

## Arquitectura de privacidad
- Logs del servidor no exponen contenido ni identidades
- Mensajes temporales con TTL iniciado al ser leídos
- Eliminación automática del historial tras 60s

# Diagrama de flujo

## Flujo del Web Client (web-client.js)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant C as web-client.js
    participant S as server.py

    U->>C: Ingresa nombre y sala
    C->>S: emit(set_username)
    S-->>C: login_success
    C->>U: Mostrar chat screen
    
    U->>C: Escribe mensaje
    C->>S: emit(chat_message)
    S-->>C: chat_message (broadcast sala)
    C->>U: Mostrar mensaje con ✓
    
    U->>C: Ve mensaje (otro usuario)
    C->>C: IntersectionObserver detecta visibilidad
    C->>S: emit(message_read)
    S-->>C: message_read (TTL=60s)
    C->>U: ✓✓ + countdown 60s
    
    loop Cada segundo
        C->>C: countdown--
        C->>U: Actualizar timer
    end
    
    C->>C: countdown=0
    C->>U: Eliminar mensaje
```

## Flujo del Server (server.py)

```mermaid
sequenceDiagram
    participant C as web-client.js
    participant S as server.py

    C->>S: connect
    S->>S: handle_connect()
    
    C->>S: emit(set_username)
    S->>S: handle_set_username()
    S->>S: Verificar username uniquo
    S->>S: join_room
    S-->>C: login_success, user_joined, user_list
    
    C->>S: emit(chat_message)
    S->>S: handle_chat_message()
    S->>S: Guardar en historial_salas[room]
    S-->>C: chat_message (broadcast sala)
    
    C->>S: emit(message_read)
    S->>S: handle_message_read()
    S->>S: start_background_task(purgar_mensaje)
    S-->>C: message_read (TTL=60s)
    
    S->>S: sleep(60s)
    S->>S: purgar_mensaje()
    S->>S: Eliminar mensaje de historial
    
    C->>S: disconnect
    S->>S: handle_disconnect()
    S->>S: Remover de usuarios
    S-->>C: user_left, user_list
```

