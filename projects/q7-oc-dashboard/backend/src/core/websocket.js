export class ConnectionManager {
  constructor() {
    this.clients = new Map();
  }

  add(clientId, ws) {
    this.clients.set(clientId, ws);
  }

  remove(clientId) {
    this.clients.delete(clientId);
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const [clientId, ws] of this.clients.entries()) {
      if (ws.readyState === 1) {
        ws.send(payload);
      } else {
        this.clients.delete(clientId);
      }
    }
  }

  send_to(clientId, message) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}

export const manager = new ConnectionManager();
