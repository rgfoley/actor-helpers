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
declare global {
    /**
     * The type of messages that can be sent to an actor. To define the type
     * of messages actor with name "ui" could receive,
     * define the following in your TS file:
     *
     *    interface State {
     *      count: number;
     *    }
     *
     *    declare global {
     *      interface ActorMessageType {
     *        ui: State;
     *      }
     *    }
     *
     * If an actor can receive multiple types of messages,
     * [a discriminated union](https://www.typescriptlang.org/docs/handbook/advanced-types.html#discriminated-unions)
     * has proven useful.
     */
    interface ActorMessageType {
    }
}
/**
 * All actor names that are defined in {@link ActorMessageType}.
 */
export declare type ValidActorMessageName = keyof ActorMessageType;
export declare type ActorCreator<T> = () => Actor<T>;
export interface ActorConfiguration<ActorName extends ValidActorMessageName> {
    name: ActorName;
    dependencies?: ActorName[];
}
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
export declare abstract class Actor<T> {
    /**
     * Do not use, it is an internal implementation detail used in {@link hookup}.
     */
    private readonly initPromise;
    /**
     * The name given to this actor by calling {@link hookup}.
     */
    actorName?: ValidActorMessageName;
    constructor();
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
    init(): Promise<void>;
    /**
     * Callback to process a message that was sent to this actor.
     *
     * Note that this callback is synchronous. This means that if an actor needs
     * to perform expensive work (for example, encode an image), you need to
     * perform this work asynchronously. You can make `onMessage` asynchronous
     * if you want to use `await`. Note that message delivery will *not* be
     * halted until `onMessage` as completed.
     *
     *    class MyActor extends Actor<MessageType> {
     *      onMessage(message: MessageType) {
     *        Promise.resolve().then(() => this.performExpensiveWork());
     *      }
     *
     *      async performExpensiveWork() {
     *        // Some long running task here
     *      }
     *    }
     *
     *
     * For TypeScript users, this requires the specification
     * of the {@link ActorMessageType}:
     *
     *    interface State {
     *      count: number;
     *    }
     *
     *    declare global {
     *      interface ActorMessageType {
     *        ui: State;
     *      }
     *    }
     *
     * @param message The message that was sent to this actor.
     */
    abstract onMessage(message: T): void;
}
/**
 * The callback-type which is returned by {@link hookup} that can be used
 * to remove an {@link Actor} from the system. Fires the MetaHookdownMessage.
 */
export declare type HookdownCallback = () => Promise<void>;
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
export declare function hookup<ActorName extends ValidActorMessageName>(config: ActorConfiguration<ActorName>, actorCreator: ActorCreator<ActorMessageType[ActorName]>, { purgeExistingMessages }?: {
    purgeExistingMessages?: boolean;
}): Promise<HookdownCallback>;
/**
 * An object that describes a convenience method to send a message to a specific
 * actor. Use {@link lookup} to obtain a handle to a specific actor.
 */
export interface ActorHandle<ActorName extends ValidActorMessageName> {
    /**
     * Send a message to this specific actor.
     *
     * If you want to wait until the message has been queued up, then `await` the
     * `send` invocation:
     *
     *    await lookup("ui").send({ count: 5 });
     *
     * Note that this does not wait for the receiving actor to actually receive
     * and process the message. Instead, it will only ensure that the message
     * has been stored and is ready to be received by the receiving actor.
     *
     * @param message The message to send to this actor.
     */
    send(message: ActorMessageType[ActorName]): Promise<void>;
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
export declare function lookup<ActorName extends ValidActorMessageName>(actorName: ActorName): ActorHandle<ActorName>;
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
export declare function initializeQueues(): Promise<void>;
