/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import { WatchableMessageStore } from "../watchable-message-store/WatchableMessageStore.js";
/**
 * A base-class to define an Actor type. It requires all sub-classes to
 * implement the {@link Actor#onMessage} callback.
 *
 *    class MyActor extends Actor<MessageType> {
 *      onMessage(message: MessageType) {
 *        console.log(`Actor ${this.actorName} I received message: ${message}`);
 *      }
 *    }
 *
 * If you would like to perform some initialization logic, implement the
 * optional {@link Actor#init} callback.
 *
 *    class MyActor extends Actor<MessageType> {
 *      stockData?: StockData;
 *      count?: number;
 *
 *      async init() {
 *        this.count = 0;
 *        this.stockData = await (await fetch("/stockdata.json")).json()
 *      }
 *
 *      onMessage(message: MessageType) {
 *        this.count!++;
 *        console.log(`Actor ${this.actorName} received message number ${this.count}: ${message}`);
 *      }
 *    }
 *
 * If you want to know the actorName that this actor is assigned to in your
 * application, you can use `actorName`. This field is accessible only after
 * the {@link hookup} has been called.
 *
 * Users of this actor generally should not use {@link Actor#initPromise}. This
 * is an internal implementation detail for {@link hookup}.
 */
export class Actor {
    constructor() {
        // Run init in the next microtask
        this.initPromise = Promise.resolve().then(() => this.init());
    }
    /**
     * Init callback that can be used to perform some initialization logic.
     * This method is invoked in the constructor of an {@link Actor} and should
     * not be called by any user of the actor subclass.
     *
     * Note that no messages will be delivered until the resulting promise
     * is resolved.
     *
     * @return A promise which resolves once this actor is initialized.
     */
    async init() { }
}
/**
 * @return A random positive integer
 */
function randomMaxInt() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
const messageStore = new WatchableMessageStore("ACTOR-MESSAGES");
var MetaMessageType;
(function (MetaMessageType) {
    MetaMessageType[MetaMessageType["INIT"] = 0] = "INIT";
    MetaMessageType[MetaMessageType["REPLY"] = 1] = "REPLY";
    MetaMessageType[MetaMessageType["HOOKUP"] = 2] = "HOOKUP";
    MetaMessageType[MetaMessageType["HOOKDOWN"] = 3] = "HOOKDOWN";
})(MetaMessageType || (MetaMessageType = {}));
const metaUid = `${randomMaxInt()}-${randomMaxInt()}`;
const META_CHANNEL_NAME = "ACTOR_META_CHANNEL_NAME";
const metaChannel = new BroadcastChannel(META_CHANNEL_NAME);
const readyActors = new Set();
const readyCallbacks = new Map();
/**
 * Adds the given actorName to the set of readyActors. If there are any readyCallbacks
 * attached to that actorName, it will sequentially fire them (regardless of whether any errors are thrown).
 * @param actorName
 */
function addReadyActor(actorName) {
    readyActors.add(actorName);
    const callbacks = readyCallbacks.get(actorName);
    if (callbacks) {
        callbacks.forEach(cb => {
            try {
                cb();
            }
            catch (e) {
                console.error(e);
            }
        });
        readyCallbacks.set(actorName, new Set());
    }
}
/**
 * Removes the provided {@link ReadyCallback} from the set of listeners attached to
 * the given actorName.
 * @param actorName
 * @param callback
 */
function offActorReady(actorName, callback) {
    const callbacks = readyCallbacks.get(actorName);
    if (callbacks) {
        callbacks.delete(callback);
    }
}
/**
 * Adds the provided {@link ReadyCallback} as a listener that will be fired when
 * actorName is announced as ready.
 * @param actorName
 * @param callback
 */
function onActorReady(actorName, callback) {
    if (readyActors.has(actorName)) {
        callback();
        return;
    }
    if (!readyCallbacks.has(actorName)) {
        readyCallbacks.set(actorName, new Set());
    }
    const callbacks = readyCallbacks.get(actorName);
    callbacks.add(callback);
}
/**
 * Attaches a listener to the metaChannel to keep track of Actor
 * initialization across browsing contexts.
 */
function initMeta() {
    metaChannel.addEventListener("message", (evt) => {
        const message = evt.data;
        switch (message.type) {
            case MetaMessageType.INIT: // A request to get the latest set of actors
                metaChannel.postMessage({
                    type: MetaMessageType.REPLY,
                    payload: { sender: metaUid, readyActors }
                });
                return;
            case MetaMessageType.REPLY: // Add any previously-unknown actors
                message.payload.readyActors.forEach(addReadyActor);
                return;
            case MetaMessageType.HOOKUP: // Add the new actor
                addReadyActor(message.payload.actor);
                return;
            case MetaMessageType.HOOKDOWN: // Delete the destroyed actor
                if (readyActors.has(message.payload.actor)) {
                    readyActors.delete(message.payload.actor);
                }
                return;
        }
        const _never = message; // Trigger exhaustiveness check on message type
        return _never;
    });
    metaChannel.postMessage({
        type: MetaMessageType.INIT,
        payload: { sender: metaUid }
    });
}
initMeta();
/**
 * Hookup an {@link Actor} with a name into system. In this case, the actor
 * will initialize and respond to any messages designated for `actorName`.
 *
 * For example, if you have an actor that can work with a user interface
 * (typically the DOM) then perform the following:
 *
 *    hookup("ui", new UIActor());
 *
 * In general, the system of actors should be asynchronous. This means that
 * messages can arrive at any time and actors are hooked up in any arbitrary
 * order. To that end, you can not rely on specific timing when an actor is
 * available. However, you can `await` the `hookup` invocation if you want to
 * be certain that the actor is now available in the system:
 *
 *    await hookup("ui", new UIActor());
 *
 * If you would like to send a message to the "ui" actor, use {@link lookup}.
 *
 * @param config An {@link ActorConfiguration} that specifies actor name and optional dependencies.
 * @param actorCreator An {@link ActorCreator} function that returns an Actor instance.
 * @param purgeExistingMessages Whether any messages that arrived before this
 *    actor was ready should be discarded.
 * @return A promise which, once resolved, provides a callback that can be
 *    invoked to remove this actor from the system.
 */
