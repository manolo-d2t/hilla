import type { DefaultEventsMap } from '@socket.io/component-emitter';
import { io, Socket } from 'socket.io-client';
import type { Subscription } from './Connect';
import { getCsrfTokenHeadersForEndpointRequest } from './CsrfUtils';
import type { ClientMessage, ServerCloseMessage, ServerConnectMessage, ServerMessage } from './FluxMessages';

export enum State {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
const activeEventName = 'state-changed';

/**
 * A representation of the underlying persistent network connection used for subscribing to Flux type endpoint methods.
 */
export class FluxConnection {
  private nextId = 0;
  private endpointInfos = new Map<string, string>();
  private onNextCallbacks = new Map<string, (value: any) => void>();
  private onCompleteCallbacks = new Map<string, () => void>();
  private onErrorCallbacks = new Map<string, () => void>();
  private closed = new Set<string>();

  private socket!: Socket<DefaultEventsMap, DefaultEventsMap>;
  public state: State = State.INACTIVE;
  private listeners: { [key: string]: ((event: CustomEvent) => void)[] } = {};

  constructor() {
    if (!(window as any).Vaadin?.featureFlags?.hillaPush) {
      // Remove when removing feature flag
      throw new Error(
        `Push support in Hilla is not enabled. Enable it in the debug window or by adding com.vaadin.experimental.hillaPush=true to vaadin-featureflags.properties`,
      );
    }
    this.connectWebsocket();
  }

  private connectWebsocket() {
    const extraHeaders = getCsrfTokenHeadersForEndpointRequest(document);
    this.socket = io('/hilla', { path: '/VAADIN/hillapush/', extraHeaders });
    this.socket.on('message', (message) => {
      this.handleMessage(JSON.parse(message));
    });
    this.socket.on('disconnect', () => {
      // https://socket.io/docs/v4/client-api/#event-disconnect
      if (this.state === State.ACTIVE) {
        this.state = State.INACTIVE;
        this.dispatchEvent(new CustomEvent(activeEventName, { detail: { active: false } }));
      }
    });
    this.socket.on('connect_error', () => {
      // https://socket.io/docs/v4/client-api/#event-connect_error
    });

    this.socket.on('connect', () => {
      // https://socket.io/docs/v4/client-api/#event-connect
      if (this.state === State.INACTIVE) {
        this.state = State.ACTIVE;
        this.dispatchEvent(new CustomEvent(activeEventName, { detail: { active: true } }));
      }
    });
  }

  private handleMessage(message: ClientMessage) {
    const { id } = message;
    const endpointInfo = this.endpointInfos.get(id);

    if (message['@type'] === 'update') {
      const callback = this.onNextCallbacks.get(id);
      const closed = this.closed.has(id);
      if (callback && !closed) {
        callback(message.item);
      } else if (!callback) {
        throw new Error(`No callback for stream id ${id}`);
      }
    } else if (message['@type'] === 'complete') {
      const callback = this.onCompleteCallbacks.get(id);
      if (callback) {
        callback();
      }

      this.removeSubscription(id);
    } else if (message['@type'] === 'error') {
      const callback = this.onErrorCallbacks.get(id);
      if (callback) {
        callback();
      }
      this.removeSubscription(id);
      if (!callback) {
        throw new Error(`Error in ${endpointInfo}: ${message.message}`);
      }
    } else {
      throw new Error(`Unknown message from server: ${message}`);
    }
  }

  private removeSubscription(id: string) {
    this.onNextCallbacks.delete(id);
    this.onCompleteCallbacks.delete(id);
    this.onErrorCallbacks.delete(id);
    this.endpointInfos.delete(id);
    this.closed.delete(id);
  }

  private send(message: ServerMessage) {
    this.socket.send(message);
  }

  /**
   * Subscribes to the flux returned by the given endpoint name + method name using the given parameters.
   *
   * @param endpointName the endpoint to connect to
   * @param methodName the method in the endpoint to connect to
   * @param parameters the parameters to use
   * @returns a subscription
   */
  subscribe(endpointName: string, methodName: string, parameters?: Array<any>): Subscription<any> {
    const id: string = this.nextId.toString();
    this.nextId += 1;
    const params = parameters || [];

    const msg: ServerConnectMessage = { '@type': 'subscribe', id, endpointName, methodName, params };
    const endpointInfo = `${endpointName}.${methodName}(${JSON.stringify(params)})`;
    this.send(msg);
    this.endpointInfos.set(id, endpointInfo);
    const hillaSubscription: Subscription<any> = {
      onNext: (callback: (value: any) => void): Subscription<any> => {
        this.onNextCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onComplete: (callback: () => void): Subscription<any> => {
        this.onCompleteCallbacks.set(id, callback);
        return hillaSubscription;
      },
      onError: (callback: () => void): Subscription<any> => {
        this.onErrorCallbacks.set(id, callback);
        return hillaSubscription;
      },
      cancel: () => {
        const closeMessage: ServerCloseMessage = { '@type': 'unsubscribe', id };
        this.send(closeMessage);
        this.closed.add(id);
      },
    };
    return hillaSubscription;
  }

  /**
   * Adds a listener for the given event type.
   *
   * @param type  the type of event
   * @param listener  the listener to call when the event occurs
   */
  addEventListener(type: string, listener: (event: CustomEvent) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  /**
   * Removes a listener for the given event type.
   *
   * @param type  the type of event
   * @param listener  the listener to remove
   */
  removeEventListener(type: string, listener: (event: CustomEvent) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  private dispatchEvent(e: CustomEvent) {
    (this.listeners[e.type] || []).forEach((listener: (event: CustomEvent) => void) => {
      listener(e);
    });
  }
}
