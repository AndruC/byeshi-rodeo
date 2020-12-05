import io from "socket.io-client";
import { EventEmitter } from "events";

import Connection from "./Connection";

import { omit } from "../helpers/shared";
import { logError } from "../helpers/logging";

/**
 * @typedef {object} SessionPeer
 * @property {string} id - The socket id of the peer
 * @property {Connection} connection - The actual peer connection
 * @property {boolean} initiator - Is this peer the initiator of the connection
 * @property {boolean} sync - Should this connection sync other connections
 */

/**
 *
 * Handles connections to multiple peers
 *
 * Events:
 * - connect: A party member has connected
 * - data
 * - trackAdded
 * - trackRemoved
 * - disconnect: A party member has disconnected
 * - error
 * - authenticationSuccess
 * - authenticationError
 * - connected: You have connected to the party
 * - disconnected: You have disconnected from the party
 */
class Session extends EventEmitter {
  /**
   * The socket io connection
   *
   * @type {SocketIOClient.Socket}
   */
  socket;

  /**
   * A mapping of socket ids to session peers
   *
   * @type {Object.<string, SessionPeer>}
   */
  peers;

  /**
   * The state of the session
   *
   * @type {('unknown'|'online'|'offline')}
   */
  state;

  get id() {
    return this.socket && this.socket.id;
  }

  _iceServers;

  // Store party id and password for reconnect
  _gameId;
  _password;

  constructor() {
    super();
    this.peers = {};
    this.state = "unknown";
    // Signal connected peers of a closure on refresh
    window.addEventListener("beforeunload", this._handleUnload.bind(this));
  }

  async connect() {
    try {
      const response = await fetch(process.env.REACT_APP_ICE_SERVERS_URL);
      if (!response.ok) {
        throw Error("Unable to fetch ICE servers");
      }
      const data = await response.json();
      this._iceServers = data.iceServers;

      this.socket = io(process.env.REACT_APP_BROKER_URL, {
        withCredentials: true,
      });

      this.socket.on("player_joined", this._handlePlayerJoined.bind(this));
      this.socket.on("player_left", this._handlePlayerLeft.bind(this));
      this.socket.on("joined_game", this._handleJoinedGame.bind(this));
      this.socket.on("signal", this._handleSignal.bind(this));
      this.socket.on("auth_error", this._handleAuthError.bind(this));
      this.socket.on("disconnect", this._handleSocketDisconnect.bind(this));
      this.socket.io.on("reconnect", this._handleSocketReconnect.bind(this));

      this.state = "online";
    } catch (error) {
      logError(error);
      this.state = "offline";
    }
  }

  /**
   * Send data to all connected peers
   *
   * @param {string} id - the id of the event to send
   * @param {object} data
   * @param {string} channel
   */
  send(id, data, channel) {
    for (let peer of Object.values(this.peers)) {
      peer.connection.send({ id, data }, channel);
    }
  }

  /**
   * Join a party
   *
   * @param {string} gameId - the id of the party to join
   * @param {string} password - the password of the party
   */
  async joinGame(gameId, password) {
    if (typeof gameId !== "string" || typeof password !== "string") {
      console.error(
        "Unable to join game: invalid game ID or password",
        gameId,
        password
      );
      return;
    }

    this._gameId = gameId;
    this._password = password;
    this.socket.emit("join_game", gameId, password);
  }

  _addPeer(id, initiator, sync) {
    try {
      const connection = new Connection({
        initiator,
        trickle: true,
        config: { iceServers: this._iceServers },
      });
      if (initiator) {
        connection.createDataChannel("map", { iceServers: this._iceServers });
        connection.createDataChannel("token", { iceServers: this._iceServers });
      }
      const peer = { id, connection, initiator, sync };

      function sendPeer(id, data, channel) {
        peer.connection.send({ id, data }, channel);
      }

      function handleSignal(signal) {
        this.socket.emit("signal", JSON.stringify({ to: peer.id, signal }));
      }

      function handleConnect() {
        this.emit("connect", { peer, reply: sendPeer });
        if (peer.sync) {
          peer.connection.send({ id: "sync" });
        }
      }

      function handleDataComplete(data) {
        if (data.id === "close") {
          // Close connection when signaled to close
          peer.connection.destroy();
        }
        this.emit("data", {
          peer,
          id: data.id,
          data: data.data,
          reply: sendPeer,
        });
      }

      function handleDataProgress({ id, count, total }) {
        this.emit("dataProgress", { peer, id, count, total, reply: sendPeer });
      }

      function handleTrack(track, stream) {
        this.emit("trackAdded", { peer, track, stream });
        track.addEventListener("mute", () => {
          this.emit("trackRemoved", { peer, track, stream });
        });
      }

      function handleClose() {
        this.emit("disconnect", { peer });
        if (peer.id in this.peers) {
          peer.connection.destroy();
          this.peers = omit(this.peers, [peer.id]);
        }
      }

      function handleError(error) {
        console.error(error);
        this.emit("error", { peer, error });
        if (peer.id in this.peers) {
          peer.connection.destroy();
          this.peers = omit(this.peers, [peer.id]);
        }
      }

      peer.connection.on("signal", handleSignal.bind(this));
      peer.connection.on("connect", handleConnect.bind(this));
      peer.connection.on("dataComplete", handleDataComplete.bind(this));
      peer.connection.on("dataProgress", handleDataProgress.bind(this));
      peer.connection.on("track", handleTrack.bind(this));
      peer.connection.on("close", handleClose.bind(this));
      peer.connection.on("error", handleError.bind(this));

      this.peers[id] = peer;
    } catch (error) {
      logError(error);
      this.emit("error", { error });
      this.emit("disconnected");
      for (let peer of Object.values(this.peers)) {
        peer.connection && peer.connection.destroy();
      }
    }
  }

  _handleJoinedGame(otherIds) {
    for (let i = 0; i < otherIds.length; i++) {
      const id = otherIds[i];
      // Send a sync request to the first member of the party
      const sync = i === 0;
      this._addPeer(id, true, sync);
    }
    this.emit("authenticationSuccess");
    this.emit("connected");
  }

  _handlePlayerJoined(id) {
    this._addPeer(id, false, false);
  }

  _handlePlayerLeft(id) {
    if (id in this.peers) {
      this.peers[id].connection.destroy();
      delete this.peers[id];
    }
  }

  _handleSignal(data) {
    const { from, signal } = data;
    if (from in this.peers) {
      this.peers[from].connection.signal(signal);
    }
  }

  _handleAuthError() {
    this.emit("authenticationError");
  }

  _handleUnload() {
    for (let peer of Object.values(this.peers)) {
      peer.connection.send({ id: "close" });
    }
  }

  _handleSocketDisconnect() {
    this.emit("disconnected");
    for (let peer of Object.values(this.peers)) {
      peer.connection && peer.connection.destroy();
    }
  }

  _handleSocketReconnect() {
    if (this._gameId) {
      this.joinGame(this._gameId, this._password);
    }
  }
}

export default Session;