export async function hookup(config, actorCreator, { purgeExistingMessages = false } = {}) {
    const { name: actorName } = config;
    if (config.dependencies && config.dependencies.length) {
        await Promise.all(config.dependencies.map(waitFor));
    }
    Promise.resolve().then(() => {
        addReadyActor(actorName);
        metaChannel.postMessage({
            type: MetaMessageType.HOOKUP,
            payload: { sender: metaUid, actor: actorName }
        });
    }); // run in separate microtask
    const actor = actorCreator();
    actor.actorName = actorName;
    // @ts-ignore
    await actor.initPromise;
    if (purgeExistingMessages) {
        await messageStore.popMessages(actorName);
    }
    const hookdown = messageStore.subscribe(actorName, messages => {
        for (const message of messages) {
            try {
                actor.onMessage(message.detail);
            }
            catch (e) {
                console.error(e);
            }
        }
    });
    return async () => {
        hookdown();
        await messageStore.popMessages(actorName);
        readyActors.delete(actorName);
        metaChannel.postMessage({
            type: MetaMessageType.HOOKDOWN,
            payload: { sender: metaUid, actor: actorName }
        });
    };
}
/**
 * @param t How long to wait until resolving (milliseconds)
 * @return A Promise that resolves after the given number of milliseconds
 */
function sleep(t = 1000) {
    return new Promise(resolve => setTimeout(resolve, t));
}
/**
 * Used to await any actors that need to be loaded.
 * @param actorName The name of the actor to wait for
 * @return A Promise that resolves if the actor is loaded,
 *         and otherwise rejects if the timeout is exceeded.
 */
async function waitFor(actorName) {
    await new Promise(async (resolve, reject) => {
        let ready = false;
        const callback = () => {
            ready = true;
            resolve();
        };
        onActorReady(actorName, callback);
        await sleep(5000);
        offActorReady(actorName, callback);
        if (!ready) {
            reject(new Error(`Timed out waiting for actor "${actorName}".`));
        }
    });
}
/**
 * Lookup an actor in the system with the provided `actorName`. This requires
 * the receiving actor to be hooked up with {@link hookup}. Any messages sent
 * before the actor is hooked up will be queued up and delivered once
 * the actor has been initialized.
 *
 *    lookup("ui").send({ count: 5 });
 *
 * If you want to wait until the message has been queued up, then `await` the
 * `send` invocation:
 *
 *    await lookup("ui").send({ count: 5 });
 *
 * Note that this does not wait for the receiving actor to actually receive
 * and process the message. Instead, it will only ensure that the message
 * has been queued up and is ready to be received by the receiving actor.
 *
 * You can use the resulting {@link ActorHandle} as a convenience in your actor.
 * For example, you can obtain a handle in the constructor
 * and send messages in your {@link Actor#onMessage} callback:
 *
 *    class MyActor extends Actor<MessageType> {
 *      count: number;
 *      uiActor: ActorHandle<"ui">;
 *
 *      constructor() {
 *        super();
 *        this.count = 0;
 *        this.uiActor = lookup("ui");
 *      }
 *
 *      onMessage(message: MessageType) {
 *        this.count++;
 *        console.log(`I received message number ${this.count}: ${message}`);
 *        this.uiActor.send({ count: this.count });
 *      }
 *    }
 *
 * @param actorName The name that was given to an actor in the system.
 * @return A convenience handle to send messages directly to a specific actor.
 */
export function lookup(actorName) {
    return {
        async send(message) {
            await messageStore.pushMessage({
                recipient: actorName,
                detail: message
            });
        }
    };
}
/**
 * Remove all existing messages that are sent to any actor. Generally, this
 * method should only be called once, when the application is initialized.
 *
 * We recommend calling this method in your main script once and before any
 * actor is created and hooked up in the system. For example:
 *
 *    // index.js:
 *    async function bootstrap() {
 *      // Remove any messages before hooking up any actor
 *      await initializeQueues();
 *      // We have removed any existing messages. Hook up the UI Actor now
 *      hookup("ui", new UIActor());
 *      // Also, spawn a new worker which will consequently hook up additional
 *      // state and database actors in the system.
 *      new Worker("worker.js");
 *    }
 *    bootstrap();
 *
 *    // worker.js
 *    hookup("state", new StateActor());
 *    hookup("database", new DatabaseActor());
 */
export async function initializeQueues() {
    await messageStore.popMessages("*");
}
//# sourceMappingURL=Actor.js.map