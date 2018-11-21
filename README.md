# actor-helpers

Helpers to build web applications based on the [actor model].
These helpers are used in our examples, for which you can find our boilerplate [here][boilerplate].
We encourage you to read through the boilerplate examples first and then read through the code in this repository.

## modifications

Changed `actor.ts` functions/types to support dependencies between actors. Added a separate meta BroadcastChannel for coordinating actor readiness between browsing contexts/workers.
The `hookup` signature has changed to receive an `ActorConfiguration` instead of an `actorName` string.

## actor.ts

`actor.ts` contains a base class implementation for an actor, as well as functions to `hookup()` and `lookup()` actors on the web page.
For more detailed examples, please check out the in-file documentation.

## watchable-message-store.ts

This store is an implementation detail of the messaging system used by `hookup()` and `lookup()` to allow actors to communicate with one another. You shouldn't need to interact directly with the message store, but it's here all the same if you do.

[actor model]: https://en.wikipedia.org/wiki/Actor_model
[boilerplate]: https://github.com/polymerlabs/actor-boilerplate

---

License BSD-3-clause

Please note: this is not a Google product.
